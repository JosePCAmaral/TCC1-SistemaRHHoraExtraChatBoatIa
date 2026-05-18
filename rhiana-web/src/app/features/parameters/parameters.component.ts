import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ParametersService, Parameter } from '../../core/services/parameters.service';

type TabType = 'clt' | 'feriados';

interface EditState {
  [id: number]: { value: string; editing: boolean };
}

@Component({
  selector: 'app-parameters',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './parameters.component.html',
})
export class ParametersComponent implements OnInit {
  activeTab = signal<TabType>('clt');
  loading = signal(false);
  success = signal('');
  error = signal('');

  cltParams = signal<Parameter[]>([]);
  feriados = signal<Parameter[]>([]);

  editState: EditState = {};

  showAddFeriadoModal = signal(false);
  newFeriado = { date: '', name: '' };
  savingFeriado = signal(false);
  deletingId = signal<number | null>(null);

  constructor(private parametersService: ParametersService) {}

  ngOnInit() {
    this.loadAll();
  }

  loadAll() {
    this.loading.set(true);
    this.parametersService.getAll().subscribe({
      next: (params) => {
        const clt = params.filter(p => p.type !== 'feriado');
        const feriados = params.filter(p => p.type === 'feriado');
        this.cltParams.set(clt);
        this.feriados.set(feriados.sort((a, b) => a.key.localeCompare(b.key)));
        clt.forEach(p => {
          this.editState[p.id] = { value: p.value, editing: false };
        });
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Erro ao carregar parâmetros.');
        this.loading.set(false);
      },
    });
  }

  setTab(tab: TabType) {
    this.activeTab.set(tab);
    this.clearMessages();
  }

  startEdit(param: Parameter) {
    this.editState[param.id] = { value: param.value, editing: true };
  }

  cancelEdit(param: Parameter) {
    this.editState[param.id] = { value: param.value, editing: false };
  }

  saveParam(param: Parameter) {
    const state = this.editState[param.id];
    if (!state) return;
    this.clearMessages();
    this.parametersService.update(param.id, { value: String(state.value) }).subscribe({
      next: (updated) => {
        const list = this.cltParams();
        const idx = list.findIndex(p => p.id === param.id);
        if (idx !== -1) {
          list[idx] = { ...list[idx], value: updated.value };
          this.cltParams.set([...list]);
        }
        this.editState[param.id] = { value: updated.value, editing: false };
        this.success.set(`Parâmetro "${param.description}" atualizado com sucesso.`);
        setTimeout(() => this.success.set(''), 4000);
      },
      error: () => {
        this.error.set('Erro ao salvar parâmetro.');
        setTimeout(() => this.error.set(''), 4000);
      },
    });
  }

  openAddFeriado() {
    this.newFeriado = { date: '', name: '' };
    this.showAddFeriadoModal.set(true);
  }

  closeAddFeriado() {
    this.showAddFeriadoModal.set(false);
  }

  addFeriado() {
    if (!this.newFeriado.date || !this.newFeriado.name) return;
    this.savingFeriado.set(true);
    const key = `FERIADO_${this.newFeriado.date}`;
    this.parametersService.create({
      key,
      value: this.newFeriado.name,
      description: `Feriado em ${this.formatDate(this.newFeriado.date)}`,
      type: 'feriado',
      active: true,
    }).subscribe({
      next: (created) => {
        this.feriados.set([...this.feriados(), created].sort((a, b) => a.key.localeCompare(b.key)));
        this.savingFeriado.set(false);
        this.showAddFeriadoModal.set(false);
        this.success.set('Feriado cadastrado com sucesso.');
        setTimeout(() => this.success.set(''), 4000);
      },
      error: () => {
        this.error.set('Erro ao cadastrar feriado. Verifique se a data já está cadastrada.');
        this.savingFeriado.set(false);
        setTimeout(() => this.error.set(''), 4000);
      },
    });
  }

  deleteFeriado(feriado: Parameter) {
    this.deletingId.set(feriado.id);
    this.parametersService.delete(feriado.id).subscribe({
      next: () => {
        this.feriados.set(this.feriados().filter(f => f.id !== feriado.id));
        this.deletingId.set(null);
        this.success.set('Feriado removido.');
        setTimeout(() => this.success.set(''), 3000);
      },
      error: () => {
        this.error.set('Erro ao remover feriado.');
        this.deletingId.set(null);
      },
    });
  }

  getTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      percentual: 'Percentual',
      tolerancia: 'Tolerância',
      configuracao: 'Configuração',
      feriado: 'Feriado',
    };
    return labels[type] ?? type;
  }

  getTypeClass(type: string): string {
    const classes: Record<string, string> = {
      percentual: 'bg-blue-100 text-blue-700',
      tolerancia: 'bg-amber-100 text-amber-700',
      configuracao: 'bg-slate-100 text-slate-700',
    };
    return classes[type] ?? 'bg-slate-100 text-slate-600';
  }

  getUnit(key: string): string {
    if (key.includes('HORAS')) return 'h';
    if (key.includes('MINUTOS')) return 'min';
    if (key.includes('HORA_NOTURNA')) return 'h';
    return '%';
  }

  extractDateFromKey(key: string): string {
    return key.replace('FERIADO_', '');
  }

  formatDate(date: string): string {
    if (!date) return '';
    const [y, m, d] = date.split('-');
    return `${d}/${m}/${y}`;
  }

  private clearMessages() {
    this.success.set('');
    this.error.set('');
  }
}
