import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { ChatMessage, MessageRole } from './entities/chat-message.entity';
import { ChatDto } from './dto/chat.dto';
import { User } from '../users/entities/user.entity';
import { HourRecord, RecordType } from '../hours/entities/hour-record.entity';
import { Request, RequestStatus } from '../requests/entities/request.entity';

@Injectable()
export class ChatbotService {
  private ollamaUrl: string;
  private model: string;

  constructor(
    @InjectRepository(ChatMessage)
    private chatMessageRepository: Repository<ChatMessage>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(HourRecord)
    private hourRecordRepository: Repository<HourRecord>,
    @InjectRepository(Request)
    private requestRepository: Repository<Request>,
    private configService: ConfigService,
  ) {
    this.ollamaUrl = this.configService.get<string>('OLLAMA_URL') ?? 'http://ollama:11434';
    this.model = this.configService.get<string>('OLLAMA_MODEL') ?? 'llama3.2';
  }

  async chat(userId: number, dto: ChatDto): Promise<{ response: string; sessionId: string }> {
    const sessionId = dto.sessionId ?? `session-${userId}-${Date.now()}`;

    const context = await this.buildUserContext(userId);
    const systemPrompt = this.buildSystemPrompt(context);

    const history = await this.chatMessageRepository.find({
      where: { userId, sessionId },
      order: { createdAt: 'ASC' },
      take: 10,
    });

    await this.chatMessageRepository.save(
      this.chatMessageRepository.create({
        userId,
        sessionId,
        role: MessageRole.USER,
        content: dto.message,
      }),
    );

    // Monta mensagens no formato Ollama
    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.map(msg => ({
        role: msg.role === MessageRole.USER ? 'user' : 'assistant',
        content: msg.content,
      })),
      { role: 'user', content: dto.message },
    ];

    try {
      const response = await fetch(`${this.ollamaUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          messages,
          stream: false,
          options: {
            temperature: 0.7,
            num_predict: 512,
          },
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Ollama error: ${error}`);
      }

      const data = await response.json() as any;
      const responseText = data.message?.content ?? 'Desculpe, não consegui processar sua mensagem.';

      await this.chatMessageRepository.save(
        this.chatMessageRepository.create({
          userId,
          sessionId,
          role: MessageRole.ASSISTANT,
          content: responseText,
        }),
      );

      return { response: responseText, sessionId };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new InternalServerErrorException('Erro ao processar mensagem: ' + message);
    }
  }

  async getHistory(userId: number, sessionId: string): Promise<ChatMessage[]> {
    return this.chatMessageRepository.find({
      where: { userId, sessionId },
      order: { createdAt: 'ASC' },
    });
  }

  async getSessions(userId: number): Promise<any[]> {
    return this.chatMessageRepository
      .createQueryBuilder('msg')
      .select('msg.sessionId', 'sessionId')
      .addSelect('MIN(msg.createdAt)', 'startedAt')
      .addSelect('MAX(msg.createdAt)', 'lastMessageAt')
      .addSelect('COUNT(msg.id)', 'messageCount')
      .where('msg.userId = :userId', { userId })
      .groupBy('msg.sessionId')
      .orderBy('lastMessageAt', 'DESC')
      .getRawMany();
  }

  async clearSession(userId: number, sessionId: string): Promise<{ message: string }> {
    await this.chatMessageRepository.delete({ userId, sessionId });
    return { message: 'Sessão encerrada com sucesso' };
  }

  private async buildUserContext(userId: number): Promise<any> {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    const today = new Date().toISOString().split('T')[0];
    const firstDayOfMonth = today.substring(0, 7) + '-01';

    const monthRecords = await this.hourRecordRepository.find({
      where: { userId, date: Between(firstDayOfMonth, today) },
    });

    const saidas = monthRecords.filter(r => r.type === RecordType.SAIDA);
    const totalExtra50 = saidas.reduce((sum, r) => sum + Number(r.extraHours50), 0);
    const totalExtra100 = saidas.reduce((sum, r) => sum + Number(r.extraHours100), 0);
    const totalRegular = saidas.reduce((sum, r) => sum + Number(r.regularHours), 0);

    const pendingRequests = await this.requestRepository.count({
      where: { userId, status: RequestStatus.PENDENTE },
    });

    const approvedRequests = await this.requestRepository.count({
      where: { userId, status: RequestStatus.APROVADO },
    });

    const todayRecords = await this.hourRecordRepository.find({
      where: { userId, date: today },
      order: { time: 'ASC' },
    });

    return {
      user,
      todayRecords,
      monthSummary: {
        totalRegularHours: +totalRegular.toFixed(2),
        totalExtraHours50: +totalExtra50.toFixed(2),
        totalExtraHours100: +totalExtra100.toFixed(2),
        totalExtraHours: +(totalExtra50 + totalExtra100).toFixed(2),
      },
      requests: {
        pending: pendingRequests,
        approved: approvedRequests,
      },
    };
  }

  private buildSystemPrompt(context: any): string {
    const { user, todayRecords, monthSummary, requests } = context;
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    return `Você é o RHIANA, assistente virtual inteligente do sistema de Gestão de Recursos Humanos da empresa.
Você é especialista em legislação trabalhista brasileira (CLT) e em todos os processos internos de RH.

IDENTIDADE:
- Nome: RHIANA (Recursos Humanos com Inteligência Artificial e Análise)
- Tom: Profissional, prestativo e objetivo. Use linguagem clara e amigável.
- Idioma: Sempre responda em português brasileiro.
- Nunca invente informações. Se não souber algo, oriente o colaborador a contatar o RH.

COLABORADOR ATUAL:
- Nome: ${user?.name ?? 'Colaborador'}
- Cargo: ${user?.position ?? 'Não informado'}
- Departamento: ${user?.department ?? 'Não informado'}
- Jornada: ${user?.workStartTime ?? '08:00'} às ${user?.workEndTime ?? '17:00'}

DADOS DO MÊS ATUAL:
- Horas normais trabalhadas: ${monthSummary.totalRegularHours}h
- Horas extras (50%): ${monthSummary.totalExtraHours50}h
- Horas extras (100%): ${monthSummary.totalExtraHours100}h
- Total de horas extras: ${monthSummary.totalExtraHours}h

REGISTROS DE HOJE (${today}):
${todayRecords.length === 0
  ? 'Nenhum registro de ponto hoje ainda.'
  : todayRecords.map(r => `- ${r.type === 'entrada' ? 'Entrada' : 'Saída'}: ${r.time}`).join('\n')}

SOLICITAÇÕES:
- Pendentes: ${requests.pending}
- Aprovadas: ${requests.approved}

REGRAS CLT:
- Jornada padrão: 8h/dia, 44h/semana (Art. 58 CLT)
- Tolerância: até 10 minutos diários (Art. 58 §1º CLT)
- Hora extra dias úteis/sábados: 50% (Art. 59 §1º CLT)
- Hora extra domingos/feriados: 100% (Art. 70 CLT)
- Adicional noturno 22h-5h: 20% (Art. 73 CLT)

Seja sempre prestativo e objetivo. Responda de forma concisa em português brasileiro.`;
  }
}
