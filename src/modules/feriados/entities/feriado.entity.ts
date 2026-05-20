import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('feriados')
export class Feriado {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'date' })
  date: string;

  @Column()
  description: string;

  // null = feriado nacional; número = feriado específico da empresa
  @Column({ nullable: true, type: 'int' })
  empresaId: number | null;

  @CreateDateColumn()
  createdAt: Date;
}
