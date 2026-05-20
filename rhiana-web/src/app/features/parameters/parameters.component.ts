import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ParametersService, Parameter } from '../../core/services/parameters.service';

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
  loading = signal(false);
  success = signal('');
  error = signal('');

  cltParams = signal<Parameter[]>([]);
  editState: EditState = {};

  constructor(private parametersService: ParametersService) {}

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.parametersService.getAll().subscribe({
      next: (params) => {
        const clt = params.filter(p => p.type !== 'feriado');
        this.cltParams.set(clt);
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

  startEdit(param: Parameter) {
    this.editState[param.id] = { value: param.value, editing: true };
  }

  cancelEdit(param: Parameter) {
    this.editState[param.id] = { value: param.value, editing: false };
  }

  saveParam(param: Parameter) {
    const state = this.editState[param.id];
    if (!state) return;
    this.success.set('');
    this.error.set('');
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

  getTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      percentual: 'Percentual',
      tolerancia: 'Tolerância',
      configuracao: 'Configuração',
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
}
