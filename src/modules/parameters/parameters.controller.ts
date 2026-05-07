import { Controller, Get, Post, Put, Delete, Body, Param, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { ParametersService } from './parameters.service';
import { CreateParameterDto } from './dto/create-parameter.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
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
  @ApiOperation({ summary: 'Listar todos os parâmetros (RH/Admin)' })
  findAll() {
    return this.parametersService.findAll();
  }

  @Get('type/:type')
  @Roles(UserRole.ADMIN, UserRole.RH)
  @ApiOperation({ summary: 'Listar parâmetros por tipo' })
  @ApiParam({ name: 'type', enum: ParameterType })
  findByType(@Param('type') type: ParameterType) {
    return this.parametersService.findByType(type);
  }

  @Get('key/:key')
  @Roles(UserRole.ADMIN, UserRole.RH)
  @ApiOperation({ summary: 'Buscar parâmetro por chave' })
  @ApiParam({ name: 'key', example: 'HORA_EXTRA_NORMAL' })
  findByKey(@Param('key') key: string) {
    return this.parametersService.findByKey(key);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Criar parâmetro (Admin)' })
  @ApiResponse({ status: 201, description: 'Parâmetro criado' })
  @ApiResponse({ status: 409, description: 'Chave já existe' })
  create(@Body() dto: CreateParameterDto) {
    return this.parametersService.create(dto);
  }

  @Put(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Atualizar parâmetro (Admin)' })
  @ApiParam({ name: 'id', example: 1 })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: CreateParameterDto) {
    return this.parametersService.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Remover parâmetro (Admin)' })
  @ApiParam({ name: 'id', example: 1 })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.parametersService.remove(id);
  }
}
