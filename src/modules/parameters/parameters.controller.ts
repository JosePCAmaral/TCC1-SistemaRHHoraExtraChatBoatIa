import { Controller, Get, Post, Put, Delete, Body, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { ParametersService } from './parameters.service';
import { CreateParameterDto } from './dto/create-parameter.dto';
import { UpdateParameterDto } from './dto/update-parameter.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../users/entities/user.entity';
import { ParameterType } from './entities/parameter.entity';

@ApiTags('Parameters')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('parameters')
export class ParametersController {
  constructor(private readonly parametersService: ParametersService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.RH)
  @ApiOperation({ summary: 'Listar parâmetros (globais + overrides da empresa do usuário)' })
  findAll(@CurrentUser() user: any) {
    return this.parametersService.findAll(user.empresaId ?? undefined);
  }

  @Get('type/:type')
  @Roles(UserRole.ADMIN, UserRole.RH)
  @ApiOperation({ summary: 'Listar parâmetros por tipo (resolve override da empresa)' })
  @ApiParam({ name: 'type', enum: ParameterType })
  findByType(@Param('type') type: ParameterType, @CurrentUser() user: any) {
    return this.parametersService.findByType(type, user.empresaId ?? undefined);
  }

  @Get('key/:key')
  @Roles(UserRole.ADMIN, UserRole.RH)
  @ApiOperation({ summary: 'Buscar parâmetro por chave (resolve override da empresa)' })
  @ApiParam({ name: 'key', example: 'HORA_EXTRA_NORMAL' })
  findByKey(@Param('key') key: string, @CurrentUser() user: any) {
    return this.parametersService.findByKey(key, user.empresaId ?? undefined);
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Criar parâmetro. Admin cria override para sua empresa; Super Admin pode criar globais ou para qualquer empresa.' })
  @ApiResponse({ status: 201, description: 'Parâmetro criado' })
  @ApiResponse({ status: 409, description: 'Parâmetro já existe para este escopo' })
  create(@Body() dto: CreateParameterDto, @CurrentUser() user: any) {
    // Admin comum só pode criar overrides para sua própria empresa
    const empresaIdFinal = user.role === UserRole.SUPER_ADMIN
      ? (dto as any).empresaId ?? null
      : user.empresaId;

    return this.parametersService.create({ ...dto, empresaId: empresaIdFinal } as any);
  }

  @Put(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Atualizar parâmetro' })
  @ApiParam({ name: 'id', example: 1 })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateParameterDto) {
    return this.parametersService.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Remover parâmetro' })
  @ApiParam({ name: 'id', example: 1 })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.parametersService.remove(id);
  }
}
