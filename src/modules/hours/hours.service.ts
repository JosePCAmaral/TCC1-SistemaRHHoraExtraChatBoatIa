import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { HourRecord, RecordType, DayType, RecordStatus } from './entities/hour-record.entity';
import { User } from '../users/entities/user.entity';
import { ClockInDto } from './dto/clock-in.dto';
import { ManualRecordDto } from './dto/manual-record.dto';

const TOLERANCE_MINUTES = 10;
const NIGHT_START = 22;
const NIGHT_END = 5;

@Injectable()
export class HoursService {
  constructor(
    @InjectRepository(HourRecord)
    private hourRecordRepository: Repository<HourRecord>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  // Registra entrada ou saída automaticamente
  async clockIn(userId: number, dto: ClockInDto, ipAddress: string): Promise<HourRecord> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuário não encontrado');

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
      const calculated = this.calculateHours(
        lastRecord.time,
        time,
        dto.dayType ?? DayType.UTIL,
        user,
      );
      record.regularHours = calculated.regularHours;
      record.extraHours50 = calculated.extraHours50;
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
        const calculated = this.calculateHours(
          lastEntry.time,
          dto.time,
          dto.dayType ?? DayType.UTIL,
          user,
        );
        record.regularHours = calculated.regularHours;
        record.extraHours50 = calculated.extraHours50;
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

  // Calcula horas trabalhadas, extras e noturnas
  private calculateHours(entryTime: string, exitTime: string, dayType: DayType, user: User) {
    const [entryH, entryM] = entryTime.split(':').map(Number);
    const [exitH, exitM] = exitTime.split(':').map(Number);

    const entryMinutes = entryH * 60 + entryM;
    const exitMinutes = exitH * 60 + exitM;
    const totalMinutes = exitMinutes - entryMinutes;

    if (totalMinutes <= 0) {
      return { regularHours: 0, extraHours50: 0, extraHours100: 0, nightHours: 0 };
    }

    // Jornada esperada do colaborador
    let expectedMinutes = 480; // 8h padrão
    if (user.workStartTime && user.workEndTime) {
      const [startH, startM] = user.workStartTime.split(':').map(Number);
      const [endH, endM] = user.workEndTime.split(':').map(Number);
      expectedMinutes = (endH * 60 + endM) - (startH * 60 + startM);
    }

    const toleranceMinutes = TOLERANCE_MINUTES;
    const extraMinutes = Math.max(0, totalMinutes - expectedMinutes - toleranceMinutes);
    const regularMinutes = totalMinutes - extraMinutes;

    // Horas noturnas (22h-5h)
    let nightMinutes = 0;
    for (let m = entryMinutes; m < exitMinutes; m++) {
      const hour = Math.floor(m / 60) % 24;
      if (hour >= NIGHT_START || hour < NIGHT_END) {
        nightMinutes++;
      }
    }

    // Percentual de hora extra conforme tipo do dia
    const isDomingoOuFeriado = dayType === DayType.DOMINGO || dayType === DayType.FERIADO;

    return {
      regularHours: +(regularMinutes / 60).toFixed(2),
      extraHours50: isDomingoOuFeriado ? 0 : +(extraMinutes / 60).toFixed(2),
      extraHours100: isDomingoOuFeriado ? +((extraMinutes + regularMinutes) / 60).toFixed(2) : 0,
      nightHours: +(nightMinutes / 60).toFixed(2),
    };
  }
}
