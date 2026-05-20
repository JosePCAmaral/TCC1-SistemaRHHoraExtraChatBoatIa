import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In } from 'typeorm';
import { computeGross, deductFromTiers } from '../../common/utils/balance.utils';
import { Request, RequestStatus } from './entities/request.entity';
import { CreateRequestDto } from './dto/create-request.dto';
import { ReviewRequestDto } from './dto/review-request.dto';
import { User } from '../users/entities/user.entity';
import { HourRecord, RecordType } from '../hours/entities/hour-record.entity';
import { ParametersService } from '../parameters/parameters.service';
import { PeriodosService } from '../periodos/periodos.service';

const DEFAULT_ADICIONAL_NOTURNO_PERCENT = 20;

@Injectable()
export class RequestsService {
  constructor(
    @InjectRepository(Request)
    private requestRepository: Repository<Request>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(HourRecord)
    private hourRecordRepository: Repository<HourRecord>,
    private parametersService: ParametersService,
    private periodosService: PeriodosService,
  ) {}

  private async getNightMultiplier(): Promise<number> {
    const raw = await this.parametersService.getValue(
      'ADICIONAL_NOTURNO',
      undefined,
      String(DEFAULT_ADICIONAL_NOTURNO_PERCENT),
    );
    return (Number(raw) || DEFAULT_ADICIONAL_NOTURNO_PERCENT) / 100;
  }

  async create(userId: number, dto: CreateRequestDto): Promise<Request> {
    await this.validateBalance(userId, dto.hoursAmount);

    const request = this.requestRepository.create({
      ...dto,
      userId,
      status: RequestStatus.PENDENTE,
    });
    return this.requestRepository.save(request);
  }

  private async getActivePeriodRange(empresaId: number): Promise<{ startDate: string; endDate: string }> {
    const periodo = empresaId ? await this.periodosService.findAtivo(empresaId) : null;
    if (periodo) return { startDate: periodo.startDate, endDate: periodo.endDate };
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    return { startDate, endDate };
  }

  private async validateBalance(userId: number, hoursRequested: number): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuário não encontrado');
    const { startDate, endDate } = await this.getActivePeriodRange(user.empresaId);

    const records = await this.hourRecordRepository.find({
      where: { userId, date: Between(startDate, endDate) },
    });
    const saidas = records.filter(r => r.type === RecordType.SAIDA);
    const nightMultiplier = await this.getNightMultiplier();
    const hourlyRate = 0; // não precisamos do valor financeiro aqui
    const bruto = computeGross(saidas, hourlyRate, nightMultiplier);

    // Para validação do colaborador: conta PENDENTE + APROVADO (evita duplo pedido)
    const existingRequests = await this.requestRepository.find({
      where: { userId, status: In([RequestStatus.PENDENTE, RequestStatus.APROVADO]) },
    });
    const alreadyCommitted = existingRequests.reduce((sum, r) => sum + Number(r.hoursAmount), 0);

    const { disponivel } = deductFromTiers(bruto, alreadyCommitted, hourlyRate, nightMultiplier);
    const available = disponivel.totalExtra;

    if (hoursRequested > available) {
      throw new BadRequestException(
        `Saldo insuficiente. Disponível: ${available}h, solicitado: ${hoursRequested}h`,
      );
    }
  }

  async findAll(): Promise<Request[]> {
    const requests = await this.requestRepository.find({
      relations: ['user', 'reviewer'],
      order: { createdAt: 'DESC' },
    });
    requests.forEach(r => {
      if (r.user) delete r.user.password;
      if (r.reviewer) delete r.reviewer.password;
    });
    return requests;
  }

  async findByUser(userId: number): Promise<Request[]> {
    const requests = await this.requestRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
    return requests;
  }

  async findPending(): Promise<Request[]> {
    return this.requestRepository.find({
      where: { status: RequestStatus.PENDENTE },
      relations: ['user'],
      order: { createdAt: 'ASC' },
    });
  }

  async findOne(id: number): Promise<Request> {
    const request = await this.requestRepository.findOne({
      where: { id },
      relations: ['user', 'reviewer'],
    });
    if (!request) throw new NotFoundException('Solicitação não encontrada');
    
    // Remove senha dos objetos relacionados
    if (request.user) delete request.user.password;
    if (request.reviewer) delete request.reviewer.password;
    
    return request;
  }

  async review(id: number, reviewerId: number, dto: ReviewRequestDto): Promise<Request> {
    const request = await this.requestRepository.findOne({ where: { id } });
    
    if (!request) throw new NotFoundException('Solicitação não encontrada');

    if (request.status !== RequestStatus.PENDENTE) {
      throw new BadRequestException('Esta solicitação já foi analisada');
    }

    request.status = dto.status;
    request.reviewerId = reviewerId;
    request.reviewerComment = dto.reviewerComment;
    request.reviewedAt = new Date();

    const saved = await this.requestRepository.save(request);
    return this.findOne(saved.id);
  }

  async cancel(id: number, userId: number): Promise<Request> {
    const request = await this.findOne(id);

    if (request.userId !== userId) {
      throw new ForbiddenException('Você não pode cancelar esta solicitação');
    }

    if (request.status !== RequestStatus.PENDENTE) {
      throw new BadRequestException('Só é possível cancelar solicitações pendentes');
    }

    request.status = RequestStatus.CANCELADO;
    request.reviewerComment = 'Cancelado pelo colaborador';
    request.reviewedAt = new Date();

    return this.requestRepository.save(request);
  }

  async getRequestWithBalance(requestId: number) {
    const request = await this.requestRepository.findOne({
      where: { id: requestId },
      relations: ['user'],
    });

    if (!request) throw new NotFoundException('Solicitação não encontrada');

    const user = await this.userRepository.findOne({
      where: { id: request.userId },
    });

    if (!user) throw new NotFoundException('Usuário não encontrado');

    const { startDate, endDate } = await this.getActivePeriodRange(user.empresaId);

    const records = await this.hourRecordRepository.find({
      where: { userId: request.userId, date: Between(startDate, endDate) },
    });

    const saidas = records.filter(r => r.type === RecordType.SAIDA);
    const hourlyRate = Number(user.hourlyRate ?? 0);
    const nightMultiplier = await this.getNightMultiplier();

    const bruto = computeGross(saidas, hourlyRate, nightMultiplier);

    // Para o RH: conta apenas APROVADOS (não PENDENTES) — mostra saldo real já confirmado
    const approvedRequests = await this.requestRepository.find({
      where: { userId: request.userId, status: RequestStatus.APROVADO },
    });
    const committed = approvedRequests.reduce((sum, r) => sum + Number(r.hoursAmount), 0);

    const { disponivel } = deductFromTiers(bruto, committed, hourlyRate, nightMultiplier);

    return {
      request,
      collaboratorBalance: {
        name: user.name,
        department: user.department,
        position: user.position,
        hourlyRate: +hourlyRate.toFixed(2),
        totalExtraHours: disponivel.totalExtra,
        extraHours50: disponivel.h50,
        extraHours60: disponivel.h60,
        extraHours100: disponivel.h100,
        nightHours: disponivel.nightHours,
        financialSummary: {
          extra50Value: disponivel.financeiro.v50,
          extra60Value: disponivel.financeiro.v60,
          extra100Value: disponivel.financeiro.v100,
          nightValue: disponivel.financeiro.vNight,
          totalValue: disponivel.financeiro.total,
        },
      },
    };
  }
}
