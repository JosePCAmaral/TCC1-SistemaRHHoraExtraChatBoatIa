import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { ChatMessage, MessageRole } from './entities/chat-message.entity';
import { ChatDto } from './dto/chat.dto';
import { User } from '../users/entities/user.entity';
import { HourRecord, RecordType } from '../hours/entities/hour-record.entity';
import { Request, RequestStatus, RequestType } from '../requests/entities/request.entity';
import { ParametersService } from '../parameters/parameters.service';
import { localDateString } from '../../common/utils/date.utils';

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
    private parametersService: ParametersService,
  ) {
    this.ollamaUrl = this.configService.get<string>('OLLAMA_URL') ?? 'http://ollama:11434';
    this.model = this.configService.get<string>('OLLAMA_MODEL') ?? 'llama3.2';
  }

  async chat(userId: number, dto: ChatDto): Promise<{ response: string; sessionId: string }> {
    const sessionId = dto.sessionId ?? `session-${userId}-${Date.now()}`;

    const [context, history] = await Promise.all([
      this.buildUserContext(userId),
      this.chatMessageRepository.find({
        where: { userId, sessionId },
        order: { createdAt: 'ASC' },
        take: 10,
      }),
    ]);

    const systemPrompt = this.buildSystemPrompt(context);

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
            temperature: 0.2,
            num_predict: 600,
          },
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Ollama error: ${error}`);
      }

      const data = await response.json() as any;
      const responseText = data.message?.content ?? 'Desculpe, não consegui processar sua mensagem.';

      // Salva ambas as mensagens somente após resposta bem-sucedida
      await this.chatMessageRepository.save([
        this.chatMessageRepository.create({
          userId,
          sessionId,
          role: MessageRole.USER,
          content: dto.message,
        }),
        this.chatMessageRepository.create({
          userId,
          sessionId,
          role: MessageRole.ASSISTANT,
          content: responseText,
        }),
      ]);

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

    const today = localDateString();
    const firstDayOfMonth = today.substring(0, 7) + '-01';

    const [monthRecords, todayRecords, allRequests, cltRules] = await Promise.all([
      this.hourRecordRepository.find({
        where: { userId, date: Between(firstDayOfMonth, today) },
      }),
      this.hourRecordRepository.find({
        where: { userId, date: today },
        order: { time: 'ASC' },
      }),
      // Busca TODOS os requerimentos para calcular saldo correto
      this.requestRepository.find({
        where: { userId },
        order: { createdAt: 'DESC' },
      }),
      this.getCltRulesForPrompt(),
    ]);

    const saidas = monthRecords.filter(r => r.type === RecordType.SAIDA);
    const totalExtra50Raw = saidas.reduce((sum, r) => sum + Number(r.extraHours50), 0);
    const totalExtra60Raw = saidas.reduce((sum, r) => sum + Number((r as any).extraHours60 ?? 0), 0);
    const totalExtra100Raw = saidas.reduce((sum, r) => sum + Number(r.extraHours100), 0);
    const totalRegular = saidas.reduce((sum, r) => sum + Number(r.regularHours), 0);
    const totalNight = saidas.reduce((sum, r) => sum + Number(r.nightHours), 0);

    const hourlyRate = Number(user?.hourlyRate ?? 0);
    const nightMultiplier = cltRules.nightAdditional / 100;

    const pendingRequests = allRequests.filter(r => r.status === RequestStatus.PENDENTE);
    const approvedRequests = allRequests.filter(r => r.status === RequestStatus.APROVADO);

    // Horas já consumidas por requerimentos aprovados (pagamento + compensação)
    const totalApprovedHours = approvedRequests.reduce((sum, r) => sum + Number(r.hoursAmount), 0);
    const totalPaidHours = approvedRequests
      .filter(r => r.type === RequestType.PAGAMENTO)
      .reduce((sum, r) => sum + Number(r.hoursAmount), 0);
    const totalCompensatedHours = approvedRequests
      .filter(r => r.type === RequestType.COMPENSACAO)
      .reduce((sum, r) => sum + Number(r.hoursAmount), 0);

    // Deduz do saldo priorizando 100% → 60% → 50% (mesma lógica do relatório)
    let eff100 = totalExtra100Raw;
    let eff60 = totalExtra60Raw;
    let eff50 = totalExtra50Raw;
    let remaining = totalApprovedHours;
    if (remaining > 0 && eff100 > 0) { const d = Math.min(remaining, eff100); eff100 -= d; remaining -= d; }
    if (remaining > 0 && eff60 > 0)  { const d = Math.min(remaining, eff60);  eff60  -= d; remaining -= d; }
    if (remaining > 0 && eff50 > 0)  { const d = Math.min(remaining, eff50);  eff50  -= d; remaining -= d; }

    // Valores brutos (total trabalhado)
    const extra50ValueGross = +(totalExtra50Raw * hourlyRate * 1.5).toFixed(2);
    const extra60ValueGross = +(totalExtra60Raw * hourlyRate * 1.6).toFixed(2);
    const extra100ValueGross = +(totalExtra100Raw * hourlyRate * 2.0).toFixed(2);

    // Valores líquidos (saldo disponível após deduções)
    const extra50ValueNet = +(eff50 * hourlyRate * 1.5).toFixed(2);
    const extra60ValueNet = +(eff60 * hourlyRate * 1.6).toFixed(2);
    const extra100ValueNet = +(eff100 * hourlyRate * 2.0).toFixed(2);
    const nightValue = +(totalNight * hourlyRate * nightMultiplier).toFixed(2);
    const totalExtraHoursNet = +(eff50 + eff60 + eff100).toFixed(2);
    const totalExtraValueNet = +(extra50ValueNet + extra60ValueNet + extra100ValueNet).toFixed(2);
    const totalExtraValueGross = +(extra50ValueGross + extra60ValueGross + extra100ValueGross).toFixed(2);

    return {
      user: {
        name: user?.name,
        position: user?.position,
        department: user?.department,
        workStartTime: user?.workStartTime,
        workEndTime: user?.workEndTime,
        hourlyRate,
      },
      today,
      todayRecords: todayRecords.map(r => ({
        type: r.type,
        time: r.time,
        isManual: r.isManual,
      })),
      monthSummary: {
        totalRegularHours: +totalRegular.toFixed(2),
        // Brutos (total gerado no período)
        totalExtraHours50Gross: +totalExtra50Raw.toFixed(2),
        totalExtraHours60Gross: +totalExtra60Raw.toFixed(2),
        totalExtraHours100Gross: +totalExtra100Raw.toFixed(2),
        totalExtraHoursGross: +(totalExtra50Raw + totalExtra60Raw + totalExtra100Raw).toFixed(2),
        // Líquidos (saldo disponível após deduções)
        totalExtraHours50Net: +eff50.toFixed(2),
        totalExtraHours60Net: +eff60.toFixed(2),
        totalExtraHours100Net: +eff100.toFixed(2),
        totalExtraHoursNet,
        totalNightHours: +totalNight.toFixed(2),
        financialSummary: {
          extra50ValueGross, extra60ValueGross, extra100ValueGross, totalExtraValueGross,
          extra50ValueNet, extra60ValueNet, extra100ValueNet, nightValue, totalExtraValueNet,
        },
      },
      requests: {
        totalApprovedHours: +totalApprovedHours.toFixed(2),
        totalPaidHours: +totalPaidHours.toFixed(2),
        totalCompensatedHours: +totalCompensatedHours.toFixed(2),
        pending: pendingRequests.slice(0, 5).map(r => ({
          id: r.id,
          type: r.type === RequestType.COMPENSACAO ? 'Compensação' : 'Pagamento',
          hours: Number(r.hoursAmount),
          referenceDate: r.referenceDate,
        })),
        approved: approvedRequests.slice(0, 5).map(r => ({
          id: r.id,
          type: r.type === RequestType.COMPENSACAO ? 'Compensação' : 'Pagamento',
          hours: Number(r.hoursAmount),
          referenceDate: r.referenceDate,
        })),
      },
      cltRules,
    };
  }

  private async getCltRulesForPrompt() {
    const [extraNormal, extraDomingo, acordoMin, tolerance, nightAdditional, dailyHours, weeklyHours] =
      await Promise.all([
        this.parametersService.getValue('HORA_EXTRA_NORMAL', undefined, '50'),
        this.parametersService.getValue('HORA_EXTRA_DOMINGO_FERIADO', undefined, '100'),
        this.parametersService.getValue('HORA_EXTRA_ACORDO_COLETIVO_MIN', undefined, '60'),
        this.parametersService.getValue('TOLERANCIA_MINUTOS', undefined, '10'),
        this.parametersService.getValue('ADICIONAL_NOTURNO', undefined, '20'),
        this.parametersService.getValue('JORNADA_DIARIA_HORAS', undefined, '8'),
        this.parametersService.getValue('JORNADA_SEMANAL_HORAS', undefined, '44'),
      ]);

    return {
      extraNormal: Number(extraNormal) || 50,
      extraDomingo: Number(extraDomingo) || 100,
      acordoMin: Number(acordoMin) || 60,
      tolerance: Number(tolerance) || 10,
      nightAdditional: Number(nightAdditional) || 20,
      dailyHours: Number(dailyHours) || 8,
      weeklyHours: Number(weeklyHours) || 44,
    };
  }

  private buildSystemPrompt(context: any): string {
    const { user, today, todayRecords, monthSummary, requests, cltRules } = context;
    const { financialSummary } = monthSummary;

    const todaySection = todayRecords.length === 0
      ? 'Nenhum registro hoje.'
      : todayRecords.map((r: any) => `  ${r.type === 'entrada' ? 'Entrada' : 'Saída'}: ${r.time}${r.isManual ? ' (manual)' : ''}`).join('\n');

    const pendingSection = requests.pending.length === 0
      ? 'Nenhum requerimento pendente.'
      : requests.pending.map((r: any) => `  #${r.id} | ${r.type} | ${r.hours}h | ref: ${r.referenceDate}`).join('\n');

    const approvedSection = requests.approved.length === 0
      ? 'Nenhum requerimento aprovado.'
      : requests.approved.map((r: any) => `  #${r.id} | ${r.type} | ${r.hours}h | ref: ${r.referenceDate}`).join('\n');

    const hasAcordo = cltRules.acordoMin > 50;
    const hasDeductions = requests.totalApprovedHours > 0;

    return `Você é o RHIANA, assistente de RH da empresa. Especialista em CLT e nos dados deste colaborador.

IDENTIDADE:
- Responda sempre em português brasileiro.
- Seja direto e objetivo. Máximo 5 linhas por resposta.
- Use APENAS os dados abaixo. Nunca invente valores.
- Se não souber algo, oriente o colaborador a contatar o RH.

REGRA CRÍTICA SOBRE VALORES:
- O colaborador pode ter requerimentos de pagamento/compensação já aprovados que ABATAM o saldo de horas extras.
- Ao informar horas extras ou valores a receber, use SEMPRE os valores do SALDO LÍQUIDO (após deduções).
- Nunca informe o total bruto como valor a receber se houver deduções de requerimentos aprovados.

COLABORADOR:
- Nome: ${user.name ?? 'Colaborador'}
- Cargo: ${user.position ?? 'Não informado'}
- Departamento: ${user.department ?? 'Não informado'}
- Jornada: ${user.workStartTime ?? '08:00'} às ${user.workEndTime ?? '17:00'} (${cltRules.dailyHours}h/dia, ${cltRules.weeklyHours}h/semana)
- Valor hora: R$ ${user.hourlyRate.toFixed(2)}

REGISTROS DE HOJE (${today}):
${todaySection}

HORAS EXTRAS BRUTAS (total gerado no mês, antes de deduções):
- Extras 50%: ${monthSummary.totalExtraHours50Gross}h → R$ ${financialSummary.extra50ValueGross}
${monthSummary.totalExtraHours60Gross > 0 ? `- Extras ${cltRules.acordoMin}% (acordo coletivo): ${monthSummary.totalExtraHours60Gross}h → R$ ${financialSummary.extra60ValueGross}\n` : ''}- Extras 100% (dom/feriado): ${monthSummary.totalExtraHours100Gross}h → R$ ${financialSummary.extra100ValueGross}
- Horas noturnas: ${monthSummary.totalNightHours}h → R$ ${financialSummary.nightValue}
- TOTAL BRUTO: ${monthSummary.totalExtraHoursGross}h | R$ ${financialSummary.totalExtraValueGross}

DEDUÇÕES DE REQUERIMENTOS APROVADOS:
${hasDeductions
  ? `- Horas já pagas: ${requests.totalPaidHours}h | Horas já compensadas: ${requests.totalCompensatedHours}h
- Total deduzido do saldo: ${requests.totalApprovedHours}h`
  : '- Nenhuma dedução (sem requerimentos aprovados).'}

SALDO LÍQUIDO DISPONÍVEL (use estes valores ao responder sobre o que o colaborador tem a receber):
- Extras 50%: ${monthSummary.totalExtraHours50Net}h → R$ ${financialSummary.extra50ValueNet}
${monthSummary.totalExtraHours60Net > 0 ? `- Extras ${cltRules.acordoMin}%: ${monthSummary.totalExtraHours60Net}h → R$ ${financialSummary.extra60ValueNet}\n` : ''}- Extras 100%: ${monthSummary.totalExtraHours100Net}h → R$ ${financialSummary.extra100ValueNet}
- SALDO TOTAL: ${monthSummary.totalExtraHoursNet}h | VALOR DISPONÍVEL: R$ ${financialSummary.totalExtraValueNet}

REQUERIMENTOS PENDENTES:
${pendingSection}

REQUERIMENTOS APROVADOS (recentes):
${approvedSection}

REGRAS CLT APLICÁVEIS:
- Jornada: ${cltRules.dailyHours}h/dia, ${cltRules.weeklyHours}h/semana (Art. 58 CLT)
- Tolerância: ${cltRules.tolerance} min/dia (Art. 58 §1º CLT)
- Hora extra dias úteis: +${cltRules.extraNormal}% (Art. 59 §1º CLT)
${hasAcordo ? `- Acordo coletivo: +${cltRules.acordoMin}%\n` : ''}- Hora extra dom/feriado: +${cltRules.extraDomingo}% (Art. 70 CLT)
- Adicional noturno (22h-5h): +${cltRules.nightAdditional}% (Art. 73 CLT)`;
  }
}
