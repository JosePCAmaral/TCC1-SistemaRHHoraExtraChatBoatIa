import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HoursService } from '../../core/services/hours.service';
import { RequestsService } from '../../core/services/requests.service';
import { AuthService } from '../../core/services/auth.service';
import { PeriodosService } from '../../core/services/periodos.service';
import { HourRecord, MonthlySummary } from '../../core/models/hour.model';
import { Request } from '../../core/models/request.model';
import { Periodo, SaldoAnterior } from '../../core/models/periodo.model';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent implements OnInit {
  todayRecords = signal<HourRecord[]>([]);
  monthlySummary = signal<MonthlySummary | null>(null);
  myRequests = signal<Request[]>([]);
  periodoAtivo = signal<Periodo | null>(null);
  saldoAnterior = signal<SaldoAnterior | null>(null);
  loading = signal(false);
  clockLoading = signal(false);
  error = signal('');
  success = signal('');

  constructor(
    private hoursService: HoursService,
    private requestsService: RequestsService,
    private periodosService: PeriodosService,
    public authService: AuthService,
  ) {}

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.loading.set(true);
    const user = this.authService.currentUser();
    if (!user) return;

    const now = new Date();

    this.hoursService.getTodayRecords().subscribe({
      next: (records) => this.todayRecords.set(records),
      error: () => {}
    });

    this.hoursService.getMyMonthlySummary(now.getFullYear(), now.getMonth() + 1).subscribe({
      next: (summary) => {
        this.monthlySummary.set(summary);
        if (summary.saldoAnterior) this.saldoAnterior.set(summary.saldoAnterior);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });

    this.requestsService.getMyRequests().subscribe({
      next: (requests) => this.myRequests.set(requests),
      error: () => {}
    });

    this.periodosService.getAtivo().subscribe({
      next: (p) => this.periodoAtivo.set(p),
      error: () => {}
    });
  }

  clockIn() {
    this.clockLoading.set(true);
    this.error.set('');
    this.success.set('');

    this.hoursService.clockIn().subscribe({
      next: (record) => {
        this.clockLoading.set(false);
        this.success.set(
          record.type === 'entrada'
            ? '✅ Entrada registrada com sucesso!'
            : '✅ Saída registrada com sucesso!'
        );
        this.loadData();
        setTimeout(() => this.success.set(''), 3000);
      },
      error: (err) => {
        this.clockLoading.set(false);
        this.error.set(err.error?.message ?? 'Erro ao registrar ponto');
        setTimeout(() => this.error.set(''), 3000);
      }
    });
  }

  getNextAction(): string {
    const records = this.todayRecords();
    if (records.length === 0) return 'entrada';
    const last = records[records.length - 1];
    return last.type === 'entrada' ? 'saida' : 'entrada';
  }

  get pendingRequests(): number {
    return this.myRequests().filter(r => r.status === 'pendente').length;
  }

  get effectiveExtraHours(): number {
    const total = this.monthlySummary()?.totalExtraHours ?? 0;
    const deducted = this.myRequests()
      .filter(r => r.status === 'aprovado')
      .reduce((sum, r) => sum + Number(r.hoursAmount), 0);
    return Math.max(0, +(total - deducted).toFixed(2));
  }

  formatDate(d: string): string {
    return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  }

  formatTime(time: string): string {
    return time.substring(0, 5);
  }

  formatHours(hours: number): string {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}h${m > 0 ? ` ${m}min` : ''}`;
  }

  workedDaysCount(): number {
    const records = this.monthlySummary()?.records ?? [];
    const daysWithExit = records
      .filter(r => r.type === 'saida' && (r.regularHours > 0 || r.extraHours50 > 0 || r.extraHours60 > 0 || r.extraHours100 > 0))
      .map(r => r.date);
    return new Set(daysWithExit).size;
  }
}