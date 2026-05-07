import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Request, RequestStatus } from './entities/request.entity';
import { CreateRequestDto } from './dto/create-request.dto';
import { ReviewRequestDto } from './dto/review-request.dto';

@Injectable()
export class RequestsService {
  constructor(
    @InjectRepository(Request)
    private requestRepository: Repository<Request>,
  ) {}

  async create(userId: number, dto: CreateRequestDto): Promise<Request> {
    const request = this.requestRepository.create({
      ...dto,
      userId,
      status: RequestStatus.PENDENTE,
    });
    return this.requestRepository.save(request);
  }

  async findAll(): Promise<Request[]> {
    return this.requestRepository.find({
      relations: ['user', 'reviewer'],
      order: { createdAt: 'DESC' },
    });
  }

  async findByUser(userId: number): Promise<Request[]> {
    return this.requestRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
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
    return request;
  }

  async review(id: number, reviewerId: number, dto: ReviewRequestDto): Promise<Request> {
    const request = await this.findOne(id);

    if (request.status !== RequestStatus.PENDENTE) {
      throw new BadRequestException('Esta solicitação já foi analisada');
    }

    request.status = dto.status;
    request.reviewerId = reviewerId;
    request.reviewerComment = dto.reviewerComment;
    request.reviewedAt = new Date();

    return this.requestRepository.save(request);
  }

  async cancel(id: number, userId: number): Promise<Request> {
    const request = await this.findOne(id);

    if (request.userId !== userId) {
      throw new ForbiddenException('Você não pode cancelar esta solicitação');
    }

    if (request.status !== RequestStatus.PENDENTE) {
      throw new BadRequestException('Só é possível cancelar solicitações pendentes');
    }

    request.status = RequestStatus.REJEITADO;
    request.reviewerComment = 'Cancelado pelo colaborador';
    request.reviewedAt = new Date();

    return this.requestRepository.save(request);
  }
}
