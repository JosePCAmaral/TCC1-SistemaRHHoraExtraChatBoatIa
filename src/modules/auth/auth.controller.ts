import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Login do usuário',
    description: 'Autentica o usuário e retorna um token JWT válido por 8 horas.',
  })
  @ApiBody({
    type: LoginDto,
    examples: {
      admin: {
        summary: 'Login como Administrador',
        value: { email: 'admin@rhiana.com', password: 'Admin@2025' },
      },
      colaborador: {
        summary: 'Login como Colaborador',
        value: { email: 'colaborador@empresa.com', password: 'senha123' },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Login realizado com sucesso',
    schema: {
      example: {
        access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        user: {
          id: 1,
          name: 'Administrador',
          email: 'admin@rhiana.com',
          role: 'admin',
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Credenciais inválidas' })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }
}
