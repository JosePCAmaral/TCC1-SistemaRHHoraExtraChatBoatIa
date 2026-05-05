import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn } from 'typeorm';

export enum UserRole {
  COLABORADOR = 'colaborador',
  RH = 'rh',
  ADMIN = 'admin',
}

export enum UserStatus {
  ATIVO = 'ativo',
  INATIVO = 'inativo',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100 })
  name: string;

  @Column({ unique: true, length: 150 })
  email: string;

  @Column()
  password: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.COLABORADOR })
  role: UserRole;

  @Column({ type: 'enum', enum: UserStatus, default: UserStatus.ATIVO })
  status: UserStatus;

  @Column({ length: 20, nullable: true })
  phone: string;

  @Column({ length: 14, nullable: true })
  cpf: string;

  @Column({ nullable: true })
  department: string;

  @Column({ nullable: true })
  position: string;

  @Column({ type: 'time', nullable: true })
  workStartTime: string;

  @Column({ type: 'time', nullable: true })
  workEndTime: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  hourlyRate: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
}
