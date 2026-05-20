import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum RequestType {
  COMPENSACAO = 'compensacao',
  PAGAMENTO = 'pagamento',
}

// Percentual da hora extra a que o requerimento se refere (50, 60 ou 100)
export enum OvertimeTier {
  FIFTY = 50,
  SIXTY = 60,
  HUNDRED = 100,
}

export enum RequestStatus {
  PENDENTE = 'pendente',
  APROVADO = 'aprovado',
  REJEITADO = 'rejeitado',
  CANCELADO = 'cancelado',
}

@Entity('requests')
export class Request {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { eager: false })
  user: User;

  @Column()
  userId: number;

  @ManyToOne(() => User, { eager: false, nullable: true })
  reviewer: User;

  @Column({ nullable: true })
  reviewerId: number;

  @Column({ type: 'enum', enum: RequestType })
  type: RequestType;

  @Column({ type: 'enum', enum: RequestStatus, default: RequestStatus.PENDENTE })
  status: RequestStatus;

  @Column({ type: 'date' })
  referenceDate: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  hoursAmount: number;

  @Column({ type: 'int', default: 50 })
  overtimeTier: number;

  @Column({ type: 'text' })
  justification: string;

  @Column({ type: 'text', nullable: true })
  reviewerComment: string;

  @Column({ type: 'datetime', nullable: true })
  reviewedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
