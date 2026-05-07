import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { ChatMessage, MessageRole } from './entities/chat-message.entity';
import { ChatDto } from './dto/chat.dto';
import { User } from '../users/entities/user.entity';
import { HourRecord, RecordType } from '../hours/entities/hour-record.entity';
import { Request, RequestStatus } from '../requests/entities/request.entity';

@Injectable()
export class ChatbotService {
  private genAI: GoogleGenerativeAI;

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
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  async chat(userId: number, dto: ChatDto): Promise<{ response: string; sessionId: string }> {
    const sessionId = dto.sessionId ?? `session-${userId}-${Date.now()}`;

    // Busca contexto do colaborador
    const context = await this.buildUserContext(userId);

    // Busca histórico da sessão (últimas 10 mensagens)
    const history = await this.chatMessageRepository.find({
      where: { userId, sessionId },
      order: { createdAt: 'ASC' },
      take: 10,
    });

    // Salva mensagem do usuário
    await this.chatMessageRepository.save(
      this.chatMessageRepository.create({
        userId,
        sessionId,
        role: MessageRole.USER,
        content: dto.message,
      }),
    );

    // Monta o prompt com contexto
    const systemPrompt = this.buildSystemPrompt(context);

    try {
      const model = this.genAI.getGenerativeModel({
        model: 'gemini-1.5-flash',
        systemInstruction: systemPrompt,
      });

      // Monta histórico no formato Gemini
      const geminiHistory = history.map(msg => ({
        role: msg.role === MessageRole.USER ? 'user' : 'model',
        parts: [{ text: msg.content }],
      }));

      const chat = model.startChat({ history: geminiHistory });
      const result = await chat.sendMessage(dto.message);
      const responseText = result.response.text();

      // Salva resposta do assistente
      await this.chatMessageRepository.save(
        this.chatMessageRepository.create({
          userId,
          sessionId,
          role: MessageRole.ASSISTANT,
          content: responseText,
        }),
      );

      return { response: responseText, sessionId };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new InternalServerErrorException('Erro ao processar mensagem: ' + message);
    }
  }

  // Busca histórico de uma sessão
  async getHistory(userId: number, sessionId: string): Promise<ChatMessage[]> {
    return this.chatMessageRepository.find({
      where: { userId, sessionId },
      order: { createdAt: 'ASC' },
    });
  }

  // Lista sessões do usuário
  async getSessions(userId: number): Promise<any[]> {
    const messages = await this.chatMessageRepository
      .createQueryBuilder('msg')
      .select('msg.sessionId', 'sessionId')
      .addSelect('MIN(msg.createdAt)', 'startedAt')
      .addSelect('MAX(msg.createdAt)', 'lastMessageAt')
      .addSelect('COUNT(msg.id)', 'messageCount')
      .where('msg.userId = :userId', { userId })
      .groupBy('msg.sessionId')
      .orderBy('lastMessageAt', 'DESC')
      .getRawMany();

    return messages;
  }

  // Limpa histórico de uma sessão
  async clearSession(userId: number, sessionId: string): Promise<{ message: string }> {
    await this.chatMessageRepository.delete({ userId, sessionId });
    return { message: 'Sessão encerrada com sucesso' };
  }

  // Constrói o contexto do colaborador para o prompt
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

  // Monta o system prompt com contexto do colaborador
  private buildSystemPrompt(context: any): string {
    const { user, todayRecords, monthSummary, requests } = context;
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    return `Você é o RHIANA, assistente virtual inteligente do sistema de Gestão de Recursos Humanos da empresa.
Você é especialista em legislação trabalhista brasileira (CLT) e em todos os processos internos de RH.

## IDENTIDADE
- Nome: RHIANA (Recursos Humanos com Inteligência Artificial e Análise)
- Tom: Profissional, prestativo e objetivo. Use linguagem clara e amigável.
- Idioma: Sempre responda em português brasileiro.
- Nunca invente informações. Se não souber algo, oriente o colaborador a contatar o RH.

## COLABORADOR ATUAL
- Nome: ${user?.name ?? 'Colaborador'}
- Cargo: ${user?.position ?? 'Não informado'}
- Departamento: ${user?.department ?? 'Não informado'}
- Jornada: ${user?.workStartTime ?? '08:00'} às ${user?.workEndTime ?? '17:00'}
- Perfil: ${user?.role ?? 'colaborador'}

## DADOS DO MÊS ATUAL (${now.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })})
- Horas normais trabalhadas: ${monthSummary.totalRegularHours}h
- Horas extras (50%): ${monthSummary.totalExtraHours50}h
- Horas extras (100% - domingos/feriados): ${monthSummary.totalExtraHours100}h
- Total de horas extras: ${monthSummary.totalExtraHours}h

## REGISTROS DE HOJE (${today})
${todayRecords.length === 0
  ? '- Nenhum registro de ponto hoje ainda.'
  : todayRecords.map(r => `- ${r.type === 'entrada' ? '🟢 Entrada' : '🔴 Saída'}: ${r.time}`).join('\n')}

## SOLICITAÇÕES
- Pendentes: ${requests.pending}
- Aprovadas: ${requests.approved}

## REGRAS CLT QUE VOCÊ CONHECE
- Jornada padrão: 8h/dia, 44h/semana (Art. 58 CLT)
- Tolerância de atraso/saída antecipada: até 10 minutos diários (Art. 58, §1º CLT)
- Hora extra em dias úteis e sábados: acréscimo mínimo de 50% (Art. 59, §1º CLT)
- Hora extra em domingos e feriados: acréscimo de 100% (Art. 70 CLT)
- Hora extra com acordo coletivo: pode variar entre 60% e 80%
- Intervalo mínimo para refeição: 1h para jornadas acima de 6h (Art. 71 CLT)
- Hora noturna: das 22h às 5h, com adicional de 20% (Art. 73 CLT)

## O QUE VOCÊ PODE FAZER
- Informar saldo de horas extras do mês atual
- Explicar regras da CLT de forma simples
- Orientar sobre como abrir solicitações de compensação ou pagamento
- Informar status de solicitações pendentes
- Esclarecer dúvidas sobre o sistema RHIANA
- Orientar sobre registro de ponto

## O QUE VOCÊ NÃO PODE FAZER
- Aprovar ou rejeitar solicitações (isso é função do RH)
- Alterar registros de ponto
- Acessar dados de outros colaboradores
- Fornecer informações jurídicas específicas (oriente a consultar advogado trabalhista)

Seja sempre prestativo e objetivo. Responda de forma concisa, sem enrolação.`;
  }
}
