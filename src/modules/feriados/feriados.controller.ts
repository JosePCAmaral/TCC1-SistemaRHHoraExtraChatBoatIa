import { Controller, Get, Post, Put, Delete, Body, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole, User } from '../users/entities/user.entity';
import { FeriadosService } from './feriados.service';
import { CreateFeriadoDto } from './dto/create-feriado.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('feriados')
export class FeriadosController {
  constructor(private readonly feriadosService: FeriadosService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.RH)
  findAll(@CurrentUser() user: User) {
    return this.feriadosService.findAll((user as any).empresaId);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.RH)
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.feriadosService.findOne(id);
  }

  // SuperAdmin cria feriados nacionais (empresaId = null); Admin cria para sua empresa
  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  create(@CurrentUser() user: User, @Body() dto: CreateFeriadoDto) {
    const empresaId = (user as any).empresaId;
    if (empresaId) dto.empresaId = empresaId;
    return this.feriadosService.create(dto);
  }

  @Put(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: CreateFeriadoDto) {
    return this.feriadosService.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.feriadosService.remove(id);
  }
}
