import { IsString, IsDateString, IsOptional, IsInt } from 'class-validator';

export class CreateFeriadoDto {
  @IsDateString()
  date: string;

  @IsString()
  description: string;

  @IsOptional()
  @IsInt()
  empresaId?: number | null;
}
