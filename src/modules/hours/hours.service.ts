import { Injectable, BadRequestException, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { localDateString, localTimeString } from '../../common/utils/date.utils';
import { HourRecord, RecordType, DayType, RecordStatus } from './entities/hour-record.entity';
import { User } from '../users/entities/user.entity';
import { ClockInDto } from './dto/clock-in.dto';
import { ManualRecordDto } from './dto/manual-record.dto';
import { NetworkService } from '../network/network.service';
import { ParametersService } from '../parameters/parameters.service';
import { PeriodosService } from '../periodos/periodos.service';

const DEFAULT_TOLERANCE_MINUTES = 10;
const DEFAULT_EXTRA_NORMAL_PERCENT = 50;
const DEFAULT_EXTRA_DOMINGO_FERIADO_PERCENT = 100;
const DEFAULT_EXTRA_ACORDO_COLETIVO_MIN_PERCENT = 60;
const DEFAULT_ADICIONAL_NOTURNO_PERCENT = 20;
const DEFAULT_DAILY_HOURS = 8;
const DEFAULT_NIGHT_START = 22;
const DEFAULT_NIGHT_END = 5;
const DEFAULT_LUNCH_BREAK_MINUTES = 60;

@Injectable()
export class HoursService {
  constructor(
    @InjectRepository(HourRecord)
    private hourRecordRepository: Repository<HourRecord>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private networkService: NetworkService,
    private parametersService: ParametersService,
    @Inject(forwardRef(() => PeriodosService))
    private periodosService: PeriodosService,
  ) {}

  // Registra entrada ou saída automaticamente
  async clockIn(userId: number, dto: ClockInDto, ipAddress: string): Promise<HourRecord> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuário não encontrado');

    await this.networkService.enforceIpCheck(userId, ipAddress, 'Registro de ponto');

    const now = new Date();
    const date = localDateString(now);
    const time = localTimeString(now);

    // Valida se a data está dentro do período ativo da empresa
    await this.periodosService.validateDate(user.empresaId, date);

    // Verifica último registro do dia
    const lastRecord = await this.hourRecordRepository.findOne({
      where: { userId, date },
      order: { createdAt: 'DESC' },
    });

    const type = !lastRecord || lastRecord.type === RecordType.SAIDA
      ? RecordType.ENTRADA
      : RecordType.SAIDA;

    const record = this.hourRecordRepository.create({
      userId,
      date,
      time,
      type,
      dayType: dto.dayType ?? DayType.UTIL,
      observation: dto.observation,
      ipAddress,
      isManual: false,
    });

    // Se for saída, calcula horas
    if (type === RecordType.SAIDA && lastRecord) {
      const calculated = await this.calculateHours(
        lastRecord.time,
        time,
        dto.dayType ?? DayType.UTIL,
        user,
      );
      record.regularHours = calculated.regularHours;
      record.extraHours50 = calculated.extraHours50;
      record.extraHours60 = calculated.extraHours60;
      record.extraHours100 = calculated.extraHours100;
      record.nightHours = calculated.nightHours;
    }

    const saved = await this.hourRecordRepository.save(record);

    // Recalcula todas as horas do dia considerando todos os pares
    await this.recalculateDayRecords(userId, date, user);

    return saved;
  }

  // Registro manual (RH/Admin)
  async manualRecord(dto: ManualRecordDto): Promise<HourRecord> {
    const user = await this.userRepository.findOne({ where: { id: dto.userId } });
    if (!user) throw new NotFoundException('Usuário não encontrado');

    // Valida período — emendas de admin bypass esta verificação
    if (!dto.isAmendment) {
      await this.periodosService.validateDate(user.empresaId, dto.date);
    }

    const type = Object.values(RecordType).includes(dto.type as RecordType)
      ? (dto.type as RecordType)
      : RecordType.ENTRADA;
    
    const dayType = Object.values(DayType).includes(dto.dayType as DayType)
      ? (dto.dayType as DayType)
      : DayType.UTIL;

    const record = this.hourRecordRepository.create({
      userId: dto.userId,
      date: dto.date,
      time: dto.time,
      type,
      dayType,
      observation: dto.observation,
      isManual: true,
      status: RecordStatus.PENDENTE,
    });

    if (type === RecordType.SAIDA) {
      const lastEntry = await this.hourRecordRepository.findOne({
        where: { userId: dto.userId, date: dto.date, type: RecordType.ENTRADA },
        order: { createdAt: 'DESC' },
      });

      if (lastEntry) {
        const calculated = await this.calculateHours(
          lastEntry.time,
          dto.time,
          dayType,
          user,
        );
        record.regularHours = calculated.regularHours;
        record.extraHours50 = calculated.extraHours50;
        record.extraHours60 = calculated.extraHours60;
        record.extraHours100 = calculated.extraHours100;
        record.nightHours = calculated.nightHours;
      }
    }

    const saved = await this.hourRecordRepository.save(record);

    // Recalcula todas as horas do dia considerando todos os pares
    const userEntity = await this.userRepository.findOne({ where: { id: dto.userId } });
    if (userEntity) {
      await this.recalculateDayRecords(dto.userId, dto.date, userEntity);
    }

    return saved;
  }

  // Busca registros de um colaborador por período
  async findByUserAndPeriod(userId: number, startDate: string, endDate: string): Promise<HourRecord[]> {
    return this.hourRecordRepository.find({
      where: {
        userId,
        date: Between(startDate, endDate),
      },
      order: { date: 'ASC', time: 'ASC' },
    });
  }

  // Resumo mensal de um colaborador
  async getMonthlySummary(userId: number, year: number, month: number) {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;

    const [user, records] = await Promise.all([
      this.userRepository.findOne({ where: { id: userId } }),
      this.findByUserAndPeriod(userId, startDate, endDate),
    ]);

    const saidas = records.filter(r => r.type === RecordType.SAIDA);

    const totalRegular = saidas.reduce((sum, r) => sum + Number(r.regularHours), 0);
    const totalExtra50 = saidas.reduce((sum, r) => sum + Number(r.extraHours50), 0);
    const totalExtra60 = saidas.reduce((sum, r) => sum + Number((r as any).extraHours60 ?? 0), 0);
    const totalExtra100 = saidas.reduce((sum, r) => sum + Number(r.extraHours100), 0);
    const totalNight = saidas.reduce((sum, r) => sum + Number(r.nightHours), 0);

    // Saldo herdado do período anterior (se existir)
    let saldoAnterior: any = null;
    if (user?.empresaId) {
      const prev = await this.periodosService.getPreviousBalance(userId, user.empresaId);
      if (prev && (Number(prev.totalExtraHours) > 0 || Number(prev.nightHours) > 0)) {
        saldoAnterior = {
          extraHours50: Number(prev.extraHours50),
          extraHours60: Number(prev.extraHours60),
          extraHours100: Number(prev.extraHours100),
          nightHours: Number(prev.nightHours),
          totalExtraHours: Number(prev.totalExtraHours),
          extraValue: Number(prev.extraValue),
          nightValue: Number(prev.nightValue),
          totalValue: +(Number(prev.extraValue) + Number(prev.nightValue)).toFixed(2),
        };
      }
    }

    return {
      userId,
      year,
      month,
      totalRegularHours: +totalRegular.toFixed(2),
      totalExtraHours50: +totalExtra50.toFixed(2),
      totalExtraHours60: +totalExtra60.toFixed(2),
      totalExtraHours100: +totalExtra100.toFixed(2),
      totalNightHours: +totalNight.toFixed(2),
      totalExtraHours: +(totalExtra50 + totalExtra60 + totalExtra100).toFixed(2),
      saldoAnterior,
      records,
    };
  }

  async getUserMonthlyBalance(userId: number) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuário não encontrado');

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const records = await this.findByUserAndPeriod(userId, startDate, endDate);
    const saidas = records.filter((r) => r.type === RecordType.SAIDA);

    const totalExtraHours50 = saidas.reduce((sum, r) => sum + Number(r.extraHours50), 0);
    const totalExtraHours60 = saidas.reduce((sum, r) => sum + Number((r as any).extraHours60 ?? 0), 0);
    const totalExtraHours100 = saidas.reduce((sum, r) => sum + Number(r.extraHours100), 0);
    const totalNightHours = saidas.reduce((sum, r) => sum + Number(r.nightHours), 0);
    const totalExtraHours = totalExtraHours50 + totalExtraHours60 + totalExtraHours100;

    const hourlyRate = Number(user.hourlyRate ?? 0);
    const cltRules = await this.getCltRules();

    const extra50Value = totalExtraHours50 * hourlyRate * 1.5;
    const extra60Value = totalExtraHours60 * hourlyRate * 1.6;
    const extra100Value = totalExtraHours100 * hourlyRate * 2.0;
    const nightValue = totalNightHours * hourlyRate * (cltRules.nightAdditionalPercent / 100);

    return {
      userId,
      totalExtraHours: +totalExtraHours.toFixed(2),
      extraHours50: +totalExtraHours50.toFixed(2),
      extraHours60: +totalExtraHours60.toFixed(2),
      extraHours100: +totalExtraHours100.toFixed(2),
      nightHours: +totalNightHours.toFixed(2),
      financialSummary: {
        extra50Value: +extra50Value.toFixed(2),
        extra60Value: +extra60Value.toFixed(2),
        extra100Value: +extra100Value.toFixed(2),
        nightValue: +nightValue.toFixed(2),
        totalValue: +(extra50Value + extra60Value + extra100Value + nightValue).toFixed(2),
      },
      hourlyRate: +hourlyRate.toFixed(2),
    };
  }

  // Registros do dia para um colaborador
  async getTodayRecords(userId: number): Promise<HourRecord[]> {
    const today = localDateString();
    return this.hourRecordRepository.find({
      where: { userId, date: today },
      order: { time: 'ASC' },
    });
  }

  // Todos os registros de hoje (RH/Admin)
  async getAllTodayRecords(): Promise<HourRecord[]> {
    const today = localDateString();
    return this.hourRecordRepository.find({
      where: { date: today },
      relations: ['user'],
      order: { time: 'ASC' },
    });
  }

  // Buscar todos os registros por data
  async getAllRecordsByDate(date: string): Promise<HourRecord[]> {
    return this.hourRecordRepository.find({
      where: { date },
      relations: ['user'],
      order: { time: 'ASC' },
    });
  }

  // Buscar registros de um usuário por data
  async getRecordsByUserAndDate(userId: number, date: string): Promise<HourRecord[]> {
    return this.hourRecordRepository.find({
      where: { userId, date },
      order: { time: 'ASC' },
    });
  }

  // Atualizar um registro
  async updateRecord(id: number, dto: any): Promise<HourRecord> {
    const record = await this.hourRecordRepository.findOne({ where: { id } });
    if (!record) throw new NotFoundException('Registro não encontrado');

    const user = await this.userRepository.findOne({ where: { id: record.userId } });
    if (user) {
      await this.periodosService.validateDate(user.empresaId, record.date);
    }

    Object.assign(record, dto);
    const saved = await this.hourRecordRepository.save(record);

    if (user) {
      await this.recalculateDayRecords(saved.userId, saved.date, user);
    }

    return saved;
  }

  // Remover registro
  async deleteRecord(id: number): Promise<{ message: string }> {
    const record = await this.hourRecordRepository.findOne({ where: { id } });
    if (!record) throw new NotFoundException('Registro não encontrado');

    const { userId, date } = record;
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (user) {
      await this.periodosService.validateDate(user.empresaId, date);
    }

    await this.hourRecordRepository.remove(record);

    // Recalcula o dia após remoção
    if (user) {
      await this.recalculateDayRecords(userId, date, user);
    }

    return { message: 'Registro removido com sucesso' };
  }

  // Calcula horas trabalhadas, extras e noturnas
  private async calculateHours(entryTime: string, exitTime: string, dayType: DayType, user: User) {
    const [entryH, entryM] = entryTime.split(':').map(Number);
    const [exitH, exitM] = exitTime.split(':').map(Number);

    const entryMinutes = entryH * 60 + entryM;
    let exitMinutes = exitH * 60 + exitM;

    if (exitMinutes < entryMinutes) {
      exitMinutes += 24 * 60;
    }

    const totalMinutes = exitMinutes - entryMinutes;

    if (totalMinutes <= 0) {
      return { regularHours: 0, extraHours50: 0, extraHours60: 0, extraHours100: 0, nightHours: 0 };
    }

    const cltRules = await this.getCltRules();

    let expectedMinutes = cltRules.dailyHours * 60;
    if (user.workStartTime && user.workEndTime) {
      const startParts = user.workStartTime.split(':').map(Number);
      const endParts = user.workEndTime.split(':').map(Number);
      const startTotalMinutes = startParts[0] * 60 + startParts[1];
      const endTotalMinutes = endParts[0] * 60 + endParts[1];
      const grossWorkMinutes = endTotalMinutes - startTotalMinutes;
      const lunchBreakMinutes = grossWorkMinutes >= 360 ? cltRules.lunchBreakMinutes : 0;
      expectedMinutes = grossWorkMinutes - lunchBreakMinutes;
    }

    const rawExtra = totalMinutes - expectedMinutes;
    const extraMinutes = rawExtra > cltRules.toleranceMinutes ? rawExtra : 0;
    const regularMinutes = Math.min(totalMinutes, expectedMinutes);

    let nightMinutes = 0;
    for (let m = entryMinutes; m < exitMinutes; m++) {
      const hour = Math.floor(m / 60) % 24;
      if (hour >= cltRules.nightStart || hour < cltRules.nightEnd) {
        nightMinutes++;
      }
    }

    const isDomingoOuFeriado = dayType === DayType.DOMINGO || dayType === DayType.FERIADO;
    const isSabado = dayType === DayType.SABADO;
    const useAcordoColetivo = isSabado && cltRules.acordoColetivoMinPercent > 50;

    const firstTierExtraMinutes = Math.min(extraMinutes, 120);
    const secondTierExtraMinutes = Math.max(0, extraMinutes - 120);

    return {
      regularHours: +(regularMinutes / 60).toFixed(2),
      extraHours50: (!isDomingoOuFeriado && !useAcordoColetivo) ? +(firstTierExtraMinutes / 60).toFixed(2) : 0,
      extraHours60: isDomingoOuFeriado ? 0 : (useAcordoColetivo ? +(extraMinutes / 60).toFixed(2) : +(secondTierExtraMinutes / 60).toFixed(2)),
      extraHours100: isDomingoOuFeriado ? +(extraMinutes / 60).toFixed(2) : 0,
      nightHours: +(nightMinutes / 60).toFixed(2),
    };
  }

  async recalculateDayRecords(userId: number, date: string, user: User): Promise<void> {
    const dayRecords = await this.hourRecordRepository.find({
      where: { userId, date },
      order: { time: 'ASC' },
    });

    const entradas = dayRecords.filter(r => r.type === RecordType.ENTRADA);
    const saidas = dayRecords.filter(r => r.type === RecordType.SAIDA);

    if (saidas.length === 0) return;

    const cltRules = await this.getCltRules();

    let expectedMinutes = cltRules.dailyHours * 60;
    if (user.workStartTime && user.workEndTime) {
      const startParts = user.workStartTime.split(':').map(Number);
      const endParts = user.workEndTime.split(':').map(Number);
      const startTotalMinutes = startParts[0] * 60 + startParts[1];
      const endTotalMinutes = endParts[0] * 60 + endParts[1];
      const grossWorkMinutes = endTotalMinutes - startTotalMinutes;
      const lunchBreakMinutes = grossWorkMinutes >= 360 ? cltRules.lunchBreakMinutes : 0;
      expectedMinutes = grossWorkMinutes - lunchBreakMinutes;
    }

    // Calcula total de minutos trabalhados no dia (somando todos os pares)
    let totalWorkedMinutes = 0;
    let totalNightMinutes = 0;

    const pairs = Math.min(entradas.length, saidas.length);
    for (let i = 0; i < pairs; i++) {
      const [entryH, entryM] = entradas[i].time.split(':').map(Number);
      const [exitH, exitM] = saidas[i].time.split(':').map(Number);

      let entryMinutes = entryH * 60 + entryM;
      let exitMinutes = exitH * 60 + exitM;

      if (exitMinutes < entryMinutes) exitMinutes += 24 * 60;

      const pairMinutes = exitMinutes - entryMinutes;
      totalWorkedMinutes += pairMinutes;

      // Conta minutos noturnos deste par
      for (let m = entryMinutes; m < exitMinutes; m++) {
        const hour = Math.floor(m / 60) % 24;
        if (hour >= cltRules.nightStart || hour < cltRules.nightEnd) {
          totalNightMinutes++;
        }
      }
    }

    // Calcula extras sobre o total do dia aplicando tolerância (Fix 5)
    const rawExtra = totalWorkedMinutes - expectedMinutes;
    const extraMinutes = rawExtra > cltRules.toleranceMinutes ? rawExtra : 0;
    const regularMinutes = Math.min(totalWorkedMinutes, expectedMinutes);

    // Determina tipo do dia pelo primeiro registro
    const dayType = dayRecords[0]?.dayType ?? DayType.UTIL;
    const isDomingoOuFeriado = dayType === DayType.DOMINGO || dayType === DayType.FERIADO;
    const isSabado = dayType === DayType.SABADO;
    const useAcordoColetivo = isSabado && cltRules.acordoColetivoMinPercent > 50;

    const firstTierExtraMinutes = Math.min(extraMinutes, 120);
    const secondTierExtraMinutes = Math.max(0, extraMinutes - 120);

    const extraHours50 = (!isDomingoOuFeriado && !useAcordoColetivo) ? +(firstTierExtraMinutes / 60).toFixed(2) : 0;
    const extraHours60 = isDomingoOuFeriado ? 0 : (useAcordoColetivo ? +(extraMinutes / 60).toFixed(2) : +(secondTierExtraMinutes / 60).toFixed(2));
    const extraHours100 = isDomingoOuFeriado ? +(extraMinutes / 60).toFixed(2) : 0;
    const nightHours = +(totalNightMinutes / 60).toFixed(2);
    const regularHours = +(regularMinutes / 60).toFixed(2);

    // Distribui as horas calculadas apenas na ÚLTIMA saída do dia
    // Zera todas as saídas primeiro
    for (const saida of saidas) {
      saida.regularHours = 0;
      saida.extraHours50 = 0;
      (saida as any).extraHours60 = 0;
      saida.extraHours100 = 0;
      saida.nightHours = 0;
      await this.hourRecordRepository.save(saida);
    }

    // Coloca tudo na última saída
    const lastSaida = saidas[saidas.length - 1];
    lastSaida.regularHours = regularHours;
    lastSaida.extraHours50 = extraHours50;
    (lastSaida as any).extraHours60 = extraHours60;
    lastSaida.extraHours100 = extraHours100;
    lastSaida.nightHours = nightHours;
    await this.hourRecordRepository.save(lastSaida);
  }

  private async getCltRules() {
    const [
      extraNormalRaw, extraDomingoRaw, acordoMinRaw, toleranceRaw, nightAdditionalRaw,
      dailyHoursRaw, nightStartRaw, nightEndRaw, lunchBreakRaw,
    ] = await Promise.all([
      this.parametersService.getValue('HORA_EXTRA_NORMAL', undefined, String(DEFAULT_EXTRA_NORMAL_PERCENT)),
      this.parametersService.getValue('HORA_EXTRA_DOMINGO_FERIADO', undefined, String(DEFAULT_EXTRA_DOMINGO_FERIADO_PERCENT)),
      this.parametersService.getValue('HORA_EXTRA_ACORDO_COLETIVO_MIN', undefined, String(DEFAULT_EXTRA_ACORDO_COLETIVO_MIN_PERCENT)),
      this.parametersService.getValue('TOLERANCIA_MINUTOS', undefined, String(DEFAULT_TOLERANCE_MINUTES)),
      this.parametersService.getValue('ADICIONAL_NOTURNO', undefined, String(DEFAULT_ADICIONAL_NOTURNO_PERCENT)),
      this.parametersService.getValue('JORNADA_DIARIA_HORAS', undefined, String(DEFAULT_DAILY_HOURS)),
      this.parametersService.getValue('HORA_NOTURNA_INICIO', undefined, String(DEFAULT_NIGHT_START)),
      this.parametersService.getValue('HORA_NOTURNA_FIM', undefined, String(DEFAULT_NIGHT_END)),
      this.parametersService.getValue('INTERVALO_MINIMO_MINUTOS', undefined, String(DEFAULT_LUNCH_BREAK_MINUTES)),
    ]);

    return {
      extraUtilSabadoPercent: Number(extraNormalRaw) || DEFAULT_EXTRA_NORMAL_PERCENT,
      acordoColetivoMinPercent: Number(acordoMinRaw) || DEFAULT_EXTRA_ACORDO_COLETIVO_MIN_PERCENT,
      extraDomingoFeriadoPercent: Number(extraDomingoRaw) || DEFAULT_EXTRA_DOMINGO_FERIADO_PERCENT,
      toleranceMinutes: Number(toleranceRaw) || DEFAULT_TOLERANCE_MINUTES,
      nightAdditionalPercent: Number(nightAdditionalRaw) || DEFAULT_ADICIONAL_NOTURNO_PERCENT,
      dailyHours: Number(dailyHoursRaw) || DEFAULT_DAILY_HOURS,
      nightStart: Number(nightStartRaw) || DEFAULT_NIGHT_START,
      nightEnd: Number(nightEndRaw) || DEFAULT_NIGHT_END,
      lunchBreakMinutes: Number(lunchBreakRaw) || DEFAULT_LUNCH_BREAK_MINUTES,
    };
  }
}
