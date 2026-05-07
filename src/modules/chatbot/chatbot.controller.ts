import { Controller, Post, Get, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { ChatbotService } from './chatbot.service';
import { ChatDto } from './dto/chat.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@ApiTags('Chatbot')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('chatbot')
export class ChatbotController {
  constructor(private readonly chatbotService: ChatbotService) {}

  @Post('message')
  @ApiOperation({
    summary: 'Enviar mensagem para o RHIANA',
    description: 'Envia uma mensagem para o chatbot e recebe resposta contextualizada com os dados do colaborador.',
  })
  @ApiResponse({
    status: 201,
    description: 'Resposta gerada com sucesso',
    schema: {
      example: {
        response: 'Olá João! Você tem 3.5h de horas extras este mês, sendo 2h com adicional de 50% e 1.5h com adicional de 100%.',
        sessionId: 'session-1-1715123456789',
      },
    },
  })
  sendMessage(@CurrentUser() user: User, @Body() dto: ChatDto) {
    return this.chatbotService.chat(user.id, dto);
  }

  @Get('sessions')
  @ApiOperation({ summary: 'Listar minhas sessões de chat' })
  getSessions(@CurrentUser() user: User) {
    return this.chatbotService.getSessions(user.id);
  }

  @Get('history/:sessionId')
  @ApiOperation({ summary: 'Histórico de uma sessão' })
  @ApiParam({ name: 'sessionId', example: 'session-1-1715123456789' })
  getHistory(@CurrentUser() user: User, @Param('sessionId') sessionId: string) {
    return this.chatbotService.getHistory(user.id, sessionId);
  }

  @Delete('session/:sessionId')
  @ApiOperation({ summary: 'Encerrar sessão de chat' })
  @ApiParam({ name: 'sessionId', example: 'session-1-1715123456789' })
  clearSession(@CurrentUser() user: User, @Param('sessionId') sessionId: string) {
    return this.chatbotService.clearSession(user.id, sessionId);
  }
}
