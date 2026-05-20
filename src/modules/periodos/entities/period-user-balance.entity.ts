import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('period_user_balances')
export class PeriodUserBalance {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  periodoId: number;

  @Column()
  userId: number;

  @Column()
  empresaId: number;

  // Horas restantes de cada tier após deduções de requerimentos aprovados
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  extraHours50: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  extraHours60: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  extraHours100: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  nightHours: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  totalExtraHours: number;

  // Valor monetário correspondente ao saldo transferido
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  extraValue: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  nightValue: number;

  @CreateDateColumn()
  createdAt: Date;
}
