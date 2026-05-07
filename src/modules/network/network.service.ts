import { Injectable, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NetworkIp } from './entities/network-ip.entity';
import { AccessLog, AccessStatus } from './entities/access-log.entity';
import { CreateNetworkIpDto } from './dto/create-network-ip.dto';

@Injectable()
export class NetworkService {
  constructor(
    @InjectRepository(NetworkIp)
    private networkIpRepository: Repository<NetworkIp>,
    @InjectRepository(AccessLog)
    private accessLogRepository: Repository<AccessLog>,
  ) {}

  // Valida se o IP está autorizado para bater ponto
  async validateIp(userId: number, ipAddress: string, action: string): Promise<boolean> {
    const authorizedIps = await this.networkIpRepository.find({
      where: { authorized: true },
    });

    // Se não há IPs cadastrados, permite qualquer IP (modo desenvolvimento)
    if (authorizedIps.length === 0) {
      await this.logAccess(userId, ipAddress, AccessStatus.AUTORIZADO, action, 'Nenhum IP restrito cadastrado');
      return true;
    }

    const cleanIp = this.cleanIp(ipAddress);
    const isAuthorized = authorizedIps.some(network => {
      const cleanNetworkIp = this.cleanIp(network.ipAddress);
      return cleanIp === cleanNetworkIp || cleanIp.startsWith(cleanNetworkIp);
    });

    if (isAuthorized) {
      await this.logAccess(userId, ipAddress, AccessStatus.AUTORIZADO, action, 'IP autorizado');
    } else {
      await this.logAccess(userId, ipAddress, AccessStatus.BLOQUEADO, action, 'IP não autorizado para registro de ponto');
    }

    return isAuthorized;
  }

  // Verifica e lança exceção se IP não for autorizado
  async enforceIpCheck(userId: number, ipAddress: string, action: string): Promise<void> {
    const isValid = await this.validateIp(userId, ipAddress, action);
    if (!isValid) {
      throw new ForbiddenException(
        'Registro de ponto bloqueado: seu IP não está autorizado. Contate o administrador.'
      );
    }
  }

  // CRUD de IPs autorizados
  async create(dto: CreateNetworkIpDto): Promise<NetworkIp> {
    const networkIp = this.networkIpRepository.create(dto);
    return this.networkIpRepository.save(networkIp);
  }

  async findAll(): Promise<NetworkIp[]> {
    return this.networkIpRepository.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: number): Promise<NetworkIp> {
    return this.networkIpRepository.findOne({ where: { id } });
  }

  async update(id: number, dto: Partial<CreateNetworkIpDto>): Promise<NetworkIp> {
    await this.networkIpRepository.update(id, dto);
    return this.findOne(id);
  }

  async remove(id: number): Promise<{ message: string }> {
    await this.networkIpRepository.delete(id);
    return { message: 'IP removido com sucesso' };
  }

  async toggleAuthorization(id: number): Promise<NetworkIp> {
    const ip = await this.findOne(id);
    ip.authorized = !ip.authorized;
    return this.networkIpRepository.save(ip);
  }

  // Logs de acesso
  async getLogs(limit = 50): Promise<AccessLog[]> {
    return this.accessLogRepository.find({
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async getLogsByUser(userId: number): Promise<AccessLog[]> {
    return this.accessLogRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 30,
    });
  }

  async getBlockedLogs(): Promise<AccessLog[]> {
    return this.accessLogRepository.find({
      where: { status: AccessStatus.BLOQUEADO },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  private async logAccess(
    userId: number,
    ipAddress: string,
    status: AccessStatus,
    action: string,
    reason: string,
  ): Promise<void> {
    const log = this.accessLogRepository.create({
      userId,
      ipAddress,
      status,
      action,
      reason,
    });
    await this.accessLogRepository.save(log);
  }

  private cleanIp(ip: string): string {
    // Remove ::ffff: prefix IPv6 mapped IPv4
    return ip.replace(/^::ffff:/, '').trim();
  }
}
