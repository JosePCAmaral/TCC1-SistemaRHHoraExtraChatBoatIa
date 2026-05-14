import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { HourRecord, RecordType } from '../hours/entities/hour-record.entity';
import { User, UserStatus } from '../users/entities/user.entity';
import { Request, RequestStatus } from '../requests/entities/request.entity';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(HourRecord)
    private hourRecordRepository: Repository<HourRecord>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Request)
    private requestRepository: Repository<Request>,
  ) {}

  // Relatório individual de um colaborador
  async getIndividualReport(userId: number, startDate: string, endDate: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Colaborador não encontrado');

    const records = await this.hourRecordRepository.find({
      where: { userId, date: Between(startDate, endDate) },
      order: { date: 'ASC', time: 'ASC' },
    });

    const requests = await this.requestRepository.find({
      where: { userId },
      relations: ['reviewer'],
      order: { createdAt: 'DESC' },
    });

    requests.forEach(r => {
      if (r.reviewer) delete r.reviewer.password;
    });

    const saidas = records.filter(r => r.type === RecordType.SAIDA);
    const totalRegular = saidas.reduce((sum, r) => sum + Number(r.regularHours), 0);
    const totalExtra50 = saidas.reduce((sum, r) => sum + Number(r.extraHours50), 0);
    const totalExtra60 = saidas.reduce((sum, r) => sum + Number((r as any).extraHours60 ?? 0), 0);
    const totalExtra100 = saidas.reduce((sum, r) => sum + Number(r.extraHours100), 0);
    const totalNight = saidas.reduce((sum, r) => sum + Number(r.nightHours), 0);
    const totalExtra = totalExtra50 + totalExtra60 + totalExtra100;
    const hourlyRate = Number(user.hourlyRate ?? 0);

    const dailySummary = this.groupByDay(records);

    // Totais de solicitações
    const approvedRequests = requests.filter(r => r.status === RequestStatus.APROVADO);
    const compensacaoAprovadas = approvedRequests.filter(r => r.type === 'compensacao');
    const pagamentoAprovados = approvedRequests.filter(r => r.type === 'pagamento');

    const totalHorasCompensadas = compensacaoAprovadas.reduce((sum, r) => sum + Number(r.hoursAmount), 0);
    const totalHorasPagas = pagamentoAprovados.reduce((sum, r) => sum + Number(r.hoursAmount), 0);
    const totalValorPago = pagamentoAprovados.reduce((sum, r) => sum + (Number(r.hoursAmount) * hourlyRate * 1.5), 0);

    // Calcular horas deductíveis (abater compensações e pagamentos das extras)
    // Deduzir prioritariamente de 100%, depois 60%, depois 50%
    let deductible50 = totalExtra50;
    let deductible60 = totalExtra60;
    let deductible100 = totalExtra100;

    const totalDeducted = totalHorasCompensadas + totalHorasPagas;
    let remaining = totalDeducted;

    if (remaining > 0 && deductible100 > 0) {
      const toRemove100 = Math.min(remaining, deductible100);
      deductible100 -= toRemove100;
      remaining -= toRemove100;
    }
    if (remaining > 0 && deductible60 > 0) {
      const toRemove60 = Math.min(remaining, deductible60);
      deductible60 -= toRemove60;
      remaining -= toRemove60;
    }
    if (remaining > 0 && deductible50 > 0) {
      const toRemove50 = Math.min(remaining, deductible50);
      deductible50 -= toRemove50;
    }

    const totalExtraDeductible = deductible50 + deductible60 + deductible100;
    const regularValue = totalRegular * hourlyRate;
    const extra50Value = deductible50 * hourlyRate * 1.5;
    const extra60Value = deductible60 * hourlyRate * 1.6;
    const extra100Value = deductible100 * hourlyRate * 2.0;
    const nightValue = totalNight * hourlyRate * 0.2;
    const totalValue = regularValue + extra50Value + extra60Value + extra100Value + nightValue;

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        department: user.department,
        position: user.position,
        workStartTime: user.workStartTime,
        workEndTime: user.workEndTime,
        hourlyRate: user.hourlyRate,
      },
      period: { startDate, endDate },
      summary: {
        totalRegularHours: +totalRegular.toFixed(2),
        totalExtraHours50: +deductible50.toFixed(2),
        totalExtraHours60: +deductible60.toFixed(2),
        totalExtraHours100: +deductible100.toFixed(2),
        totalNightHours: +totalNight.toFixed(2),
        totalExtraHours: +totalExtraDeductible.toFixed(2),
        // Campos com totais originais (antes de deduções)
        originalExtraHours50: +totalExtra50.toFixed(2),
        originalExtraHours60: +totalExtra60.toFixed(2),
        originalExtraHours100: +totalExtra100.toFixed(2),
        originalExtraHours: +totalExtra.toFixed(2),
        financialSummary: {
          regularValue: +regularValue.toFixed(2),
          extra50Value: +extra50Value.toFixed(2),
          extra60Value: +extra60Value.toFixed(2),
          extra100Value: +extra100Value.toFixed(2),
          nightValue: +nightValue.toFixed(2),
          totalValue: +totalValue.toFixed(2),
        },
        workedDays: dailySummary.length,
      },
      requests: {
        total: requests.length,
        pending: requests.filter(r => r.status === RequestStatus.PENDENTE).length,
        approved: approvedRequests.length,
        rejected: requests.filter(r => r.status === RequestStatus.REJEITADO).length,
        totals: {
          totalHorasCompensadas: +totalHorasCompensadas.toFixed(2),
          totalHorasPagas: +totalHorasPagas.toFixed(2),
          totalValorPago: +totalValorPago.toFixed(2),
        },
      },
      requestsList: requests.map(r => ({
        id: r.id,
        type: r.type,
        status: r.status,
        referenceDate: r.referenceDate,
        hoursAmount: r.hoursAmount,
        justification: r.justification,
        reviewerComment: r.reviewerComment,
        reviewedAt: r.reviewedAt,
        createdAt: r.createdAt,
        reviewer: r.reviewer ? { name: r.reviewer.name } : null,
        estimatedValue: r.status === RequestStatus.APROVADO
          ? +(Number(r.hoursAmount) * hourlyRate * 1.5).toFixed(2)
          : null,
      })),
      dailySummary,
      records,
    };
  }

  // Relatório coletivo — todos os colaboradores em um período
  async getCollectiveReport(startDate: string, endDate: string) {
    const users = await this.userRepository.find({
      where: { status: UserStatus.ATIVO },
    });

    const results = await Promise.all(
      users.map(async (user) => {
        const records = await this.hourRecordRepository.find({
          where: { userId: user.id, date: Between(startDate, endDate) },
        });

        const saidas = records.filter(r => r.type === RecordType.SAIDA);
        const totalExtra50 = saidas.reduce((sum, r) => sum + Number(r.extraHours50), 0);
        const totalExtra100 = saidas.reduce((sum, r) => sum + Number(r.extraHours100), 0);
        const totalRegular = saidas.reduce((sum, r) => sum + Number(r.regularHours), 0);

        return {
          userId: user.id,
          name: user.name,
          department: user.department,
          position: user.position,
          totalRegularHours: +totalRegular.toFixed(2),
          totalExtraHours50: +totalExtra50.toFixed(2),
          totalExtraHours100: +totalExtra100.toFixed(2),
          totalExtraHours: +(totalExtra50 + totalExtra100).toFixed(2),
          workedDays: [...new Set(records.map(r => r.date))].length,
          totalValueExtra: user.hourlyRate
            ? +(
                totalExtra50 * Number(user.hourlyRate) * 1.5 +
                totalExtra100 * Number(user.hourlyRate) * 2.0
              ).toFixed(2)
            : null,
        };
      }),
    );

    const totalExtraGeral = results.reduce((sum, r) => sum + r.totalExtraHours, 0);
    const totalValueGeral = results.reduce((sum, r) => sum + (r.totalValueExtra ?? 0), 0);

    return {
      period: { startDate, endDate },
      totalCollaborators: users.length,
      totalExtraHours: +totalExtraGeral.toFixed(2),
      totalExtraValue: +totalValueGeral.toFixed(2),
      collaborators: results,
    };
  }

  // Dashboard geral — indicadores do sistema
  async getDashboard() {
    const totalUsers = await this.userRepository.count({
      where: { status: UserStatus.ATIVO },
    });

    const today = new Date().toISOString().split('T')[0];
    const firstDayOfMonth = today.substring(0, 7) + '-01';

    const clockedInToday = await this.hourRecordRepository
      .createQueryBuilder('h')
      .select('COUNT(DISTINCT h.userId)', 'count')
      .where('h.date = :today', { today })
      .getRawOne();

    const pendingRequests = await this.requestRepository.count({
      where: { status: RequestStatus.PENDENTE },
    });

    const monthRecords = await this.hourRecordRepository.find({
      where: { date: Between(firstDayOfMonth, today) },
    });

    const monthSaidas = monthRecords.filter(r => r.type === RecordType.SAIDA);
    const totalExtraMonth = monthSaidas.reduce(
      (sum, r) => sum + Number(r.extraHours50) + Number(r.extraHours100),
      0,
    );

    const recentRequests = await this.requestRepository.find({
      relations: ['user'],
      order: { createdAt: 'DESC' },
      take: 5,
    });

    return {
      overview: {
        totalActiveCollaborators: totalUsers,
        clockedInToday: Number(clockedInToday?.count ?? 0),
        pendingRequests,
        totalExtraHoursThisMonth: +totalExtraMonth.toFixed(2),
      },
      recentRequests: recentRequests.map(r => ({
        id: r.id,
        collaborator: r.user?.name,
        type: r.type,
        status: r.status,
        hoursAmount: r.hoursAmount,
        createdAt: r.createdAt,
      })),
    };
  }

  // Relatório por departamento
  async getDepartmentReport(department: string, startDate: string, endDate: string) {
    const users = await this.userRepository.find({
      where: { department, status: UserStatus.ATIVO },
    });

    if (!users.length) {
      return { department, period: { startDate, endDate }, collaborators: [] };
    }

    const results = await Promise.all(
      users.map(async (user) => {
        const records = await this.hourRecordRepository.find({
          where: { userId: user.id, date: Between(startDate, endDate) },
        });
        const saidas = records.filter(r => r.type === RecordType.SAIDA);
        const totalExtra = saidas.reduce(
          (sum, r) => sum + Number(r.extraHours50) + Number(r.extraHours100),
          0,
        );
        return {
          userId: user.id,
          name: user.name,
          position: user.position,
          totalExtraHours: +totalExtra.toFixed(2),
          workedDays: [...new Set(records.map(r => r.date))].length,
        };
      }),
    );

    return {
      department,
      period: { startDate, endDate },
      totalCollaborators: users.length,
      collaborators: results,
    };
  }

  // Agrupa registros por dia para o relatório individual
  private groupByDay(records: HourRecord[]) {
    const grouped: Record<string, any> = {};

    for (const record of records) {
      if (!grouped[record.date]) {
        grouped[record.date] = {
          date: record.date,
          dayType: record.dayType,
          records: [],
          totalRegularHours: 0,
          totalExtraHours50: 0,
          totalExtraHours60: 0,
          totalExtraHours100: 0,
          totalNightHours: 0,
        };
      }
      grouped[record.date].records.push(record);
      if (record.type === RecordType.SAIDA) {
        grouped[record.date].totalRegularHours += Number(record.regularHours);
        grouped[record.date].totalExtraHours50 += Number(record.extraHours50);
        grouped[record.date].totalExtraHours60 += Number((record as any).extraHours60 ?? 0);
        grouped[record.date].totalExtraHours100 += Number(record.extraHours100);
        grouped[record.date].totalNightHours += Number(record.nightHours);
      }
    }

    return Object.values(grouped);
  }
}
