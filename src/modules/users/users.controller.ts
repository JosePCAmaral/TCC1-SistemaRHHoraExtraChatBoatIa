import { Controller, Get, Post, Put, Delete, Patch, Body, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole, User } from './entities/user.entity';

@ApiTags('Users')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.RH)
  @ApiOperation({ summary: 'Criar colaborador', description: 'Cria um novo colaborador. Acesso: Admin, RH.' })
  @ApiResponse({ status: 201, description: 'Colaborador criado com sucesso' })
  @ApiResponse({ status: 409, description: 'Email já cadastrado' })
  @ApiResponse({ status: 403, description: 'Sem permissão' })
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.RH)
  @ApiOperation({ summary: 'Listar colaboradores', description: 'Lista todos os colaboradores ativos. Acesso: Admin, RH.' })
  @ApiResponse({ status: 200, description: 'Lista retornada com sucesso' })
  findAll() {
    return this.usersService.findAll();
  }

  @Get('me')
  @ApiOperation({ summary: 'Meu perfil', description: 'Retorna os dados do usuário autenticado.' })
  @ApiResponse({ status: 200, description: 'Perfil retornado com sucesso' })
  getMe(@CurrentUser() user: User) {
    return this.usersService.findOne(user.id);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.RH)
  @ApiOperation({ summary: 'Buscar colaborador por ID', description: 'Acesso: Admin, RH.' })
  @ApiParam({ name: 'id', description: 'ID do colaborador', example: 1 })
  @ApiResponse({ status: 200, description: 'Colaborador encontrado' })
  @ApiResponse({ status: 404, description: 'Colaborador não encontrado' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.findOne(id);
  }

  @Patch('me/password')
  @ApiOperation({ summary: 'Alterar minha senha', description: 'Permite ao usuário autenticado alterar sua própria senha.' })
  @ApiResponse({ status: 200, description: 'Senha alterada com sucesso' })
  @ApiResponse({ status: 401, description: 'Senha atual incorreta' })
  changePassword(@CurrentUser() user: User, @Body() dto: ChangePasswordDto) {
    return this.usersService.changePassword(user.id, dto);
  }

  @Put(':id')
  @Roles(UserRole.ADMIN, UserRole.RH)
  @ApiOperation({ summary: 'Atualizar colaborador', description: 'Atualiza dados de um colaborador. Acesso: Admin, RH.' })
  @ApiParam({ name: 'id', description: 'ID do colaborador', example: 1 })
  @ApiResponse({ status: 200, description: 'Colaborador atualizado com sucesso' })
  update(@Param('id', ParseIntPipe) id: number, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(id, updateUserDto);
  }

  @Patch(':id/toggle-status')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Ativar/Inativar colaborador', description: 'Alterna o status do colaborador. Acesso: Admin.' })
  @ApiParam({ name: 'id', description: 'ID do colaborador', example: 1 })
  @ApiResponse({ status: 200, description: 'Status alterado com sucesso' })
  toggleStatus(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.toggleStatus(id);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Remover colaborador', description: 'Soft delete do colaborador (LGPD). Acesso: Admin.' })
  @ApiParam({ name: 'id', description: 'ID do colaborador', example: 1 })
  @ApiResponse({ status: 200, description: 'Colaborador removido com sucesso' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.remove(id);
  }
}
