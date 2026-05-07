import { IsEnum, IsString, IsNumber, Min, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { RequestType } from '../entities/request.entity';

export class CreateRequestDto {
  @ApiProperty({ enum: RequestType, description: 'Tipo: compensacao ou pagamento' })
  @IsEnum(RequestType)
  type: RequestType;

  @ApiProperty({ example: '2026-05-01', description: 'Data de referência das horas (YYYY-MM-DD)' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Data inválida. Use YYYY-MM-DD' })
  referenceDate: string;

  @ApiProperty({ example: 2.5, description: 'Quantidade de horas a solicitar' })
  @IsNumber()
  @Min(0.5, { message: 'Mínimo de 0.5 hora' })
  hoursAmount: number;

  @ApiProperty({ example: 'Trabalhei além do horário no dia 01/05 devido à entrega do projeto X.' })
  @IsString()
  justification: string;
}
