import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In } from 'typeorm';
import { Request, RequestStatus } from './entities/request.entity';
import { CreateRequestDto } from './dto/create-request.dto';
import { ReviewRequestDto } from './dto/review-request.dto';
import { User } from '../users/entities/user.entity';
import { HourRecord, RecordType } from '../hours/entities/hour-record.entity';
import { ParametersService } from '../parameters/parameters.service';

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

  private async validateBalance(userId: number, hoursRequested: number): Promise<void> {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const records = await this.hourRecordRepository.find({
      where: { userId, date: Between(startDate, endDate) },
    });
    const saidas = records.filter(r => r.type === RecordType.SAIDA);
    const totalAvailable = saidas.reduce(
      (sum, r) =>
        sum +
        Number(r.extraHours50) +
        Number((r as any).extraHours60 ?? 0) +
        Number(r.extraHours100),
      0,
    );

    const existingRequests = await this.requestRepository.find({
      where: { userId, status: In([RequestStatus.PENDENTE, RequestStatus.APROVADO]) },
    });
    const alreadyRequested = existingRequests.reduce((sum, r) => sum + Number(r.hoursAmount), 0);

    const available = +(totalAvailable - alreadyRequested).toFixed(2);
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

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const records = await this.hourRecordRepository.find({
      where: { userId: request.userId, date: Between(startDate, endDate) },
    });

    const saidas = records.filter(r => r.type === RecordType.SAIDA);
    const totalExtraHours50 = saidas.reduce((sum, r) => sum + Number(r.extraHours50), 0);
    const totalExtraHours60 = saidas.reduce((sum, r) => sum + Number((r as any).extraHours60 ?? 0), 0);
    const totalExtraHours100 = saidas.reduce((sum, r) => sum + Number(r.extraHours100), 0);
    const totalNightHours = saidas.reduce((sum, r) => sum + Number(r.nightHours), 0);
    const totalExtraHours = totalExtraHours50 + totalExtraHours60 + totalExtraHours100;
    const hourlyRate = Number(user.hourlyRate ?? 0);

    const nightMultiplier = await this.getNightMultiplier();
    const extra50Value = totalExtraHours50 * hourlyRate * 1.5;
    const extra60Value = totalExtraHours60 * hourlyRate * 1.6;
    const extra100Value = totalExtraHours100 * hourlyRate * 2.0;
    const nightValue = totalNightHours * hourlyRate * nightMultiplier;
    const totalValue = extra50Value + extra60Value + extra100Value + nightValue;

    return {
      request,
      collaboratorBalance: {
        name: user.name,
        department: user.department,
        position: user.position,
        hourlyRate: +hourlyRate.toFixed(2),
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
          totalValue: +totalValue.toFixed(2),
        },
      },
    };
  }
}
