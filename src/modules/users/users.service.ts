import { Injectable, NotFoundException, ConflictException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User, UserRole, UserStatus } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

const USER_SELECT: (keyof User)[] = [
  'id', 'name', 'email', 'role', 'status',
  'phone', 'cpf', 'department', 'position',
  'workStartTime', 'workEndTime', 'hourlyRate',
  'empresaId', 'createdAt',
];

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
    const user = this.userRepository.create({ ...createUserDto, password: hashedPassword });

    const saved = await this.userRepository.save(user);
    delete (saved as any).password;
    return saved;
  }

  /**
   * Lista usuários. Super admin vê todos; demais roles veem apenas da própria empresa.
   */
  async findAll(callerRole?: UserRole, callerEmpresaId?: number): Promise<User[]> {
    const where: any = {};

    if (callerRole !== UserRole.SUPER_ADMIN && callerEmpresaId) {
      where.empresaId = callerEmpresaId;
    }

    return this.userRepository.find({ select: USER_SELECT, where });
  }

  async findOne(id: number): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id }, select: USER_SELECT });
    if (!user) throw new NotFoundException('Usuário não encontrado');
    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { email } });
  }

  async update(id: number, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id } });
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
    await this.userRepository.softRemove(user as User);
    return { message: 'Usuário removido com sucesso' };
  }

  async toggleStatus(id: number): Promise<User> {
    const user = await this.findOne(id);
    (user as User).status = (user as User).status === UserStatus.ATIVO ? UserStatus.INATIVO : UserStatus.ATIVO;
    return this.userRepository.save(user as User);
  }

  async importMany(
    dtos: any[],
    empresaId: number,
  ): Promise<{ imported: number; errors: Array<{ row: number; email: string; reason: string }> }> {
    const errors: Array<{ row: number; email: string; reason: string }> = [];
    let imported = 0;

    for (let i = 0; i < dtos.length; i++) {
      const dto = { ...dtos[i], empresaId };
      try {
        await this.create(dto as CreateUserDto);
        imported++;
      } catch (err: any) {
        errors.push({
          row: i + 1,
          email: dto.email ?? `linha ${i + 1}`,
          reason: err?.message ?? 'Erro desconhecido',
        });
      }
    }

    return { imported, errors };
  }

  async seedAdmin(empresaId: number): Promise<void> {
    const existing = await this.userRepository.findOne({
      where: { email: 'admin@rhiana.com' },
    });

    if (!existing) {
      const hashedPassword = await bcrypt.hash('Admin@2025', 10);
      await this.userRepository.save(
        this.userRepository.create({
          name: 'Administrador',
          email: 'admin@rhiana.com',
          password: hashedPassword,
          role: UserRole.ADMIN,
          status: UserStatus.ATIVO,
          empresaId,
        }),
      );
      console.log('✅ Admin criado: admin@rhiana.com / Admin@2025');
    } else if (!existing.empresaId) {
      existing.empresaId = empresaId;
      await this.userRepository.save(existing);
      console.log('✅ Admin existente vinculado à empresa padrão');
    }

    const existingSuperAdmin = await this.userRepository.findOne({
      where: { email: 'superadmin@rhiana.com' },
    });

    if (!existingSuperAdmin) {
      const hashedPassword = await bcrypt.hash('SuperAdmin@2025', 10);
      await this.userRepository.save(
        this.userRepository.create({
          name: 'Super Administrador',
          email: 'superadmin@rhiana.com',
          password: hashedPassword,
          role: UserRole.SUPER_ADMIN,
          status: UserStatus.ATIVO,
          empresaId: null,
        }),
      );
      console.log('✅ Super Admin criado: superadmin@rhiana.com / SuperAdmin@2025');
    }

    // Migra usuários antigos sem empresaId (exceto super_admin) para a empresa padrão
    await this.userRepository
      .createQueryBuilder()
      .update(User)
      .set({ empresaId })
      .where('empresaId IS NULL AND role != :role', { role: UserRole.SUPER_ADMIN })
      .execute();
  }
}
