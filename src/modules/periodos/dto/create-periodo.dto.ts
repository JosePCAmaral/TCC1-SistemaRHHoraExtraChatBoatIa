import { IsString, IsNotEmpty, Matches, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreatePeriodoDto {
  @ApiProperty({ example: 'Maio/2026' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nome: string;

  @ApiProperty({ example: '2026-05-01' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'startDate inválido. Use YYYY-MM-DD' })
  startDate: string;

  @ApiProperty({ example: '2026-05-31' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'endDate inválido. Use YYYY-MM-DD' })
  endDate: string;
}
