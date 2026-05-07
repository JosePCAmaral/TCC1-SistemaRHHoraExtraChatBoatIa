import { IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ChatDto {
  @ApiProperty({ example: 'Qual é meu saldo de horas extras?', description: 'Mensagem do usuário' })
  @IsString()
  message: string;

  @ApiPropertyOptional({ example: 'session-abc-123', description: 'ID da sessão para manter histórico' })
  @IsString()
  @IsOptional()
  sessionId?: string;
}
