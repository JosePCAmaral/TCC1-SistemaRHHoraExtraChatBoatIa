import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum RecordType {
  ENTRADA = 'entrada',
  SAIDA = 'saida',
}

export enum DayType {
  UTIL = 'util',
  SABADO = 'sabado',
  DOMINGO = 'domingo',
  FERIADO = 'feriado',
}

export enum RecordStatus {
  PENDENTE = 'pendente',
  APROVADO = 'aprovado',
  REJEITADO = 'rejeitado',
}

@Entity('hour_records')
export class HourRecord {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { eager: false })
  user: User;

  @Column()
  userId: number;

  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'time' })
  time: string;

  @Column({ type: 'enum', enum: RecordType })
  type: RecordType;

  @Column({ type: 'enum', enum: DayType, default: DayType.UTIL })
  dayType: DayType;

  @Column({ type: 'enum', enum: RecordStatus, default: RecordStatus.APROVADO })
  status: RecordStatus;

  @Column({ nullable: true })
  ipAddress: string;

  @Column({ nullable: true })
  observation: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true, default: 0 })
  regularHours: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true, default: 0 })
  extraHours50: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  extraHours60: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true, default: 0 })
  extraHours100: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  nightHours: number;

  @Column({ default: false })
  isManual: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
