import { IsString, IsEnum, IsOptional, IsBoolean } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ParameterType } from '../entities/parameter.entity';

export class UpdateParameterDto {
  @ApiPropertyOptional({ example: '60' })
  @IsString()
  @IsOptional()
  value?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ enum: ParameterType })
  @IsEnum(ParameterType)
  @IsOptional()
  type?: ParameterType;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  active?: boolean;
}
