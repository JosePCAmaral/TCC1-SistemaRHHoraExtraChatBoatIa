import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HoursService } from '../../core/services/hours.service';
import { UsersService } from '../../core/services/users.service';
import { User } from '../../core/models/user.model';
import { HourRecord } from '../../core/models/hour.model';

@Component({
  selector: 'app-timesheet',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './timesheet.component.html',
})
export class TimesheetComponent implements OnInit {
  users = signal<User[]>([]);
  records = signal<HourRecord[]>([]);
  loading = signal(false);
  success = signal('');
  error = signal('');

  showAddModal = signal(false);
  showEditModal = signal(false);
  showDeleteModal = signal(false);
  targetRecord = signal<HourRecord | null>(null);

  filters = {
    date: '',
    userId: '',
  };

  addForm = {
    userId: 0,
    date: '',
    time: '',
    type: 'entrada' as 'entrada' | 'saida',
    dayType: 'util',
    observation: '',
  };

  editForm = {
    time: '',
    type: 'entrada' as 'entrada' | 'saida',
    dayType: 'util',
    observation: '',
  };

  constructor(
    private hoursService: HoursService,
    private usersService: UsersService,
  ) {}

  ngOnInit() {
    const today = new Date().toISOString().split('T')[0];
    this.filters.date = today;
    this.addForm.date = today;

    this.usersService.getAll().subscribe({
      next: (data) => this.users.set(data),
      error: () => {},
    });

    this.search();
  }

  search() {
    this.loading.set(true);
    this.records.set([]);

    if (this.filters.userId) {
      this.hoursService.getRecordsByUserAndDate(
        Number(this.filters.userId),
        this.filters.date
      ).subscribe({
        next: (data) => { this.records.set(data); this.loading.set(false); },
        error: () => this.loading.set(false),
      });
    } else {
      this.hoursService.getAllRecordsByDate(this.filters.date).subscribe({
        next: (data) => { this.records.set(data); this.loading.set(false); },
        error: () => this.loading.set(false),
      });
    }
  }

  openAddModal() {
    this.addForm = {
      userId: this.filters.userId ? Number(this.filters.userId) : 0,
      date: this.filters.date,
      time: '',
      type: 'entrada',
      dayType: 'util',
      observation: '',
    };
    this.showAddModal.set(true);
  }

  saveRecord() {
    if (!this.addForm.userId || !this.addForm.date || !this.addForm.time) {
      this.error.set('Preencha todos os campos obrigatórios');
      return;
    }

    const payload = {
      userId: Number(this.addForm.userId),
      date: this.addForm.date,
      time: this.addForm.time,
      type: this.addForm.type,
      dayType: this.addForm.dayType || 'util',
      observation: this.addForm.observation || undefined,
    };

    this.hoursService.manualRecord(payload).subscribe({
      next: () => {
        this.showAddModal.set(false);
        this.success.set('✅ Registro adicionado com sucesso!');
        this.search();
        setTimeout(() => this.success.set(''), 3000);
      },
      error: (err) => this.error.set(err.error?.message ?? 'Erro ao adicionar registro'),
    });
  }

  openEditModal(record: HourRecord) {
    this.targetRecord.set(record);
    this.editForm = {
      time: record.time,
      type: record.type,
      dayType: record.dayType ?? 'util',
      observation: record.observation ?? '',
    };
    this.showEditModal.set(true);
  }

  saveEdit() {
    const record = this.targetRecord();
    if (!record) return;

    this.hoursService.updateRecord(record.id, this.editForm).subscribe({
      next: () => {
        this.showEditModal.set(false);
        this.success.set('✅ Registro atualizado!');
        this.search();
        setTimeout(() => this.success.set(''), 3000);
      },
      error: (err) => this.error.set(err.error?.message ?? 'Erro ao atualizar'),
    });
  }

  openDeleteModal(record: HourRecord) {
    this.targetRecord.set(record);
    this.showDeleteModal.set(true);
  }

  confirmDelete() {
    const record = this.targetRecord();
    if (!record) return;

    this.hoursService.deleteRecord(record.id).subscribe({
      next: () => {
        this.showDeleteModal.set(false);
        this.success.set('Registro removido');
        this.search();
        setTimeout(() => this.success.set(''), 3000);
      },
      error: () => this.error.set('Erro ao remover registro'),
    });
  }

  getUserName(userId: number): string {
    return this.users().find(u => u.id === userId)?.name ?? `Usuário #${userId}`;
  }

  formatTime(time: string): string {
    return time?.substring(0, 5) ?? '--:--';
  }

  formatDate(date: string): string {
    return new Date(date + 'T00:00:00').toLocaleDateString('pt-BR');
  }

  formatHours(hours: number): string {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}h${m > 0 ? ` ${m}min` : ''}`;
  }

  getDayTypeLabel(dayType: string): string {
    switch (dayType) {
      case 'domingo': return 'Domingo';
      case 'feriado': return 'Feriado';
      case 'sabado': return 'Sábado';
      default: return 'Dia útil';
    }
  }
}
