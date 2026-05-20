import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';

export enum EmpresaStatus {
  ATIVA = 'ativa',
  INATIVA = 'inativa',
}

@Entity('empresas')
export class Empresa {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 150 })
  razaoSocial: string;

  @Column({ length: 100, nullable: true })
  nomeFantasia: string;

  @Column({ length: 18, unique: true })
  cnpj: string;

  @Column({ length: 150, nullable: true })
  email: string;

  @Column({ length: 20, nullable: true })
  telefone: string;

  @Column({ length: 255, nullable: true })
  endereco: string;

  @Column({ nullable: true })
  logo: string;

  @Column({ type: 'enum', enum: EmpresaStatus, default: EmpresaStatus.ATIVA })
  status: EmpresaStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
}
