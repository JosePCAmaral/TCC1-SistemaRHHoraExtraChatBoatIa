import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

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

  @Column({ unique: true, length: 100 })
  key: string;

  @Column({ type: 'text' })
  value: string;

  @Column({ length: 200 })
  description: string;

  @Column({ type: 'enum', enum: ParameterType, default: ParameterType.CONFIGURACAO })
  type: ParameterType;

  @Column({ default: true })
  active: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
