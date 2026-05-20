import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('period_amendments')
export class PeriodAmendment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  periodoId: number;

  @Column()
  adminId: number;

  @Column()
  userId: number;

  @Column({ type: 'text' })
  description: string;

  // ID do registro de ponto criado/modificado por esta emenda
  @Column({ nullable: true })
  hourRecordId: number;

  @CreateDateColumn()
  createdAt: Date;
}
