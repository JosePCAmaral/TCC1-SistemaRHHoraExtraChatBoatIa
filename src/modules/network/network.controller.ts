import { Controller, Get, Post, Put, Delete, Patch, Body, Param, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { NetworkService } from './network.service';
import { CreateNetworkIpDto } from './dto/create-network-ip.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole, User } from '../users/entities/user.entity';

@ApiTags('Network')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('network')
export class NetworkController {
  constructor(private readonly networkService: NetworkService) {}

  @Post('ips')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Cadastrar IP autorizado (Admin)' })
  @ApiResponse({ status: 201, description: 'IP cadastrado com sucesso' })
  create(@Body() dto: CreateNetworkIpDto) {
    return this.networkService.create(dto);
  }

  @Get('ips')
  @Roles(UserRole.ADMIN, UserRole.RH)
  @ApiOperation({ summary: 'Listar IPs autorizados (RH/Admin)' })
  @ApiResponse({ status: 200, description: 'Lista de IPs retornada' })
  findAll() {
    return this.networkService.findAll();
  }

  @Put('ips/:id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Atualizar IP autorizado (Admin)' })
  @ApiParam({ name: 'id', example: 1 })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: CreateNetworkIpDto) {
    return this.networkService.update(id, dto);
  }

  @Patch('ips/:id/toggle')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Ativar/Desativar IP (Admin)' })
  @ApiParam({ name: 'id', example: 1 })
  toggle(@Param('id', ParseIntPipe) id: number) {
    return this.networkService.toggleAuthorization(id);
  }

  @Delete('ips/:id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Remover IP autorizado (Admin)' })
  @ApiParam({ name: 'id', example: 1 })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.networkService.remove(id);
  }

  @Get('logs')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Logs de acesso (Admin)' })
  @ApiQuery({ name: 'limit', required: false, example: 50 })
  getLogs(@Query('limit') limit?: number) {
    return this.networkService.getLogs(limit);
  }

  @Get('logs/blocked')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Logs de acessos bloqueados (Admin)' })
  getBlockedLogs() {
    return this.networkService.getBlockedLogs();
  }

  @Get('logs/me')
  @ApiOperation({ summary: 'Meus logs de acesso' })
  getMyLogs(@CurrentUser() user: User) {
    return this.networkService.getLogsByUser(user.id);
  }
}
