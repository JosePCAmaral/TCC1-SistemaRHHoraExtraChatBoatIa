import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RequestsService } from '../../core/services/requests.service';
import { ReportsService } from '../../core/services/reports.service';
import { Request } from '../../core/models/request.model';

@Component({
  selector: 'app-rh',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './rh.component.html',
})
export class RhComponent implements OnInit {
  pendingRequests = signal<Request[]>([]);
  allRequests = signal<Request[]>([]);
  dashboard = signal<any>(null);
  loading = signal(false);
  success = signal('');
  error = signal('');

  showReviewModal = signal(false);
  reviewTarget = signal<Request | null>(null);
  reviewAction = signal<'aprovado' | 'rejeitado'>('aprovado');
  reviewComment = '';
  collaboratorBalance = signal<any>(null);
  loadingBalance = signal(false);

  activeTab = signal<'pending' | 'all'>('pending');

  constructor(
    private requestsService: RequestsService,
    private reportsService: ReportsService,
  ) {}

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.loading.set(true);

    this.requestsService.getPendingRequests().subscribe({
      next: (data) => this.pendingRequests.set(data),
      error: () => {},
    });

    this.requestsService.getAllRequests().subscribe({
      next: (data) => {
        this.allRequests.set(data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });

    this.reportsService.getDashboard().subscribe({
      next: (data) => this.dashboard.set(data),
      error: () => {},
    });
  }

  openReviewModal(request: Request, action: 'aprovado' | 'rejeitado') {
    this.reviewTarget.set(request);
    this.reviewAction.set(action);
    this.reviewComment = '';
    this.collaboratorBalance.set(null);
    this.showReviewModal.set(true);
    this.loadBalance(request.id);
  }

  loadBalance(requestId: number) {
    this.loadingBalance.set(true);
    this.requestsService.getRequestWithBalance(requestId).subscribe({
      next: (data) => {
        this.collaboratorBalance.set(data.collaboratorBalance);
        this.loadingBalance.set(false);
      },
      error: () => this.loadingBalance.set(false),
    });
  }

  confirmReview() {
    const target = this.reviewTarget();
    if (!target) return;

    this.requestsService.review(target.id, this.reviewAction(), this.reviewComment).subscribe({
      next: () => {
        this.showReviewModal.set(false);
        this.success.set(
          this.reviewAction() === 'aprovado'
            ? '✅ Solicitação aprovada!'
            : '❌ Solicitação rejeitada'
        );
        this.loadData();
        setTimeout(() => this.success.set(''), 3000);
      },
      error: () => this.error.set('Erro ao processar solicitação'),
    });
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'aprovado': return 'bg-green-100 text-green-700';
      case 'rejeitado': return 'bg-red-100 text-red-700';
      default: return 'bg-yellow-100 text-yellow-700';
    }
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'aprovado': return '✅ Aprovado';
      case 'rejeitado': return '❌ Rejeitado';
      default: return '⏳ Pendente';
    }
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleDateString('pt-BR');
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  }
}