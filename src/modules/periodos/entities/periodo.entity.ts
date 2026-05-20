import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum PeriodoStatus {
  ATIVO = 'ativo',
  FECHADO = 'fechado',
}

@Entity('periodos')
export class Periodo {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  empresaId: number;

  @Column({ length: 100 })
  nome: string;

  @Column({ type: 'date' })
  startDate: string;

  @Column({ type: 'date' })
  endDate: string;

  @Column({ type: 'enum', enum: PeriodoStatus, default: PeriodoStatus.ATIVO })
  status: PeriodoStatus;

  @Column({ default: false })
  hasAmendments: boolean;

  @Column({ default: 0 })
  amendmentCount: number;

  @Column({ type: 'json', nullable: true })
  reportSnapshot: any;

  @Column({ nullable: true })
  closedByUserId: number;

  @Column({ type: 'datetime', nullable: true })
  closedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
