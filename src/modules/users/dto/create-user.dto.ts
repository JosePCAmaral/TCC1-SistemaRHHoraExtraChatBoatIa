import { IsEmail, IsEnum, IsInt, IsOptional, IsString, MinLength, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '../entities/user.entity';

export class CreateUserDto {
  @ApiProperty({ example: 'João Silva', description: 'Nome completo do colaborador' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'joao@empresa.com', description: 'Email institucional' })
  @IsEmail({}, { message: 'Email inválido' })
  email: string;

  @ApiProperty({ example: 'Senha@123', description: 'Senha com mínimo de 6 caracteres' })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiPropertyOptional({ enum: UserRole, default: UserRole.COLABORADOR, description: 'Perfil de acesso' })
  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole;

  @ApiPropertyOptional({ example: '(43) 99999-9999' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ example: '000.000.000-00', description: 'CPF no formato 000.000.000-00' })
  @IsString()
  @IsOptional()
  @Matches(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/, { message: 'CPF inválido. Use o formato 000.000.000-00' })
  cpf?: string;

  @ApiPropertyOptional({ example: 'Tecnologia' })
  @IsString()
  @IsOptional()
  department?: string;

  @ApiPropertyOptional({ example: 'Desenvolvedor' })
  @IsString()
  @IsOptional()
  position?: string;

  @ApiPropertyOptional({ example: '08:00', description: 'Horário de início da jornada (HH:MM)' })
  @IsString()
  @IsOptional()
  workStartTime?: string;

  @ApiPropertyOptional({ example: '17:00', description: 'Horário de fim da jornada (HH:MM)' })
  @IsString()
  @IsOptional()
  workEndTime?: string;

  @ApiPropertyOptional({ example: 25.50, description: 'Valor da hora trabalhada em reais' })
  @IsOptional()
  hourlyRate?: number;

  @ApiPropertyOptional({ example: 1, description: 'ID da empresa à qual o colaborador pertence' })
  @IsInt()
  @IsOptional()
  empresaId?: number;
}
