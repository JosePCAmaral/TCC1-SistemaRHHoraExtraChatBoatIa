import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Empresa } from '../../empresas/entities/empresa.entity';

@Entity('network_ips')
export class NetworkIp {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100 })
  name: string;

  @Column({ length: 50 })
  ipAddress: string;

  @Column({ default: true })
  authorized: boolean;

  @Column({ nullable: true })
  description: string;

  // NULL = IP global (válido para todas as empresas); número = restrito à empresa
  @Column({ nullable: true })
  empresaId: number;

  @ManyToOne(() => Empresa, { nullable: true, eager: false })
  @JoinColumn({ name: 'empresaId' })
  empresa: Empresa;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
