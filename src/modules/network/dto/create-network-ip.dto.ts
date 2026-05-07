import { IsString, IsBoolean, IsOptional, IsIP } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateNetworkIpDto {
  @ApiProperty({ example: 'Escritório Principal', description: 'Nome identificador da rede' })
  @IsString()
  name: string;

  @ApiProperty({ example: '192.168.1.1', description: 'Endereço IP autorizado' })
  @IsString()
  ipAddress: string;

  @ApiPropertyOptional({ example: 'Rede principal do escritório de Cornélio Procópio' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  authorized?: boolean;
}
