import { Controller, Get, Post, Put, Delete, Patch, Body, Param, ParseIntPipe, UseGuards, BadRequestException } from '@nestjs/common';
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
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.RH)
  @ApiOperation({ summary: 'Criar colaborador', description: 'Cria um novo colaborador. Acesso: Super Admin, Admin, RH.' })
  @ApiResponse({ status: 201, description: 'Colaborador criado com sucesso' })
  @ApiResponse({ status: 409, description: 'Email já cadastrado' })
  @ApiResponse({ status: 403, description: 'Sem permissão' })
  create(@CurrentUser() caller: User, @Body() createUserDto: CreateUserDto) {
    const callerEmpresaId = (caller as any).empresaId;
    if (callerEmpresaId && !createUserDto.empresaId) {
      createUserDto.empresaId = callerEmpresaId;
    }
    return this.usersService.create(createUserDto);
  }

  @Post('import')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Importar usuários via JSON', description: 'Importa múltiplos usuários de uma vez. Acesso: Admin.' })
  @ApiResponse({ status: 201, description: 'Resultado da importação com contagem e erros por linha' })
  async importUsers(@CurrentUser() caller: User, @Body('users') users: any[]) {
    if (!Array.isArray(users) || users.length === 0) {
      throw new BadRequestException('O campo "users" deve ser um array não vazio');
    }
    const callerEmpresaId = (caller as any).empresaId;
    return this.usersService.importMany(users, callerEmpresaId);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.RH)
  @ApiOperation({ summary: 'Listar colaboradores', description: 'Lista colaboradores da empresa. Super Admin vê todos.' })
  @ApiResponse({ status: 200, description: 'Lista retornada com sucesso' })
  findAll(@CurrentUser() user: User) {
    return this.usersService.findAll(user.role, (user as any).empresaId);
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
