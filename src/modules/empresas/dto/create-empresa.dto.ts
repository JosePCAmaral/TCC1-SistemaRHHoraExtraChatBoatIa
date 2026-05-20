import { IsString, IsOptional, IsEmail, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateEmpresaDto {
  @ApiProperty({ example: 'ACME Tecnologia Ltda', description: 'Razão social da empresa' })
  @IsString()
  razaoSocial: string;

  @ApiPropertyOptional({ example: 'ACME Tech', description: 'Nome fantasia' })
  @IsString()
  @IsOptional()
  nomeFantasia?: string;

  @ApiProperty({ example: '12.345.678/0001-90', description: 'CNPJ no formato 00.000.000/0000-00' })
  @IsString()
  @Matches(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/, { message: 'CNPJ inválido. Use o formato 00.000.000/0000-00' })
  cnpj: string;

  @ApiPropertyOptional({ example: 'contato@empresa.com' })
  @IsEmail({}, { message: 'Email inválido' })
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ example: '(43) 3333-4444' })
  @IsString()
  @IsOptional()
  telefone?: string;

  @ApiPropertyOptional({ example: 'Rua das Flores, 123, Londrina-PR' })
  @IsString()
  @IsOptional()
  endereco?: string;

  @ApiPropertyOptional({ example: 'https://empresa.com/logo.png', description: 'URL do logotipo' })
  @IsString()
  @IsOptional()
  logo?: string;
}
