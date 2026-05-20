import { IsString, IsNotEmpty, IsNumber, IsOptional, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AmendPeriodoDto {
  @ApiProperty({ example: 1, description: 'ID do colaborador a corrigir' })
  @IsNumber()
  userId: number;

  @ApiProperty({ example: '2026-05-10' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Data inválida. Use YYYY-MM-DD' })
  date: string;

  @ApiProperty({ example: '08:00' })
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'Hora inválida. Use HH:MM' })
  time: string;

  @ApiProperty({ example: 'entrada', enum: ['entrada', 'saida'] })
  @IsString()
  @IsNotEmpty()
  type: string;

  @ApiPropertyOptional({ example: 'util', enum: ['util', 'sabado', 'domingo', 'feriado'] })
  @IsString()
  @IsOptional()
  dayType?: string;

  @ApiPropertyOptional({ example: 'Esqueceu de bater ponto' })
  @IsString()
  @IsOptional()
  observation?: string;

  @ApiProperty({ example: 'Colaborador esqueceu de registrar entrada no dia 10/05' })
  @IsString()
  @IsNotEmpty()
  description: string;
}
