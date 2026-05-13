import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { HourRecord, RecordType, DayType, RecordStatus } from './entities/hour-record.entity';
import { User } from '../users/entities/user.entity';
import { ClockInDto } from './dto/clock-in.dto';
import { ManualRecordDto } from './dto/manual-record.dto';
import { NetworkService } from '../network/network.service';
import { ParametersService } from '../parameters/parameters.service';

const DEFAULT_TOLERANCE_MINUTES = 10;
const DEFAULT_EXTRA_NORMAL_PERCENT = 50;
const DEFAULT_EXTRA_DOMINGO_FERIADO_PERCENT = 100;
const DEFAULT_EXTRA_ACORDO_COLETIVO_MIN_PERCENT = 60;
const DEFAULT_ADICIONAL_NOTURNO_PERCENT = 20;
const NIGHT_START = 22;
const NIGHT_END = 5;

@Injectable()
export class HoursService {
  constructor(
    @InjectRepository(HourRecord)
    private hourRecordRepository: Repository<HourRecord>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private networkService: NetworkService,
    private parametersService: ParametersService,
  ) {}

  // Registra entrada ou saída automaticamente
  async clockIn(userId: number, dto: ClockInDto, ipAddress: string): Promise<HourRecord> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuário não encontrado');

    await this.networkService.enforceIpCheck(userId, ipAddress, 'Registro de ponto');

    const now = new Date();
    const date = now.toISOString().split('T')[0];
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

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

    return this.hourRecordRepository.save(record);
  }

  // Registro manual (RH/Admin)
  async manualRecord(dto: ManualRecordDto): Promise<HourRecord> {
    const user = await this.userRepository.findOne({ where: { id: dto.userId } });
    if (!user) throw new NotFoundException('Usuário não encontrado');

    const record = this.hourRecordRepository.create({
      ...dto,
      isManual: true,
      status: RecordStatus.PENDENTE,
    });

    if (dto.type === RecordType.SAIDA) {
      const lastEntry = await this.hourRecordRepository.findOne({
        where: { userId: dto.userId, date: dto.date, type: RecordType.ENTRADA },
        order: { createdAt: 'DESC' },
      });

      if (lastEntry) {
        const calculated = await this.calculateHours(
          lastEntry.time,
          dto.time,
          dto.dayType ?? DayType.UTIL,
          user,
        );
        record.regularHours = calculated.regularHours;
        record.extraHours50 = calculated.extraHours50;
        record.extraHours60 = calculated.extraHours60;
        record.extraHours100 = calculated.extraHours100;
        record.nightHours = calculated.nightHours;
      }
    }

    return this.hourRecordRepository.save(record);
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

    const records = await this.findByUserAndPeriod(userId, startDate, endDate);

    const saidas = records.filter(r => r.type === RecordType.SAIDA);

    const totalRegular = saidas.reduce((sum, r) => sum + Number(r.regularHours), 0);
    const totalExtra50 = saidas.reduce((sum, r) => sum + Number(r.extraHours50), 0);
    const totalExtra100 = saidas.reduce((sum, r) => sum + Number(r.extraHours100), 0);
    const totalNight = saidas.reduce((sum, r) => sum + Number(r.nightHours), 0);

    return {
      userId,
      year,
      month,
      totalRegularHours: +totalRegular.toFixed(2),
      totalExtraHours50: +totalExtra50.toFixed(2),
      totalExtraHours100: +totalExtra100.toFixed(2),
      totalNightHours: +totalNight.toFixed(2),
      totalExtraHours: +(totalExtra50 + totalExtra100).toFixed(2),
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
    const today = new Date().toISOString().split('T')[0];
    return this.hourRecordRepository.find({
      where: { userId, date: today },
      order: { time: 'ASC' },
    });
  }

  // Todos os registros de hoje (RH/Admin)
  async getAllTodayRecords(): Promise<HourRecord[]> {
    const today = new Date().toISOString().split('T')[0];
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
    Object.assign(record, dto);
    return this.hourRecordRepository.save(record);
  }

  // Remover registro
  async deleteRecord(id: number): Promise<{ message: string }> {
    const record = await this.hourRecordRepository.findOne({ where: { id } });
    if (!record) throw new NotFoundException('Registro não encontrado');
    await this.hourRecordRepository.remove(record);
    return { message: 'Registro removido com sucesso' };
  }

  // Calcula horas trabalhadas, extras e noturnas
  private async calculateHours(entryTime: string, exitTime: string, dayType: DayType, user: User) {
    const [entryH, entryM] = entryTime.split(':').map(Number);
    const [exitH, exitM] = exitTime.split(':').map(Number);

    const entryMinutes = entryH * 60 + entryM;
    let exitMinutes = exitH * 60 + exitM;

    if (exitMinutes <= entryMinutes) {
      exitMinutes += 24 * 60;
    }

    const totalMinutes = exitMinutes - entryMinutes;

    if (totalMinutes <= 0) {
      return { regularHours: 0, extraHours50: 0, extraHours60: 0, extraHours100: 0, nightHours: 0 };
    }

    let expectedMinutes = 480;
    if (user.workStartTime && user.workEndTime) {
      const [startH, startM] = user.workStartTime.split(':').map(Number);
      const [endH, endM] = user.workEndTime.split(':').map(Number);
      expectedMinutes = (endH * 60 + endM) - (startH * 60 + startM);
    }

    const cltRules = await this.getCltRules();

    const toleranceMinutes = cltRules.toleranceMinutes;
    const extraMinutes = Math.max(0, totalMinutes - expectedMinutes - toleranceMinutes);
    const regularMinutes = totalMinutes - extraMinutes;

    let nightMinutes = 0;
    for (let m = entryMinutes; m < exitMinutes; m++) {
      const hour = Math.floor(m / 60) % 24;
      if (hour >= NIGHT_START || hour < NIGHT_END) {
        nightMinutes++;
      }
    }

    const isDomingoOuFeriado = dayType === DayType.DOMINGO || dayType === DayType.FERIADO;
    const isSabado = dayType === DayType.SABADO;
    const useAcordoColetivo = isSabado && cltRules.acordoColetivoMinPercent > 50;

    return {
      regularHours: +(regularMinutes / 60).toFixed(2),
      extraHours50: (!isDomingoOuFeriado && !useAcordoColetivo) ? +(extraMinutes / 60).toFixed(2) : 0,
      extraHours60: useAcordoColetivo ? +(extraMinutes / 60).toFixed(2) : 0,
      extraHours100: isDomingoOuFeriado ? +(extraMinutes / 60).toFixed(2) : 0,
      nightHours: +(nightMinutes / 60).toFixed(2),
    };
  }

  private async getCltRules() {
    const [extraNormalRaw, extraDomingoRaw, acordoMinRaw, toleranceRaw, nightAdditionalRaw] = await Promise.all([
      this.parametersService.getValue('HORA_EXTRA_NORMAL', String(DEFAULT_EXTRA_NORMAL_PERCENT)),
      this.parametersService.getValue('HORA_EXTRA_DOMINGO_FERIADO', String(DEFAULT_EXTRA_DOMINGO_FERIADO_PERCENT)),
      this.parametersService.getValue('HORA_EXTRA_ACORDO_COLETIVO_MIN', String(DEFAULT_EXTRA_ACORDO_COLETIVO_MIN_PERCENT)),
      this.parametersService.getValue('TOLERANCIA_MINUTOS', String(DEFAULT_TOLERANCE_MINUTES)),
      this.parametersService.getValue('ADICIONAL_NOTURNO', String(DEFAULT_ADICIONAL_NOTURNO_PERCENT)),
    ]);

    return {
      extraUtilSabadoPercent: Number(extraNormalRaw) || DEFAULT_EXTRA_NORMAL_PERCENT,
      acordoColetivoMinPercent: Number(acordoMinRaw) || DEFAULT_EXTRA_ACORDO_COLETIVO_MIN_PERCENT,
      extraDomingoFeriadoPercent: Number(extraDomingoRaw) || DEFAULT_EXTRA_DOMINGO_FERIADO_PERCENT,
      toleranceMinutes: Number(toleranceRaw) || DEFAULT_TOLERANCE_MINUTES,
      nightAdditionalPercent: Number(nightAdditionalRaw) || DEFAULT_ADICIONAL_NOTURNO_PERCENT,
    };
  }
}
