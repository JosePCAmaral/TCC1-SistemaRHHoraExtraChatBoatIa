import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { FeriadosService, Feriado } from '../../core/services/feriados.service';

@Component({
  selector: 'app-feriados',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './feriados.component.html',
})
export class FeriadosComponent implements OnInit {
  feriados = signal<Feriado[]>([]);
  loading = signal(false);
  saving = signal(false);
  error = signal('');
  success = signal('');

  showForm = signal(false);
  editingId = signal<number | null>(null);
  form = { date: '', description: '' };

  // Importação JSON
  showImportPanel = signal(false);
  isDragging = signal(false);
  importPreview = signal<Array<{ date: string; name: string }>>([]);
  importResult = signal<{ imported: number; errors: Array<{ row: number; date: string; reason: string }> } | null>(null);
  importLoading = signal(false);
  importError = signal('');

  constructor(private feriadosService: FeriadosService) {}

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.feriadosService.getAll().subscribe({
      next: (data) => { this.feriados.set(data); this.loading.set(false); },
      error: () => { this.error.set('Erro ao carregar feriados'); this.loading.set(false); },
    });
  }

  openCreate() {
    this.form = { date: '', description: '' };
    this.editingId.set(null);
    this.showForm.set(true);
    this.error.set('');
    this.success.set('');
  }

  openEdit(f: Feriado) {
    this.form = { date: f.date, description: f.description };
    this.editingId.set(f.id);
    this.showForm.set(true);
    this.error.set('');
    this.success.set('');
  }

  cancelForm() {
    this.showForm.set(false);
    this.editingId.set(null);
  }

  save() {
    if (!this.form.date || !this.form.description.trim()) {
      this.error.set('Preencha data e descrição');
      return;
    }
    this.saving.set(true);
    this.error.set('');

    const id = this.editingId();
    const obs = id
      ? this.feriadosService.update(id, this.form)
      : this.feriadosService.create(this.form);

    obs.subscribe({
      next: () => {
        this.success.set(id ? 'Feriado atualizado' : 'Feriado criado');
        this.saving.set(false);
        this.showForm.set(false);
        this.editingId.set(null);
        this.load();
      },
      error: () => {
        this.error.set('Erro ao salvar feriado');
        this.saving.set(false);
      },
    });
  }

  remove(f: Feriado) {
    if (!confirm(`Remover "${f.description}"?`)) return;
    this.feriadosService.remove(f.id).subscribe({
      next: () => { this.success.set('Feriado removido'); this.load(); },
      error: () => this.error.set('Erro ao remover feriado'),
    });
  }

  // ── Importação JSON ──────────────────────────────────────

  openImport() {
    this.showImportPanel.set(true);
    this.clearImport();
  }

  closeImport() {
    this.showImportPanel.set(false);
    this.clearImport();
  }

  clearImport() {
    this.importPreview.set([]);
    this.importResult.set(null);
    this.importError.set('');
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    this.isDragging.set(true);
  }

  onDragLeave() {
    this.isDragging.set(false);
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    this.isDragging.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) this.readFile(file);
  }

  onFileChange(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) this.readFile(file);
  }

  private readFile(file: File) {
    this.clearImport();
    if (!file.name.endsWith('.json')) {
      this.importError.set('Somente arquivos .json são aceitos');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        if (!Array.isArray(data)) { this.importError.set('O arquivo deve conter um array JSON'); return; }
        if (data.some((d: any) => !d.date || !d.name)) {
          this.importError.set('Todos os itens devem ter "date" (YYYY-MM-DD) e "name"');
          return;
        }
        this.importPreview.set(data);
      } catch {
        this.importError.set('Arquivo JSON inválido');
      }
    };
    reader.readAsText(file);
  }

  async confirmImport() {
    const items = this.importPreview();
    if (!items.length) return;
    this.importLoading.set(true);
    this.importError.set('');

    const errors: Array<{ row: number; date: string; reason: string }> = [];
    let imported = 0;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      try {
        await firstValueFrom(this.feriadosService.create({ date: item.date, description: item.name }));
        imported++;
      } catch (err: any) {
        errors.push({ row: i + 1, date: item.date, reason: err?.error?.message ?? 'Erro ao cadastrar' });
      }
    }

    this.importResult.set({ imported, errors });
    this.importLoading.set(false);
    this.importPreview.set([]);
    if (imported > 0) this.load();
  }

  downloadTemplate() {
    const template = [
      { date: '2025-01-01', name: 'Confraternização Universal' },
      { date: '2025-04-18', name: 'Sexta-feira Santa' },
      { date: '2025-04-21', name: 'Tiradentes' },
      { date: '2025-05-01', name: 'Dia do Trabalhador' },
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

  // ── Helpers ──────────────────────────────────────────────

  formatDate(date: string): string {
    return new Date(date + 'T12:00:00').toLocaleDateString('pt-BR');
  }
}
