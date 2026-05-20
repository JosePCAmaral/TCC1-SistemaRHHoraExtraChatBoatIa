import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Parameter, ParameterType } from './entities/parameter.entity';
import { CreateParameterDto } from './dto/create-parameter.dto';

@Injectable()
export class ParametersService {
  constructor(
    @InjectRepository(Parameter)
    private parameterRepository: Repository<Parameter>,
  ) {}

  /**
   * Retorna todos os parâmetros globais.
   * Se empresaId informado, retorna os globais mesclados com os overrides da empresa
   * (override da empresa prevalece sobre o global para a mesma chave).
   */
  async findAll(empresaId?: number): Promise<Parameter[]> {
    const globals = await this.parameterRepository.find({
      where: { empresaId: IsNull() },
      order: { type: 'ASC', key: 'ASC' },
    });

    if (!empresaId) return globals;

    const overrides = await this.parameterRepository.find({
      where: { empresaId },
      order: { type: 'ASC', key: 'ASC' },
    });

    // Mescla: substitui global pelo override da empresa quando a chave coincide
    const overrideMap = new Map(overrides.map((p) => [p.key, p]));
    return globals.map((g) => overrideMap.get(g.key) ?? g).concat(
      overrides.filter((o) => !globals.some((g) => g.key === o.key)),
    );
  }

  async findByType(type: ParameterType, empresaId?: number): Promise<Parameter[]> {
    const all = await this.findAll(empresaId);
    return all.filter((p) => p.type === type && p.active);
  }

  /**
   * Resolve um parâmetro pela chave: prefere override da empresa, depois global.
   */
  async findByKey(key: string, empresaId?: number): Promise<Parameter> {
    if (empresaId) {
      const override = await this.parameterRepository.findOne({ where: { key, empresaId } });
      if (override) return override;
    }

    const global = await this.parameterRepository.findOne({ where: { key, empresaId: IsNull() } });
    if (!global) throw new NotFoundException(`Parâmetro '${key}' não encontrado`);
    return global;
  }

  async getValue(key: string, empresaId?: number, defaultValue?: string): Promise<string> {
    try {
      const param = await this.findByKey(key, empresaId);
      return param.value;
    } catch {
      return defaultValue ?? null;
    }
  }

  async create(dto: CreateParameterDto): Promise<Parameter> {
    const empresaId = (dto as any).empresaId ?? null;

    // Verifica unicidade (key + empresaId)
    const existing = await this.parameterRepository.findOne({
      where: { key: dto.key, empresaId: empresaId ?? IsNull() },
    });
    if (existing) {
      const escopo = empresaId ? `empresa #${empresaId}` : 'global';
      throw new ConflictException(`Parâmetro '${dto.key}' já existe para ${escopo}`);
    }

    const param = this.parameterRepository.create({ ...dto, empresaId });
    return this.parameterRepository.save(param);
  }

  async update(id: number, dto: Partial<CreateParameterDto>): Promise<Parameter> {
    await this.parameterRepository.update(id, dto as any);
    const param = await this.parameterRepository.findOne({ where: { id } });
    if (!param) throw new NotFoundException('Parâmetro não encontrado');
    return param;
  }

  async remove(id: number): Promise<{ message: string }> {
    await this.parameterRepository.delete(id);
    return { message: 'Parâmetro removido com sucesso' };
  }

  /**
   * Cria os parâmetros CLT como globais (empresaId = NULL).
   * Cada empresa pode criar overrides via POST /parameters com empresaId.
   */
  async seedDefaultParameters(): Promise<void> {
    const defaults = [
      { key: 'HORA_EXTRA_NORMAL', value: '50', description: 'Percentual de hora extra em dias úteis e sábados (Art. 59, §1º CLT)', type: ParameterType.PERCENTUAL },
      { key: 'HORA_EXTRA_DOMINGO_FERIADO', value: '100', description: 'Percentual de hora extra em domingos e feriados (Art. 70 CLT)', type: ParameterType.PERCENTUAL },
      { key: 'HORA_EXTRA_ACORDO_COLETIVO_MIN', value: '60', description: 'Percentual mínimo de hora extra por acordo coletivo', type: ParameterType.PERCENTUAL },
      { key: 'HORA_EXTRA_ACORDO_COLETIVO_MAX', value: '80', description: 'Percentual máximo de hora extra por acordo coletivo', type: ParameterType.PERCENTUAL },
      { key: 'ADICIONAL_NOTURNO', value: '20', description: 'Percentual de adicional noturno (22h às 5h) (Art. 73 CLT)', type: ParameterType.PERCENTUAL },
      { key: 'TOLERANCIA_MINUTOS', value: '10', description: 'Tolerância máxima em minutos por dia (Art. 58, §1º CLT)', type: ParameterType.TOLERANCIA },
      { key: 'JORNADA_DIARIA_HORAS', value: '8', description: 'Jornada padrão diária em horas (Art. 58 CLT)', type: ParameterType.CONFIGURACAO },
      { key: 'JORNADA_SEMANAL_HORAS', value: '44', description: 'Jornada máxima semanal em horas (Art. 58 CLT)', type: ParameterType.CONFIGURACAO },
      { key: 'INTERVALO_MINIMO_MINUTOS', value: '60', description: 'Intervalo mínimo para refeição em jornadas acima de 6h (Art. 71 CLT)', type: ParameterType.CONFIGURACAO },
      { key: 'HORA_NOTURNA_INICIO', value: '22', description: 'Início da hora noturna (Art. 73 CLT)', type: ParameterType.CONFIGURACAO },
      { key: 'HORA_NOTURNA_FIM', value: '5', description: 'Fim da hora noturna (Art. 73 CLT)', type: ParameterType.CONFIGURACAO },
    ];

    for (const param of defaults) {
      const existing = await this.parameterRepository.findOne({
        where: { key: param.key, empresaId: IsNull() },
      });
      if (!existing) {
        await this.parameterRepository.save(
          this.parameterRepository.create({ ...param, empresaId: null, active: true }),
        );
      }
    }

    console.log('✅ Parâmetros CLT globais verificados/criados');
  }
}
