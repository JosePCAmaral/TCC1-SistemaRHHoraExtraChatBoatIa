import { IsEnum, IsOptional, IsString, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RecordType, DayType } from '../entities/hour-record.entity';

export class ManualRecordDto {
  @ApiProperty({ example: 1, description: 'ID do colaborador' })
  userId: number;

  @ApiProperty({ example: '2026-05-05', description: 'Data no formato YYYY-MM-DD' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Data inválida. Use YYYY-MM-DD' })
  date: string;

  @ApiProperty({ example: '08:00', description: 'Hora no formato HH:MM' })
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'Hora inválida. Use HH:MM' })
  time: string;

  @ApiProperty({ enum: RecordType })
  @IsEnum(RecordType)
  type: RecordType;

  @ApiPropertyOptional({ enum: DayType, default: DayType.UTIL })
  @IsEnum(DayType)
  @IsOptional()
  dayType?: DayType;

  @ApiPropertyOptional({ example: 'Esqueci de bater ponto' })
  @IsString()
  @IsOptional()
  observation?: string;
}
