import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { DayType } from '../entities/hour-record.entity';

export class ClockInDto {
  @ApiPropertyOptional({ example: 'Entrada normal' })
  @IsString()
  @IsOptional()
  observation?: string;

  @ApiPropertyOptional({ enum: DayType, default: DayType.UTIL })
  @IsEnum(DayType)
  @IsOptional()
  dayType?: DayType;
}
