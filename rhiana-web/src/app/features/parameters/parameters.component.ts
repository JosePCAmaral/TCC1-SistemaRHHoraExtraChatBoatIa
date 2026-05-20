import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
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

  // Importação de feriados
  showImportPanel = signal(false);
  isDraggingFeriado = signal(false);
  feriadoImportPreview = signal<Array<{ date: string; name: string }>>([]);
  feriadoImportResult = signal<{ imported: number; errors: Array<{ row: number; date: string; reason: string }> } | null>(null);
  feriadoImportLoading = signal(false);
  feriadoImportError = signal('');

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

  openImportPanel() {
    this.showImportPanel.set(true);
    this.clearFeriadoImport();
  }

  closeImportPanel() {
    this.showImportPanel.set(false);
    this.clearFeriadoImport();
  }

  onFeriadoDragOver(event: DragEvent) {
    event.preventDefault();
    this.isDraggingFeriado.set(true);
  }

  onFeriadoDragLeave() {
    this.isDraggingFeriado.set(false);
  }

  onFeriadoDrop(event: DragEvent) {
    event.preventDefault();
    this.isDraggingFeriado.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) this.readFeriadoFile(file);
  }

  onFeriadoFileChange(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) this.readFeriadoFile(file);
  }

  private readFeriadoFile(file: File) {
    this.feriadoImportPreview.set([]);
    this.feriadoImportResult.set(null);
    this.feriadoImportError.set('');

    if (!file.name.endsWith('.json')) {
      this.feriadoImportError.set('Somente arquivos .json são aceitos');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        if (!Array.isArray(data)) {
          this.feriadoImportError.set('O arquivo deve conter um array JSON');
          return;
        }
        const hasInvalid = data.some(d => !d.date || !d.name);
        if (hasInvalid) {
          this.feriadoImportError.set('Todos os itens devem ter os campos "date" (YYYY-MM-DD) e "name"');
          return;
        }
        this.feriadoImportPreview.set(data);
      } catch {
        this.feriadoImportError.set('Arquivo JSON inválido. Verifique a estrutura do arquivo.');
      }
    };
    reader.readAsText(file);
  }

  async confirmFeriadoImport() {
    const items = this.feriadoImportPreview();
    if (!items.length) return;

    this.feriadoImportLoading.set(true);
    this.feriadoImportError.set('');

    const errors: Array<{ row: number; date: string; reason: string }> = [];
    let imported = 0;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      try {
        await firstValueFrom(this.parametersService.create({
          key: `FERIADO_${item.date}`,
          value: item.name,
          description: `Feriado em ${this.formatDate(item.date)}`,
          type: 'feriado',
          active: true,
        }));
        imported++;
      } catch (err: any) {
        errors.push({
          row: i + 1,
          date: item.date,
          reason: err?.error?.message ?? 'Erro ao cadastrar (data já pode existir)',
        });
      }
    }

    this.feriadoImportResult.set({ imported, errors });
    this.feriadoImportLoading.set(false);
    this.feriadoImportPreview.set([]);

    if (imported > 0) this.loadAll();
  }

  clearFeriadoImport() {
    this.feriadoImportPreview.set([]);
    this.feriadoImportResult.set(null);
    this.feriadoImportError.set('');
  }

  downloadFeriadoTemplate() {
    const template = [
      { date: '2025-01-01', name: 'Confraternização Universal' },
      { date: '2025-04-18', name: 'Sexta-feira Santa' },
      { date: '2025-04-21', name: 'Tiradentes' },
      { date: '2025-05-01', name: 'Dia do Trabalhador' },
      { date: '2025-06-19', name: 'Corpus Christi' },
      { date: '2025-09-07', name: 'Independência do Brasil' },
      { date: '2025-10-12', name: 'Nossa Senhora Aparecida' },
      { date: '2025-11-02', name: 'Finados' },
      { date: '2025-11-15', name: 'Proclamação da República' },
      { date: '2025-12-25', name: 'Natal' },
    ];
    const blob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'template-feriados.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  private clearMessages() {
    this.success.set('');
    this.error.set('');
  }
}
