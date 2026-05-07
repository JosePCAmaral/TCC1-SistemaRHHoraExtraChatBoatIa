import { IsString, IsEnum, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ParameterType } from '../entities/parameter.entity';

export class CreateParameterDto {
  @ApiProperty({ example: 'HORA_EXTRA_NORMAL', description: 'Chave única do parâmetro' })
  @IsString()
  key: string;

  @ApiProperty({ example: '50', description: 'Valor do parâmetro' })
  @IsString()
  value: string;

  @ApiProperty({ example: 'Percentual de hora extra em dias úteis (Art. 59 CLT)' })
  @IsString()
  description: string;

  @ApiPropertyOptional({ enum: ParameterType, default: ParameterType.CONFIGURACAO })
  @IsEnum(ParameterType)
  @IsOptional()
  type?: ParameterType;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  active?: boolean;
}
