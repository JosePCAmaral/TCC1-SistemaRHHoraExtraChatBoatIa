import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Empresa, EmpresaStatus } from './entities/empresa.entity';
import { CreateEmpresaDto } from './dto/create-empresa.dto';
import { UpdateEmpresaDto } from './dto/update-empresa.dto';

@Injectable()
export class EmpresasService {
  constructor(
    @InjectRepository(Empresa)
    private empresaRepository: Repository<Empresa>,
  ) {}

  async create(dto: CreateEmpresaDto): Promise<Empresa> {
    const existing = await this.empresaRepository.findOne({ where: { cnpj: dto.cnpj } });
    if (existing) throw new ConflictException('CNPJ já cadastrado');

    const empresa = this.empresaRepository.create(dto);
    return this.empresaRepository.save(empresa);
  }

  async findAll(): Promise<Empresa[]> {
    return this.empresaRepository.find({ order: { razaoSocial: 'ASC' } });
  }

  async findOne(id: number): Promise<Empresa> {
    const empresa = await this.empresaRepository.findOne({ where: { id } });
    if (!empresa) throw new NotFoundException('Empresa não encontrada');
    return empresa;
  }

  async update(id: number, dto: UpdateEmpresaDto): Promise<Empresa> {
    const empresa = await this.findOne(id);

    if (dto.cnpj && dto.cnpj !== empresa.cnpj) {
      const existing = await this.empresaRepository.findOne({ where: { cnpj: dto.cnpj } });
      if (existing) throw new ConflictException('CNPJ já cadastrado para outra empresa');
    }

    Object.assign(empresa, dto);
    return this.empresaRepository.save(empresa);
  }

  async toggleStatus(id: number): Promise<Empresa> {
    const empresa = await this.findOne(id);
    empresa.status = empresa.status === EmpresaStatus.ATIVA ? EmpresaStatus.INATIVA : EmpresaStatus.ATIVA;
    return this.empresaRepository.save(empresa);
  }

  async remove(id: number): Promise<{ message: string }> {
    const empresa = await this.findOne(id);
    await this.empresaRepository.softRemove(empresa);
    return { message: 'Empresa removida com sucesso' };
  }

  async seedDefaultEmpresa(): Promise<Empresa> {
    let empresa = await this.empresaRepository.findOne({
      where: { cnpj: '00.000.000/0001-00' },
    });

    if (!empresa) {
      empresa = await this.empresaRepository.save(
        this.empresaRepository.create({
          razaoSocial: 'RHIANA Sistemas Ltda',
          nomeFantasia: 'RHIANA',
          cnpj: '00.000.000/0001-00',
          email: 'contato@rhiana.com',
          status: EmpresaStatus.ATIVA,
        }),
      );
      console.log('✅ Empresa padrão criada: RHIANA');
    }

    return empresa;
  }
}
