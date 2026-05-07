import { Controller, Get, Post, Patch, Body, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { RequestsService } from './requests.service';
import { CreateRequestDto } from './dto/create-request.dto';
import { ReviewRequestDto } from './dto/review-request.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole, User } from '../users/entities/user.entity';

@ApiTags('Requests')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('requests')
export class RequestsController {
  constructor(private readonly requestsService: RequestsService) {}

  @Post()
  @ApiOperation({ summary: 'Abrir solicitação', description: 'Colaborador abre solicitação de compensação ou pagamento de horas extras.' })
  @ApiResponse({ status: 201, description: 'Solicitação criada com sucesso' })
  create(@CurrentUser() user: User, @Body() dto: CreateRequestDto) {
    return this.requestsService.create(user.id, dto);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.RH)
  @ApiOperation({ summary: 'Listar todas as solicitações (RH/Admin)' })
  @ApiResponse({ status: 200, description: 'Lista retornada com sucesso' })
  findAll() {
    return this.requestsService.findAll();
  }

  @Get('me')
  @ApiOperation({ summary: 'Minhas solicitações' })
  @ApiResponse({ status: 200, description: 'Solicitações do colaborador retornadas' })
  findMine(@CurrentUser() user: User) {
    return this.requestsService.findByUser(user.id);
  }

  @Get('pending')
  @Roles(UserRole.ADMIN, UserRole.RH)
  @ApiOperation({ summary: 'Solicitações pendentes (RH/Admin)' })
  @ApiResponse({ status: 200, description: 'Solicitações pendentes retornadas' })
  findPending() {
    return this.requestsService.findPending();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar solicitação por ID' })
  @ApiParam({ name: 'id', example: 1 })
  @ApiResponse({ status: 200, description: 'Solicitação encontrada' })
  @ApiResponse({ status: 404, description: 'Solicitação não encontrada' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.requestsService.findOne(id);
  }

  @Patch(':id/review')
  @Roles(UserRole.ADMIN, UserRole.RH)
  @ApiOperation({ summary: 'Aprovar ou rejeitar solicitação (RH/Admin)' })
  @ApiParam({ name: 'id', example: 1 })
  @ApiResponse({ status: 200, description: 'Solicitação analisada com sucesso' })
  @ApiResponse({ status: 400, description: 'Solicitação já analisada' })
  review(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: User,
    @Body() dto: ReviewRequestDto,
  ) {
    return this.requestsService.review(id, user.id, dto);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancelar solicitação', description: 'Colaborador cancela sua própria solicitação pendente.' })
  @ApiParam({ name: 'id', example: 1 })
  @ApiResponse({ status: 200, description: 'Solicitação cancelada' })
  cancel(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    return this.requestsService.cancel(id, user.id);
  }
}
