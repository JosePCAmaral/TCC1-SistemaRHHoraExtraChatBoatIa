import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RequestsService } from '../../core/services/requests.service';
import { Request, CreateRequest } from '../../core/models/request.model';

@Component({
  selector: 'app-requests',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './requests.component.html',
})
export class RequestsComponent implements OnInit {
  requests = signal<Request[]>([]);
  loading = signal(false);
  submitting = signal(false);
  showForm = signal(false);
  error = signal('');
  success = signal('');

  form: CreateRequest = {
    type: 'compensacao',
    referenceDate: '',
    hoursAmount: 1,
    justification: '',
  };

  constructor(private requestsService: RequestsService) {}

  ngOnInit() {
    this.loadRequests();
  }

  loadRequests() {
    this.loading.set(true);
    this.requestsService.getMyRequests().subscribe({
      next: (data) => {
        this.requests.set(data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  submit() {
    if (!this.form.referenceDate || !this.form.justification) {
      this.error.set('Preencha todos os campos obrigatórios');
      return;
    }

    this.submitting.set(true);
    this.error.set('');

    this.requestsService.create(this.form).subscribe({
      next: () => {
        this.submitting.set(false);
        this.showForm.set(false);
        this.success.set('✅ Solicitação criada com sucesso!');
        this.resetForm();
        this.loadRequests();
        setTimeout(() => this.success.set(''), 3000);
      },
      error: (err) => {
        this.submitting.set(false);
        this.error.set(err.error?.message ?? 'Erro ao criar solicitação');
      },
    });
  }

  showCancelModal = signal(false);
  cancelTargetId = signal<number | null>(null);

openCancelModal(id: number) {
  this.cancelTargetId.set(id);
  this.showCancelModal.set(true);
}

confirmCancel() {
  const id = this.cancelTargetId();
  if (!id) return;

  this.requestsService.cancel(id).subscribe({
    next: () => {
      this.showCancelModal.set(false);
      this.cancelTargetId.set(null);
      this.success.set('Solicitação cancelada com sucesso');
      this.loadRequests();
      setTimeout(() => this.success.set(''), 3000);
    },
    error: () => {
      this.error.set('Erro ao cancelar solicitação');
      this.showCancelModal.set(false);
    },
  });
}

  resetForm() {
    this.form = {
      type: 'compensacao',
      referenceDate: '',
      hoursAmount: 1,
      justification: '',
    };
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
}