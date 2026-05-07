import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole, User, UserStatus } from '../users/entities/user.entity';
import { HourRecord, RecordType } from '../hours/entities/hour-record.entity';
import { Request, RequestStatus } from '../requests/entities/request.entity';
import { NetworkIp } from '../network/entities/network-ip.entity';
import { AccessLog, AccessStatus } from '../network/entities/access-log.entity';
import { ChatMessage } from '../chatbot/entities/chat-message.entity';

@ApiTags('Settings')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('settings')
export class SettingsController {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(HourRecord)
    private hourRecordRepository: Repository<HourRecord>,
    @InjectRepository(Request)
    private requestRepository: Repository<Request>,
    @InjectRepository(NetworkIp)
    private networkIpRepository: Repository<NetworkIp>,
    @InjectRepository(AccessLog)
    private accessLogRepository: Repository<AccessLog>,
    @InjectRepository(ChatMessage)
    private chatMessageRepository: Repository<ChatMessage>,
  ) {}

  @Get('admin/overview')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Visão geral do sistema (Admin)',
    description: 'Retorna estatísticas completas do sistema para o painel administrativo.',
  })
  @ApiResponse({ status: 200, description: 'Overview retornado com sucesso' })
  async getAdminOverview() {
    const today = new Date().toISOString().split('T')[0];
    const firstDayOfMonth = today.substring(0, 7) + '-01';

    const [
      totalUsers,
      activeUsers,
      inactiveUsers,
      totalRecordsToday,
      totalRequestsPending,
      totalRequestsMonth,
      totalAuthorizedIps,
      totalBlockedAccessToday,
      totalChatMessages,
    ] = await Promise.all([
      this.userRepository.count(),
      this.userRepository.count({ where: { status: UserStatus.ATIVO } }),
      this.userRepository.count({ where: { status: UserStatus.INATIVO } }),
      this.hourRecordRepository.count({ where: { date: today } }),
      this.requestRepository.count({ where: { status: RequestStatus.PENDENTE } }),
      this.requestRepository
        .createQueryBuilder('r')
        .where('r.createdAt >= :start', { start: firstDayOfMonth })
        .getCount(),
      this.networkIpRepository.count({ where: { authorized: true } }),
      this.accessLogRepository
        .createQueryBuilder('log')
        .where('log.status = :status', { status: AccessStatus.BLOQUEADO })
        .andWhere('DATE(log.createdAt) = :today', { today })
        .getCount(),
      this.chatMessageRepository.count(),
    ]);

    const recentBlockedAccess = await this.accessLogRepository.find({
      where: { status: AccessStatus.BLOQUEADO },
      order: { createdAt: 'DESC' },
      take: 5,
    });

    return {
      system: {
        version: '1.0.0',
        name: 'RHIANA',
        description: 'Sistema Web de Gestão de RH com IA',
        uptime: process.uptime(),
        environment: process.env.NODE_ENV,
      },
      users: {
        total: totalUsers,
        active: activeUsers,
        inactive: inactiveUsers,
      },
      pointRecords: {
        today: totalRecordsToday,
      },
      requests: {
        pending: totalRequestsPending,
        thisMonth: totalRequestsMonth,
      },
      security: {
        authorizedIps: totalAuthorizedIps,
        blockedAccessToday: totalBlockedAccessToday,
        recentBlocked: recentBlockedAccess,
      },
      chatbot: {
        totalMessages: totalChatMessages,
      },
    };
  }

  @Get('health')
  @ApiOperation({ summary: 'Health check do sistema' })
  getHealth() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '1.0.0',
    };
  }
}
