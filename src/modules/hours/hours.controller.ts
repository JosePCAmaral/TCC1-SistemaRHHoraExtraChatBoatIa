import { Controller, Post, Body, UseGuards, Req, Get, Param, Query } from '@nestjs/common';
import { UserRole, User } from '../users/entities/user.entity';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { HoursService } from './hours.service';
import { ClockInDto } from './dto/clock-in.dto';
import { ManualRecordDto } from './dto/manual-record.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

@ApiTags('Horas')
@ApiBearerAuth('JWT-auth')
@Controller('hours')
export class HoursController {
  constructor(private readonly hoursService: HoursService) {}

  @Post('clock')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Bater ponto (entrada/saída) automático' })
  async clockIn(@Req() req, @Body() dto: ClockInDto) {
    return this.hoursService.clockIn(req.user.id, dto, req.ip);
  }

  @Post('manual')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.RH)
  @ApiOperation({ summary: 'Registrar ponto manual (RH/Admin)' })
  async manual(@Body() dto: ManualRecordDto) {
    return this.hoursService.manualRecord(dto);
  }

  @Get('me/today')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Meus registros de hoje' })
  async myToday(@Req() req) {
    return this.hoursService.getTodayRecords(req.user.id);
  }

  @Get('all/today')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.RH)
  @ApiOperation({ summary: 'Todos os registros de hoje (RH/Admin)' })
  async allToday() {
    return this.hoursService.getAllTodayRecords();
  }

  @Get('user/:id/period')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.RH)
  @ApiOperation({ summary: 'Registros de um colaborador por período' })
  async byUserPeriod(@Param('id') id: number, @Query('start') start: string, @Query('end') end: string) {
    return this.hoursService.findByUserAndPeriod(Number(id), start, end);
  }

  @Get('user/:id/summary')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.RH)
  @ApiOperation({ summary: 'Resumo mensal de um colaborador' })
  async summary(@Param('id') id: number, @Query('year') year: number, @Query('month') month: number) {
    return this.hoursService.getMonthlySummary(Number(id), Number(year), Number(month));
  }
}
