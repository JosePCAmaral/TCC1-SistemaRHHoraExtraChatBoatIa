import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from '../users/entities/user.entity';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private jwtService: JwtService,
  ) {}

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    const user = await this.userRepository.findOne({
      where: { email },
      select: ['id', 'name', 'email', 'password', 'role', 'status'],
    });

    if (!user) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    if (user.status === 'inativo') {
      throw new UnauthorizedException('Usuário inativo. Contate o administrador.');
    }

    const passwordValid = await bcrypt.compare(password, user.password);
    if (!passwordValid) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  }

  async refreshToken(payload: { sub: number; email: string; role: string; name: string }) {
    const user = await this.userRepository.findOne({
      where: { id: payload.sub },
      select: ['id', 'name', 'email', 'role', 'status'],
    });

    if (!user || user.status === 'inativo') {
      throw new UnauthorizedException('Sessão inválida.');
    }

    const newPayload = { sub: user.id, email: user.email, role: user.role, name: user.name };
    return {
      access_token: this.jwtService.sign(newPayload),
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    };
  }

  async validateUser(payload: any): Promise<User | null> {
    return this.userRepository.findOne({ where: { id: payload.sub } });
  }
}
