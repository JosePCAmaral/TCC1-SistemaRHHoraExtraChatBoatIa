import { Controller, Get, Param, Query, ParseIntPipe, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery, ApiParam } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole, User } from '../users/entities/user.entity';

@ApiTags('Reports')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('dashboard')
  @Roles(UserRole.ADMIN, UserRole.RH)
  @ApiOperation({ summary: 'Dashboard geral (RH/Admin)', description: 'Retorna indicadores gerais do sistema.' })
  @ApiResponse({ status: 200, description: 'Dashboard retornado com sucesso' })
  getDashboard() {
    return this.reportsService.getDashboard();
  }

  @Get('individual/me')
  @ApiOperation({ summary: 'Meu relatório individual' })
  @ApiQuery({ name: 'startDate', example: '2026-05-01' })
  @ApiQuery({ name: 'endDate', example: '2026-05-31' })
  @ApiResponse({ status: 200, description: 'Relatório individual retornado' })
  getMyReport(
    @CurrentUser() user: User,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.reportsService.getIndividualReport(user.id, startDate, endDate);
  }

  @Get('individual/:userId')
  @Roles(UserRole.ADMIN, UserRole.RH)
  @ApiOperation({ summary: 'Relatório individual por colaborador (RH/Admin)' })
  @ApiParam({ name: 'userId', example: 1 })
  @ApiQuery({ name: 'startDate', example: '2026-05-01' })
  @ApiQuery({ name: 'endDate', example: '2026-05-31' })
  @ApiResponse({ status: 200, description: 'Relatório retornado' })
  @ApiResponse({ status: 404, description: 'Colaborador não encontrado' })
  getIndividualReport(
    @Param('userId', ParseIntPipe) userId: number,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.reportsService.getIndividualReport(userId, startDate, endDate);
  }

  @Get('collective')
  @Roles(UserRole.ADMIN, UserRole.RH)
  @ApiOperation({ summary: 'Relatório coletivo de todos os colaboradores (RH/Admin)' })
  @ApiQuery({ name: 'startDate', example: '2026-05-01' })
  @ApiQuery({ name: 'endDate', example: '2026-05-31' })
  @ApiResponse({ status: 200, description: 'Relatório coletivo retornado' })
  getCollectiveReport(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.reportsService.getCollectiveReport(startDate, endDate);
  }

  @Get('department')
  @Roles(UserRole.ADMIN, UserRole.RH)
  @ApiOperation({ summary: 'Relatório por departamento (RH/Admin)' })
  @ApiQuery({ name: 'department', example: 'Tecnologia' })
  @ApiQuery({ name: 'startDate', example: '2026-05-01' })
  @ApiQuery({ name: 'endDate', example: '2026-05-31' })
  @ApiResponse({ status: 200, description: 'Relatório por departamento retornado' })
  getDepartmentReport(
    @Query('department') department: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.reportsService.getDepartmentReport(department, startDate, endDate);
  }
}
