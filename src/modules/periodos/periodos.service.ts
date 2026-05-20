import {
  Injectable, BadRequestException, NotFoundException, Inject, forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { Periodo, PeriodoStatus } from './entities/periodo.entity';
import { PeriodUserBalance } from './entities/period-user-balance.entity';
import { PeriodAmendment } from './entities/period-amendment.entity';
import { HourRecord, RecordType } from '../hours/entities/hour-record.entity';
import { User, UserStatus } from '../users/entities/user.entity';
import { Request, RequestStatus } from '../requests/entities/request.entity';
import { HoursService } from '../hours/hours.service';
import { ParametersService } from '../parameters/parameters.service';
import { computeGross, deductFromTiers } from '../../common/utils/balance.utils';
import { CreatePeriodoDto } from './dto/create-periodo.dto';
import { AmendPeriodoDto } from './dto/amend-periodo.dto';

const DEFAULT_NIGHT_ADDITIONAL = 20;

@Injectable()
export class PeriodosService {
  constructor(
    @InjectRepository(Periodo)
    private periodosRepo: Repository<Periodo>,
    @InjectRepository(PeriodUserBalance)
    private balancesRepo: Repository<PeriodUserBalance>,
    @InjectRepository(PeriodAmendment)
    private amendmentsRepo: Repository<PeriodAmendment>,
    @InjectRepository(HourRecord)
    private hourRecordRepo: Repository<HourRecord>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(Request)
    private requestRepo: Repository<Request>,
    @Inject(forwardRef(() => HoursService))
    private hoursService: HoursService,
    private parametersService: ParametersService,
  ) {}

  // ──────────────────────────────────────────────
  // Queries
  // ──────────────────────────────────────────────

  async findAll(empresaId: number): Promise<Periodo[]> {
    return this.periodosRepo.find({
      where: { empresaId },
      order: { startDate: 'DESC' },
    });
  }

  async findAtivo(empresaId: number): Promise<Periodo | null> {
    return this.periodosRepo.findOne({
      where: { empresaId, status: PeriodoStatus.ATIVO },
    });
  }

  async findOne(id: number): Promise<Periodo> {
    const p = await this.periodosRepo.findOne({ where: { id } });
    if (!p) throw new NotFoundException('Período não encontrado');
    return p;
  }

  async getRelatorio(id: number) {
    const p = await this.findOne(id);
    if (!p.reportSnapshot) throw new BadRequestException('Este período ainda não foi fechado');
    return {
      periodo: {
        id: p.id, nome: p.nome, startDate: p.startDate, endDate: p.endDate,
        status: p.status, closedAt: p.closedAt,
        hasAmendments: p.hasAmendments, amendmentCount: p.amendmentCount,
      },
      report: p.reportSnapshot,
    };
  }

  async getSaldos(id: number) {
    const p = await this.findOne(id);
    const balances = await this.balancesRepo.find({ where: { periodoId: id } });
    const users = await this.userRepo.findByIds(balances.map(b => b.userId));
    const userMap = new Map(users.map(u => [u.id, u]));

    return {
      periodo: { id: p.id, nome: p.nome, startDate: p.startDate, endDate: p.endDate },
      balances: balances.map(b => {
        const u = userMap.get(b.userId);
        return {
          userId: b.userId,
          name: u?.name ?? '—',
          department: u?.department,
          position: u?.position,
          extraHours50: Number(b.extraHours50),
          extraHours60: Number(b.extraHours60),
          extraHours100: Number(b.extraHours100),
          nightHours: Number(b.nightHours),
          totalExtraHours: Number(b.totalExtraHours),
          extraValue: Number(b.extraValue),
          nightValue: Number(b.nightValue),
        };
      }),
    };
  }

  async getAmendments(id: number) {
    const amendments = await this.amendmentsRepo.find({
      where: { periodoId: id },
      order: { createdAt: 'DESC' },
    });
    const adminIds = [...new Set(amendments.map(a => a.adminId))];
    const userIds = [...new Set(amendments.map(a => a.userId))];
    const allIds = [...new Set([...adminIds, ...userIds])];
    const users = await this.userRepo.findByIds(allIds);
    const userMap = new Map(users.map(u => [u.id, u]));

    return amendments.map(a => ({
      id: a.id,
      admin: userMap.get(a.adminId)?.name ?? '—',
      colaborador: userMap.get(a.userId)?.name ?? '—',
      description: a.description,
      hourRecordId: a.hourRecordId,
      createdAt: a.createdAt,
    }));
  }

  // Saldo do período anterior para um colaborador (usado no dashboard)
  async getPreviousBalance(userId: number, empresaId: number): Promise<PeriodUserBalance | null> {
    if (!empresaId) return null;
    const lastClosed = await this.periodosRepo.findOne({
      where: { empresaId, status: PeriodoStatus.FECHADO },
      order: { endDate: 'DESC' },
    });
    if (!lastClosed) return null;

    return this.balancesRepo.findOne({
      where: { periodoId: lastClosed.id, userId },
    });
  }

  // Verifica se a data está dentro do período ativo — lança exceção se não estiver
  async validateDate(empresaId: number, date: string): Promise<void> {
    if (!empresaId) return;
    const active = await this.findAtivo(empresaId);
    if (!active) return; // sem período ativo → sem restrição (retrocompat)

    if (date < active.startDate || date > active.endDate) {
      throw new BadRequestException(
        `Data ${date} está fora do período ativo "${active.nome}" ` +
        `(${active.startDate} a ${active.endDate}). ` +
        `Registros fora do período ativo só podem ser feitos por emenda de Admin.`,
      );
    }
  }

  // ──────────────────────────────────────────────
  // Mutations
  // ──────────────────────────────────────────────

  async create(dto: CreatePeriodoDto, adminId: number, empresaId: number): Promise<Periodo> {
    if (dto.startDate >= dto.endDate) {
      throw new BadRequestException('A data de início deve ser anterior à data de fim');
    }

    // Garante que não há sobreposição com outro período da empresa
    const overlap = await this.periodosRepo.findOne({
      where: [
        { empresaId, startDate: LessThanOrEqual(dto.endDate), endDate: MoreThanOrEqual(dto.startDate) },
      ],
    });
    if (overlap) {
      throw new BadRequestException(
        `Existe sobreposição com o período "${overlap.nome}" (${overlap.startDate} a ${overlap.endDate})`,
      );
    }

    const periodo = this.periodosRepo.create({
      ...dto,
      empresaId,
      status: PeriodoStatus.ATIVO,
    });
    return this.periodosRepo.save(periodo);
  }

  async update(id: number, dto: Partial<CreatePeriodoDto>): Promise<Periodo> {
    const p = await this.findOne(id);
    if (p.status === PeriodoStatus.FECHADO) {
      throw new BadRequestException('Não é possível editar um período fechado');
    }
    Object.assign(p, dto);
    return this.periodosRepo.save(p);
  }

  // ──────────────────────────────────────────────
  // Fechamento de período
  // ──────────────────────────────────────────────

  async fechar(id: number, adminId: number): Promise<Periodo> {
    const periodo = await this.findOne(id);
    if (periodo.status !== PeriodoStatus.ATIVO) {
      throw new BadRequestException('Período já está fechado');
    }

    const nightMultiplier = await this.getNightMultiplier();
    const users = await this.userRepo.find({
      where: { empresaId: periodo.empresaId, status: UserStatus.ATIVO },
    });

    const balancesToSave: PeriodUserBalance[] = [];
    const collaboratorSnapshots: any[] = [];

    for (const user of users) {
      const records = await this.hourRecordRepo.find({
        where: { userId: user.id, date: Between(periodo.startDate, periodo.endDate) },
      });

      const approvedRequests = await this.requestRepo.find({
        where: { userId: user.id, status: RequestStatus.APROVADO },
      });
      // Filtra requerimentos cuja referenceDate cai dentro do período
      const periodRequests = approvedRequests.filter(
        r => r.referenceDate >= periodo.startDate && r.referenceDate <= periodo.endDate,
      );

      const saidas = records.filter(r => r.type === RecordType.SAIDA);
      const grossRegular = saidas.reduce((s, r) => s + Number(r.regularHours), 0);
      const rate = Number(user.hourlyRate ?? 0);
      const bruto = computeGross(saidas, rate, nightMultiplier);
      const totalApproved = periodRequests.reduce((s, r) => s + Number(r.hoursAmount), 0);
      const { disponivel } = deductFromTiers(bruto, totalApproved, rate, nightMultiplier);

      balancesToSave.push(this.balancesRepo.create({
        periodoId: id,
        userId: user.id,
        empresaId: periodo.empresaId,
        extraHours50: disponivel.h50,
        extraHours60: disponivel.h60,
        extraHours100: disponivel.h100,
        nightHours: bruto.nightHours,
        totalExtraHours: disponivel.totalExtra,
        extraValue: +(disponivel.financeiro.v50 + disponivel.financeiro.v60 + disponivel.financeiro.v100).toFixed(2),
        nightValue: disponivel.financeiro.vNight,
      }));

      collaboratorSnapshots.push({
        userId: user.id,
        name: user.name,
        department: user.department,
        position: user.position,
        workedDays: [...new Set(records.map(r => r.date))].length,
        totalRegularHours: +grossRegular.toFixed(2),
        totalExtraHours50Gross: bruto.h50,
        totalExtraHours60Gross: bruto.h60,
        totalExtraHours100Gross: bruto.h100,
        totalNightHours: bruto.nightHours,
        approvedHours: +totalApproved.toFixed(2),
        balanceExtra50: disponivel.h50,
        balanceExtra60: disponivel.h60,
        balanceExtra100: disponivel.h100,
        balanceTotalExtraHours: disponivel.totalExtra,
        balanceExtraValue: +(disponivel.financeiro.v50 + disponivel.financeiro.v60 + disponivel.financeiro.v100).toFixed(2),
        balanceNightValue: disponivel.financeiro.vNight,
      });
    }

    await this.balancesRepo.save(balancesToSave);

    const totals = collaboratorSnapshots.reduce(
      (acc, c) => {
        acc.totalExtra50 += c.totalExtraHours50Gross;
        acc.totalExtra60 += c.totalExtraHours60Gross;
        acc.totalExtra100 += c.totalExtraHours100Gross;
        acc.totalNight += c.totalNightHours;
        acc.totalBalanceHours += c.balanceTotalExtraHours;
        acc.totalBalanceValue += c.balanceExtraValue + c.balanceNightValue;
        return acc;
      },
      { totalExtra50: 0, totalExtra60: 0, totalExtra100: 0, totalNight: 0, totalBalanceHours: 0, totalBalanceValue: 0 },
    );

    periodo.reportSnapshot = {
      generatedAt: new Date().toISOString(),
      period: { id: periodo.id, nome: periodo.nome, startDate: periodo.startDate, endDate: periodo.endDate },
      totals: {
        totalCollaborators: users.length,
        totalExtraHours50: +totals.totalExtra50.toFixed(2),
        totalExtraHours60: +totals.totalExtra60.toFixed(2),
        totalExtraHours100: +totals.totalExtra100.toFixed(2),
        totalNightHours: +totals.totalNight.toFixed(2),
        totalBalanceHours: +totals.totalBalanceHours.toFixed(2),
        totalBalanceValue: +totals.totalBalanceValue.toFixed(2),
      },
      collaborators: collaboratorSnapshots,
    };

    periodo.status = PeriodoStatus.FECHADO;
    periodo.closedAt = new Date();
    periodo.closedByUserId = adminId;
    await this.periodosRepo.save(periodo);

    // Cria próximo período automaticamente
    await this.criarProximoPeriodo(periodo);

    return periodo;
  }

  // ──────────────────────────────────────────────
  // Emenda (correção em período fechado)
  // ──────────────────────────────────────────────

  async amend(periodoId: number, dto: AmendPeriodoDto, adminId: number): Promise<any> {
    const periodo = await this.findOne(periodoId);
    if (periodo.status !== PeriodoStatus.FECHADO) {
      throw new BadRequestException('Emendas só podem ser feitas em períodos fechados');
    }
    if (dto.date < periodo.startDate || dto.date > periodo.endDate) {
      throw new BadRequestException(
        `A data ${dto.date} não pertence ao período "${periodo.nome}" (${periodo.startDate} a ${periodo.endDate})`,
      );
    }

    // Cria o registro de ponto com flag de emenda (bypassa validação de período)
    const record = await this.hoursService.manualRecord({
      userId: dto.userId,
      date: dto.date,
      time: dto.time,
      type: dto.type as any,
      dayType: dto.dayType as any,
      observation: dto.observation,
      isAmendment: true,
    });

    // Log da emenda
    const amendment = await this.amendmentsRepo.save(
      this.amendmentsRepo.create({
        periodoId,
        adminId,
        userId: dto.userId,
        description: dto.description,
        hourRecordId: record.id,
      }),
    );

    // Atualiza flags do período
    periodo.hasAmendments = true;
    periodo.amendmentCount = (periodo.amendmentCount ?? 0) + 1;

    // Recalcula saldo do usuário afetado e regenera snapshot
    await this.recalcularSaldoUsuario(periodo, dto.userId);
    await this.regenerarSnapshot(periodo);
    await this.periodosRepo.save(periodo);

    return { amendment, record };
  }

  // ──────────────────────────────────────────────
  // Helpers privados
  // ──────────────────────────────────────────────

  private async criarProximoPeriodo(closed: Periodo): Promise<Periodo> {
    const start = new Date(closed.endDate + 'T00:00:00');
    start.setDate(start.getDate() + 1);
    const end = new Date(start);
    end.setDate(end.getDate() + 29);

    const pad = (n: number) => String(n).padStart(2, '0');
    const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const nomeMes = start.toLocaleString('pt-BR', { month: 'long' });
    const nome = `${nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1)}/${start.getFullYear()}`;

    const next = this.periodosRepo.create({
      empresaId: closed.empresaId,
      nome,
      startDate: fmt(start),
      endDate: fmt(end),
      status: PeriodoStatus.ATIVO,
    });
    return this.periodosRepo.save(next);
  }

  private async recalcularSaldoUsuario(periodo: Periodo, userId: number): Promise<void> {
    const nightMultiplier = await this.getNightMultiplier();
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) return;

    const records = await this.hourRecordRepo.find({
      where: { userId, date: Between(periodo.startDate, periodo.endDate) },
    });
    const approvedRequests = await this.requestRepo.find({
      where: { userId, status: RequestStatus.APROVADO },
    });
    const periodRequests = approvedRequests.filter(
      r => r.referenceDate >= periodo.startDate && r.referenceDate <= periodo.endDate,
    );

    const saidas = records.filter(r => r.type === RecordType.SAIDA);
    const rate = Number(user.hourlyRate ?? 0);
    const bruto = computeGross(saidas, rate, nightMultiplier);
    const totalApproved = periodRequests.reduce((s, r) => s + Number(r.hoursAmount), 0);
    const { disponivel } = deductFromTiers(bruto, totalApproved, rate, nightMultiplier);

    // Upsert: atualiza se já existe, cria se não existe
    const existing = await this.balancesRepo.findOne({ where: { periodoId: periodo.id, userId } });
    const balance = existing ?? this.balancesRepo.create({ periodoId: periodo.id, userId, empresaId: periodo.empresaId });
    balance.extraHours50 = disponivel.h50;
    balance.extraHours60 = disponivel.h60;
    balance.extraHours100 = disponivel.h100;
    balance.nightHours = bruto.nightHours;
    balance.totalExtraHours = disponivel.totalExtra;
    balance.extraValue = +(disponivel.financeiro.v50 + disponivel.financeiro.v60 + disponivel.financeiro.v100).toFixed(2);
    balance.nightValue = disponivel.financeiro.vNight;
    await this.balancesRepo.save(balance);
  }

  private async regenerarSnapshot(periodo: Periodo): Promise<void> {
    const nightMultiplier = await this.getNightMultiplier();
    const users = await this.userRepo.find({
      where: { empresaId: periodo.empresaId, status: UserStatus.ATIVO },
    });
    const balances = await this.balancesRepo.find({ where: { periodoId: periodo.id } });
    const balanceMap = new Map(balances.map(b => [b.userId, b]));

    const collaborators = users.map(u => {
      const b = balanceMap.get(u.id);
      return {
        userId: u.id,
        name: u.name,
        department: u.department,
        position: u.position,
        balanceTotalExtraHours: Number(b?.totalExtraHours ?? 0),
        balanceExtraValue: Number(b?.extraValue ?? 0),
        balanceNightValue: Number(b?.nightValue ?? 0),
      };
    });

    const totals = balances.reduce(
      (acc, b) => {
        acc.totalBalanceHours += Number(b.totalExtraHours);
        acc.totalBalanceValue += Number(b.extraValue) + Number(b.nightValue);
        acc.totalNightHours += Number(b.nightHours);
        return acc;
      },
      { totalBalanceHours: 0, totalBalanceValue: 0, totalNightHours: 0 },
    );

    periodo.reportSnapshot = {
      ...periodo.reportSnapshot,
      regeneratedAt: new Date().toISOString(),
      totals: {
        ...periodo.reportSnapshot?.totals,
        totalCollaborators: users.length,
        totalBalanceHours: +totals.totalBalanceHours.toFixed(2),
        totalBalanceValue: +totals.totalBalanceValue.toFixed(2),
        totalNightHours: +totals.totalNightHours.toFixed(2),
      },
      collaborators,
    };
  }

  private async getNightMultiplier(): Promise<number> {
    const raw = await this.parametersService.getValue(
      'ADICIONAL_NOTURNO', undefined, String(DEFAULT_NIGHT_ADDITIONAL),
    );
    return (Number(raw) || DEFAULT_NIGHT_ADDITIONAL) / 100;
  }
}
