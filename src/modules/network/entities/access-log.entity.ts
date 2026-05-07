import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export enum AccessStatus {
  AUTORIZADO = 'autorizado',
  BLOQUEADO = 'bloqueado',
}

@Entity('access_logs')
export class AccessLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number;

  @Column({ length: 50 })
  ipAddress: string;

  @Column({ type: 'enum', enum: AccessStatus })
  status: AccessStatus;

  @Column({ nullable: true })
  action: string;

  @Column({ nullable: true })
  reason: string;

  @CreateDateColumn()
  createdAt: Date;
}
