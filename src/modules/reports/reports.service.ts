import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { localDateString } from '../../common/utils/date.utils';
import { computeGross, deductFromTiers, TierBalance } from '../../common/utils/balance.utils';
import { HourRecord, RecordType } from '../hours/entities/hour-record.entity';
import { User, UserStatus } from '../users/entities/user.entity';
import { Request, RequestStatus, RequestType } from '../requests/entities/request.entity';
import { ParametersService } from '../parameters/parameters.service';

const DEFAULT_ADICIONAL_NOTURNO_PERCENT = 20;

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(HourRecord)
    private hourRecordRepository: Repository<HourRecord>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Request)
    private requestRepository: Repository<Request>,
    private parametersService: ParametersService,
  ) {}

  private async getNightMultiplier(): Promise<number> {
    const raw = await this.parametersService.getValue(
      'ADICIONAL_NOTURNO',
      undefined,
      String(DEFAULT_ADICIONAL_NOTURNO_PERCENT),
    );
    return (Number(raw) || DEFAULT_ADICIONAL_NOTURNO_PERCENT) / 100;
  }

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
    const hourlyRate = Number(user.hourlyRate ?? 0);
    const nightMultiplier = await this.getNightMultiplier();

    const dailySummary = this.groupByDay(records);

    // Bruto — total ganho no período pelos registros de ponto
    const bruto = computeGross(saidas, hourlyRate, nightMultiplier);

    // Comprometido — requerimentos aprovados (pagamento + compensação)
    const approvedRequests = requests.filter(r => r.status === RequestStatus.APROVADO);
    const compensacaoAprovadas = approvedRequests.filter(r => r.type === RequestType.COMPENSACAO);
    const pagamentoAprovados = approvedRequests.filter(r => r.type === RequestType.PAGAMENTO);
    const totalHorasCompensadas = compensacaoAprovadas.reduce((s, r) => s + Number(r.hoursAmount), 0);
    const totalHorasPagas = pagamentoAprovados.reduce((s, r) => s + Number(r.hoursAmount), 0);
    const totalAprovado = totalHorasCompensadas + totalHorasPagas;

    // Calcula valor monetário de cada requerimento aprovado sequencialmente (100%→60%→50%)
    let tempGross: Pick<TierBalance, 'h50' | 'h60' | 'h100' | 'nightHours'> = bruto;
    const approvedWithValue = approvedRequests.map(req => {
      const { disponivel: afterDeduct, valorDeducido } = deductFromTiers(tempGross, Number(req.hoursAmount), hourlyRate, nightMultiplier);
      tempGross = afterDeduct;
      return {
        id: req.id,
        type: req.type,
        status: req.status,
        hoursAmount: req.hoursAmount,
        referenceDate: req.referenceDate,
        estimatedValue: req.type === RequestType.PAGAMENTO ? valorDeducido : null,
      };
    });

    const totalValorPago = approvedWithValue
      .filter(r => r.type === RequestType.PAGAMENTO)
      .reduce((s, r) => s + (r.estimatedValue ?? 0), 0);

    const { disponivel, valorDeducido: totalValorComprometido } = deductFromTiers(bruto, totalAprovado, hourlyRate, nightMultiplier);

    const regularValue = +(totalRegular * hourlyRate).toFixed(2);

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
        workedDays: dailySummary.length,
        bruto,
        comprometido: {
          horas: +totalAprovado.toFixed(2),
          valor: totalValorComprometido,
          requerimentos: approvedWithValue,
        },
        disponivel,
        // Aliases para compatibilidade — apontam para bruto
        totalExtraHours50: bruto.h50,
        totalExtraHours60: bruto.h60,
        totalExtraHours100: bruto.h100,
        totalNightHours: bruto.nightHours,
        totalExtraHours: bruto.totalExtra,
        financialSummary: {
          regularValue,
          extra50Value: bruto.financeiro.v50,
          extra60Value: bruto.financeiro.v60,
          extra100Value: bruto.financeiro.v100,
          nightValue: bruto.financeiro.vNight,
          totalValue: bruto.financeiro.total,
        },
      },
      requests: {
        total: requests.length,
        pending: requests.filter(r => r.status === RequestStatus.PENDENTE).length,
        approved: approvedRequests.length,
        rejected: requests.filter(r => r.status === RequestStatus.REJEITADO).length,
        cancelled: requests.filter(r => r.status === RequestStatus.CANCELADO).length,
        totals: {
          totalHorasCompensadas: +totalHorasCompensadas.toFixed(2),
          totalHorasPagas: +totalHorasPagas.toFixed(2),
          totalValorPago: +totalValorPago.toFixed(2),
        },
      },
      requestsList: requests.map(r => {
        const approved = approvedWithValue.find(a => a.id === r.id);
        return {
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
          estimatedValue: approved?.estimatedValue ?? null,
        };
      }),
      dailySummary,
      records,
    };
  }

  // Relatório coletivo — todos os colaboradores em um período
  async getCollectiveReport(startDate: string, endDate: string) {
    const users = await this.userRepository.find({
      where: { status: UserStatus.ATIVO },
    });

    const nightMultiplier = await this.getNightMultiplier();

    const results = await Promise.all(
      users.map(async (user) => {
        const [records, approvedRequests] = await Promise.all([
          this.hourRecordRepository.find({
            where: { userId: user.id, date: Between(startDate, endDate) },
          }),
          this.requestRepository.find({
            where: {
              userId: user.id,
              status: RequestStatus.APROVADO,
              referenceDate: Between(startDate, endDate),
            },
          }),
        ]);

        const saidas = records.filter(r => r.type === RecordType.SAIDA);
        const totalExtra50 = saidas.reduce((sum, r) => sum + Number(r.extraHours50), 0);
        const totalExtra60 = saidas.reduce((sum, r) => sum + Number((r as any).extraHours60 ?? 0), 0);
        const totalExtra100 = saidas.reduce((sum, r) => sum + Number(r.extraHours100), 0);
        const totalNight = saidas.reduce((sum, r) => sum + Number(r.nightHours), 0);
        const totalRegular = saidas.reduce((sum, r) => sum + Number(r.regularHours), 0);
        const rate = Number(user.hourlyRate ?? 0);
        const bruto = computeGross(saidas, rate, nightMultiplier);

        const pagamentos = approvedRequests.filter(r => r.type === RequestType.PAGAMENTO);
        const compensacoes = approvedRequests.filter(r => r.type === RequestType.COMPENSACAO);
        const horasPagas = pagamentos.reduce((s, r) => s + Number(r.hoursAmount), 0);
        const horasCompensadas = compensacoes.reduce((s, r) => s + Number(r.hoursAmount), 0);
        const { valorDeducido: valorPago } = deductFromTiers(bruto, horasPagas, rate, nightMultiplier);

        return {
          userId: user.id,
          name: user.name,
          department: user.department,
          position: user.position,
          totalRegularHours: +totalRegular.toFixed(2),
          totalExtraHours50: +totalExtra50.toFixed(2),
          totalExtraHours60: +totalExtra60.toFixed(2),
          totalExtraHours100: +totalExtra100.toFixed(2),
          totalNightHours: +totalNight.toFixed(2),
          totalExtraHours: +(totalExtra50 + totalExtra60 + totalExtra100).toFixed(2),
          workedDays: [...new Set(records.map(r => r.date))].length,
          totalValueExtra: rate
            ? +(
                totalExtra50 * rate * 1.5 +
                totalExtra60 * rate * 1.6 +
                totalExtra100 * rate * 2.0
              ).toFixed(2)
            : null,
          requests: {
            total: approvedRequests.length,
            pagamentos: pagamentos.length,
            compensacoes: compensacoes.length,
            horasPagas: +horasPagas.toFixed(2),
            horasCompensadas: +horasCompensadas.toFixed(2),
            valorPago: rate ? +valorPago.toFixed(2) : null,
          },
        };
      }),
    );

    const totalExtraGeral = results.reduce((sum, r) => sum + r.totalExtraHours, 0);
    const totalExtra60Geral = results.reduce((sum, r) => sum + r.totalExtraHours60, 0);
    const totalNightGeral = results.reduce((sum, r) => sum + r.totalNightHours, 0);
    const totalValueGeral = results.reduce((sum, r) => sum + (r.totalValueExtra ?? 0), 0);
    const totalRequerimentos = results.reduce((sum, r) => sum + r.requests.total, 0);
    const totalHorasPagas = results.reduce((sum, r) => sum + r.requests.horasPagas, 0);
    const totalHorasCompensadas = results.reduce((sum, r) => sum + r.requests.horasCompensadas, 0);
    const totalValorPago = results.reduce((sum, r) => sum + (r.requests.valorPago ?? 0), 0);

    return {
      period: { startDate, endDate },
      totalCollaborators: users.length,
      totalExtraHours: +totalExtraGeral.toFixed(2),
      totalExtraHours60: +totalExtra60Geral.toFixed(2),
      totalNightHours: +totalNightGeral.toFixed(2),
      totalExtraValue: +totalValueGeral.toFixed(2),
      totalRequerimentos,
      totalHorasPagas: +totalHorasPagas.toFixed(2),
      totalHorasCompensadas: +totalHorasCompensadas.toFixed(2),
      totalValorPago: +totalValorPago.toFixed(2),
      collaborators: results,
    };
  }

  // Dashboard geral — indicadores do sistema
  async getDashboard() {
    const totalUsers = await this.userRepository.count({
      where: { status: UserStatus.ATIVO },
    });

    const today = localDateString();
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
      (sum, r) =>
        sum +
        Number(r.extraHours50) +
        Number((r as any).extraHours60 ?? 0) +
        Number(r.extraHours100),
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
          (sum, r) =>
            sum +
            Number(r.extraHours50) +
            Number((r as any).extraHours60 ?? 0) +
            Number(r.extraHours100),
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
