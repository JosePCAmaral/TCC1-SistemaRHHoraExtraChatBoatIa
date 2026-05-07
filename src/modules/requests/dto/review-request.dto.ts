import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RequestStatus } from '../entities/request.entity';

export class ReviewRequestDto {
  @ApiProperty({ enum: [RequestStatus.APROVADO, RequestStatus.REJEITADO] })
  @IsEnum(RequestStatus)
  status: RequestStatus.APROVADO | RequestStatus.REJEITADO;

  @ApiPropertyOptional({ example: 'Aprovado conforme banco de horas do mês.' })
  @IsString()
  @IsOptional()
  reviewerComment?: string;
}
