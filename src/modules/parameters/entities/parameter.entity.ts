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

export enum ParameterType {
  PERCENTUAL = 'percentual',
  FERIADO = 'feriado',
  TOLERANCIA = 'tolerancia',
  CONFIGURACAO = 'configuracao',
}

@Entity('parameters')
export class Parameter {
  @PrimaryGeneratedColumn()
  id: number;

  // Sem unique: a mesma chave pode existir global (empresaId NULL) e por empresa
  @Column({ length: 100 })
  key: string;

  @Column({ type: 'text' })
  value: string;

  @Column({ length: 200 })
  description: string;

  @Column({ type: 'enum', enum: ParameterType, default: ParameterType.CONFIGURACAO })
  type: ParameterType;

  @Column({ default: true })
  active: boolean;

  // NULL = parâmetro global (padrão CLT); número = override específico da empresa
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
