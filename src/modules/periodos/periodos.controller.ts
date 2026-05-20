import {
  Controller, Get, Post, Patch, Body, Param, ParseIntPipe,
  UseGuards, Req,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { PeriodosService } from './periodos.service';
import { CreatePeriodoDto } from './dto/create-periodo.dto';
import { AmendPeriodoDto } from './dto/amend-periodo.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@ApiTags('Periodos')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('periodos')
export class PeriodosController {
  constructor(private readonly periodosService: PeriodosService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.RH)
  @ApiOperation({ summary: 'Lista todos os períodos da empresa' })
  findAll(@CurrentUser() user: User) {
    return this.periodosService.findAll(user.empresaId);
  }

  @Get('ativo')
  @ApiOperation({ summary: 'Período ativo da empresa (todos autenticados)' })
  findAtivo(@CurrentUser() user: User) {
    return this.periodosService.findAtivo(user.empresaId);
  }

  @Get('me/saldo-anterior')
  @ApiOperation({ summary: 'Saldo do período anterior para o colaborador logado' })
  mySaldoAnterior(@CurrentUser() user: User) {
    return this.periodosService.getPreviousBalance(user.id, user.empresaId);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.RH)
  @ApiOperation({ summary: 'Detalhes de um período' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.periodosService.findOne(id);
  }

  @Get(':id/relatorio')
  @Roles(UserRole.ADMIN, UserRole.RH)
  @ApiOperation({ summary: 'Relatório congelado de um período fechado' })
  getRelatorio(@Param('id', ParseIntPipe) id: number) {
    return this.periodosService.getRelatorio(id);
  }

  @Get(':id/saldos')
  @Roles(UserRole.ADMIN, UserRole.RH)
  @ApiOperation({ summary: 'Saldos individuais de todos os colaboradores em um período' })
  getSaldos(@Param('id', ParseIntPipe) id: number) {
    return this.periodosService.getSaldos(id);
  }

  @Get(':id/emendas')
  @Roles(UserRole.ADMIN, UserRole.RH)
  @ApiOperation({ summary: 'Log de emendas de um período fechado' })
  getAmendments(@Param('id', ParseIntPipe) id: number) {
    return this.periodosService.getAmendments(id);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Criar novo período (Admin)' })
  create(@Body() dto: CreatePeriodoDto, @CurrentUser() user: User) {
    return this.periodosService.create(dto, user.id, user.empresaId);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Atualizar período ativo (Admin)' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: Partial<CreatePeriodoDto>) {
    return this.periodosService.update(id, dto);
  }

  @Post(':id/fechar')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Fechar período e gerar relatório de fechamento (Admin)' })
  fechar(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    return this.periodosService.fechar(id, user.id);
  }

  @Post(':id/emendar')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Corrigir registro em período fechado — emenda com auditoria (Admin)' })
  amend(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AmendPeriodoDto,
    @CurrentUser() user: User,
  ) {
    return this.periodosService.amend(id, dto, user.id);
  }
}
