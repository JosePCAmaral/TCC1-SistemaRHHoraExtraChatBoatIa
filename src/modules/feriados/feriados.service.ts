import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Feriado } from './entities/feriado.entity';
import { CreateFeriadoDto } from './dto/create-feriado.dto';

@Injectable()
export class FeriadosService {
  constructor(
    @InjectRepository(Feriado)
    private feriadosRepo: Repository<Feriado>,
  ) {}

  async findAll(empresaId: number): Promise<Feriado[]> {
    return this.feriadosRepo.find({
      where: [{ empresaId: IsNull() }, { empresaId }],
      order: { date: 'ASC' },
    });
  }

  async findOne(id: number): Promise<Feriado> {
    const f = await this.feriadosRepo.findOne({ where: { id } });
    if (!f) throw new NotFoundException('Feriado não encontrado');
    return f;
  }

  async create(dto: CreateFeriadoDto): Promise<Feriado> {
    return this.feriadosRepo.save(this.feriadosRepo.create(dto));
  }

  async update(id: number, dto: CreateFeriadoDto): Promise<Feriado> {
    const f = await this.findOne(id);
    Object.assign(f, dto);
    return this.feriadosRepo.save(f);
  }

  async remove(id: number): Promise<void> {
    const f = await this.findOne(id);
    await this.feriadosRepo.remove(f);
  }

  async isHoliday(date: string, empresaId: number): Promise<boolean> {
    const count = await this.feriadosRepo.count({
      where: [{ date, empresaId: IsNull() }, { date, empresaId }],
    });
    return count > 0;
  }
}
