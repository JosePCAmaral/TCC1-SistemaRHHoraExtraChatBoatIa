import { Controller, Post, Body, UseGuards, Req, Get, Param, Query, Patch, Delete, ParseIntPipe } from '@nestjs/common';
import { UserRole, User } from '../users/entities/user.entity';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { HoursService } from './hours.service';
import { ClockInDto } from './dto/clock-in.dto';
import { ManualRecordDto } from './dto/manual-record.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

@ApiTags('Hours')
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

  @Get('me/summary')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Meu resumo mensal (colaborador)' })
  async mySummary(@Req() req, @Query('year') year: number, @Query('month') month: number) {
    return this.hoursService.getMonthlySummary(req.user.id, Number(year), Number(month));
  }

  @Get('me/balance')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Meu saldo de horas extras (colaborador)' })
  async myBalance(@Req() req) {
    return this.hoursService.getUserMonthlyBalance(req.user.id);
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

  @Get('user/:id/balance')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.RH)
  @ApiOperation({ summary: 'Saldo mensal de horas extras do colaborador' })
  async balance(@Param('id') id: number) {
    return this.hoursService.getUserMonthlyBalance(Number(id));
  }

  @Get('all/date')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.RH)
  @ApiOperation({ summary: 'Todos registros por data (RH/Admin)' })
  getAllByDate(@Query('date') date: string) {
    return this.hoursService.getAllRecordsByDate(date);
  }

  @Get('user/:id/date')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.RH)
  @ApiOperation({ summary: 'Registros de um colaborador por data (RH/Admin)' })
  getByUserAndDate(@Param('id', ParseIntPipe) id: number, @Query('date') date: string) {
    return this.hoursService.getRecordsByUserAndDate(Number(id), date);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.RH)
  @ApiOperation({ summary: 'Atualizar registro' })
  updateRecord(@Param('id', ParseIntPipe) id: number, @Body() dto: any) {
    return this.hoursService.updateRecord(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.RH)
  @ApiOperation({ summary: 'Remover registro' })
  deleteRecord(@Param('id', ParseIntPipe) id: number) {
    return this.hoursService.deleteRecord(id);
  }
}
