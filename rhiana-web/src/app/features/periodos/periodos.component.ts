import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PeriodosService } from '../../core/services/periodos.service';
import { UsersService } from '../../core/services/users.service';
import { Periodo, PeriodUserBalance } from '../../core/models/periodo.model';
import { User } from '../../core/models/user.model';

type Modal = 'criar' | 'fechar' | 'emendar' | 'relatorio' | 'saldos' | 'emendas' | null;

@Component({
  selector: 'app-periodos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './periodos.component.html',
})
export class PeriodosComponent implements OnInit {
  periodos = signal<Periodo[]>([]);
  users = signal<User[]>([]);
  loading = signal(false);
  actionLoading = signal(false);
  error = signal('');
  success = signal('');
  modal = signal<Modal>(null);

  selectedPeriodo = signal<Periodo | null>(null);
  relatorioData = signal<any>(null);
  saldosData = signal<PeriodUserBalance[]>([]);
  emendasData = signal<any[]>([]);

  createForm = { nome: '', startDate: '', endDate: '' };
  amendForm = {
    userId: '',
    date: '',
    time: '',
    type: 'entrada',
    dayType: 'util',
    observation: '',
    description: '',
  };

  constructor(
    private periodosService: PeriodosService,
    private usersService: UsersService,
  ) {}

  ngOnInit() {
    this.load();
    this.usersService.getAll().subscribe({ next: u => this.users.set(u), error: () => {} });
    // Pre-fill create form com o próximo mês
    const now = new Date();
    const firstDay = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const lastDayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`;
    const nomeMes = now.toLocaleString('pt-BR', { month: 'long' });
    this.createForm.nome = `${nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1)}/${now.getFullYear()}`;
    this.createForm.startDate = firstDay;
    this.createForm.endDate = lastDayStr;
  }

  load() {
    this.loading.set(true);
    this.periodosService.getAll().subscribe({
      next: data => { this.periodos.set(data); this.loading.set(false); },
      error: () => { this.error.set('Erro ao carregar períodos'); this.loading.set(false); },
    });
  }

  openModal(type: Modal, periodo?: Periodo) {
    this.error.set('');
    this.success.set('');
    this.modal.set(type);
    if (periodo) {
      this.selectedPeriodo.set(periodo);
      if (type === 'emendar') {
        this.amendForm.date = periodo.startDate;
      }
      if (type === 'relatorio') this.loadRelatorio(periodo.id);
      if (type === 'saldos') this.loadSaldos(periodo.id);
      if (type === 'emendas') this.loadEmendas(periodo.id);
    }
  }

  closeModal() { this.modal.set(null); this.selectedPeriodo.set(null); }

  loadRelatorio(id: number) {
    this.periodosService.getRelatorio(id).subscribe({
      next: d => this.relatorioData.set(d),
      error: () => this.error.set('Erro ao carregar relatório'),
    });
  }

  loadSaldos(id: number) {
    this.periodosService.getSaldos(id).subscribe({
      next: d => this.saldosData.set(d.balances),
      error: () => this.error.set('Erro ao carregar saldos'),
    });
  }

  loadEmendas(id: number) {
    this.periodosService.getEmendas(id).subscribe({
      next: d => this.emendasData.set(d),
      error: () => this.error.set('Erro ao carregar emendas'),
    });
  }

  criar() {
    if (!this.createForm.nome || !this.createForm.startDate || !this.createForm.endDate) {
      this.error.set('Preencha todos os campos'); return;
    }
    this.actionLoading.set(true);
    this.periodosService.create(this.createForm).subscribe({
      next: () => {
        this.actionLoading.set(false);
        this.closeModal();
        this.load();
        this.success.set('Período criado com sucesso!');
        setTimeout(() => this.success.set(''), 3000);
      },
      error: err => { this.actionLoading.set(false); this.error.set(err.error?.message ?? 'Erro ao criar período'); },
    });
  }

  fechar() {
    const p = this.selectedPeriodo();
    if (!p) return;
    this.actionLoading.set(true);
    this.periodosService.fechar(p.id).subscribe({
      next: () => {
        this.actionLoading.set(false);
        this.closeModal();
        this.load();
        this.success.set('Período fechado! Próximo período criado automaticamente.');
        setTimeout(() => this.success.set(''), 4000);
      },
      error: err => { this.actionLoading.set(false); this.error.set(err.error?.message ?? 'Erro ao fechar período'); },
    });
  }

  emendar() {
    const p = this.selectedPeriodo();
    if (!p || !this.amendForm.userId || !this.amendForm.description) {
      this.error.set('Preencha todos os campos obrigatórios'); return;
    }
    this.actionLoading.set(true);
    this.periodosService.emendar(p.id, {
      userId: Number(this.amendForm.userId),
      date: this.amendForm.date,
      time: this.amendForm.time,
      type: this.amendForm.type,
      dayType: this.amendForm.dayType,
      observation: this.amendForm.observation,
      description: this.amendForm.description,
    }).subscribe({
      next: () => {
        this.actionLoading.set(false);
        this.closeModal();
        this.load();
        this.success.set('Emenda registrada e relatório atualizado!');
        setTimeout(() => this.success.set(''), 3000);
      },
      error: err => { this.actionLoading.set(false); this.error.set(err.error?.message ?? 'Erro ao registrar emenda'); },
    });
  }

  formatDate(d: string): string {
    return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR');
  }

  formatHours(h: number): string {
    const hours = Math.floor(h);
    const mins = Math.round((h - hours) * 60);
    return `${hours}h${mins > 0 ? ` ${mins}min` : ''}`;
  }

  formatCurrency(v: number): string {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v ?? 0);
  }

  get periodoAtivo(): Periodo | undefined {
    return this.periodos().find(p => p.status === 'ativo');
  }
}
