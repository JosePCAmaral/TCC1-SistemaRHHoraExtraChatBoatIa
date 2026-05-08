import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HoursService } from '../../core/services/hours.service';
import { RequestsService } from '../../core/services/requests.service';
import { AuthService } from '../../core/services/auth.service';
import { HourRecord, MonthlySummary } from '../../core/models/hour.model';
import { Request } from '../../core/models/request.model';

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
  loading = signal(false);
  clockLoading = signal(false);
  error = signal('');
  success = signal('');

  constructor(
    private hoursService: HoursService,
    private requestsService: RequestsService,
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

    this.hoursService.getMonthlySummary(user.id, now.getFullYear(), now.getMonth() + 1).subscribe({
      next: (summary) => {
        this.monthlySummary.set(summary);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });

    this.requestsService.getMyRequests().subscribe({
      next: (requests) => this.myRequests.set(requests),
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

  formatTime(time: string): string {
    return time.substring(0, 5);
  }

  formatHours(hours: number): string {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}h${m > 0 ? ` ${m}min` : ''}`;
  }
}