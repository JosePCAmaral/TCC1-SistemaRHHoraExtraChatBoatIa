import { Injectable, NotFoundException, ConflictException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User, UserRole, UserStatus } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    const existing = await this.userRepository.findOne({
      where: { email: createUserDto.email },
    });

    if (existing) {
      throw new ConflictException('Email já cadastrado');
    }

    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);

    const user = this.userRepository.create({
      ...createUserDto,
      password: hashedPassword,
    });

    const saved = await this.userRepository.save(user);
    // hide password
    // @ts-ignore
    delete saved.password;
    return saved;
  }

  async findAll(): Promise<User[]> {
    return this.userRepository.find({
      select: ['id', 'name', 'email', 'role', 'status', 'phone', 'cpf', 'department', 'position', 'workStartTime', 'workEndTime', 'hourlyRate', 'createdAt'],
    });
  }

  async findOne(id: number): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id },
      select: ['id', 'name', 'email', 'role', 'status', 'phone', 'cpf', 'department', 'position', 'workStartTime', 'workEndTime', 'hourlyRate', 'createdAt'],
    });

    if (!user) throw new NotFoundException('Usuário não encontrado');
    return user;
  }

  async update(id: number, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id },
    });

    if (!user) throw new NotFoundException('Usuário não encontrado');

    const { password, ...rest } = updateUserDto as any;
    Object.assign(user, rest);

    if (password && password.trim() !== '') {
      user.password = await bcrypt.hash(password, 10);
    }

    const saved = await this.userRepository.save(user);
    delete (saved as any).password;
    return saved;
  }

  async changePassword(id: number, dto: ChangePasswordDto): Promise<{ message: string }> {
    const user = await this.userRepository.findOne({
      where: { id },
      select: ['id', 'password'],
    });

    if (!user) throw new NotFoundException('Usuário não encontrado');

    const valid = await bcrypt.compare(dto.currentPassword, user.password);
    if (!valid) throw new UnauthorizedException('Senha atual incorreta');

    user.password = await bcrypt.hash(dto.newPassword, 10);
    await this.userRepository.save(user);

    return { message: 'Senha alterada com sucesso' };
  }

  async remove(id: number): Promise<{ message: string }> {
    const user = await this.findOne(id);
    await this.userRepository.softRemove(user);
    return { message: 'Usuário removido com sucesso' };
  }

  async toggleStatus(id: number): Promise<User> {
    const user = await this.findOne(id);
    user.status = user.status === UserStatus.ATIVO ? UserStatus.INATIVO : UserStatus.ATIVO;
    return this.userRepository.save(user);
  }

  async seedAdmin(): Promise<void> {
    const existing = await this.userRepository.findOne({
      where: { email: 'admin@rhiana.com' },
    });

    if (!existing) {
      const hashedPassword = await bcrypt.hash('Admin@2025', 10);
      const admin = this.userRepository.create({
        name: 'Administrador',
        email: 'admin@rhiana.com',
        password: hashedPassword,
        role: UserRole.ADMIN,
        status: UserStatus.ATIVO,
      });
      await this.userRepository.save(admin);
      console.log('✅ Admin criado: admin@rhiana.com / Admin@2025');
    }
  }
}
