import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { UsersService } from '../../core/services/users.service';
import { User } from '../../core/models/user.model';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './profile.component.html',
})
export class ProfileComponent implements OnInit {
  user = signal<User | null>(null);
  isEditing = signal(false);
  loading = signal(false);
  success = signal('');
  error = signal('');

  formData = {
    name: '',
    email: '',
    phone: '' as string | undefined,
    cpf: '' as string | undefined,
    department: '' as string | undefined,
    position: '' as string | undefined,
    workStartTime: '08:00',
    workEndTime: '17:00',
    hourlyRate: 0 as number | undefined,
  };

  constructor(
    private authService: AuthService,
    private usersService: UsersService,
    private router: Router,
  ) {}

  ngOnInit() {
    this.loadProfile();
  }

  loadProfile() {
    const currentUser = this.authService.currentUser();
    if (currentUser) {
      this.loading.set(true);
      // Buscar dados completos do usuário
      this.usersService.getAll().subscribe({
        next: (users) => {
          const fullUser = users.find(u => u.id === currentUser.id);
          if (fullUser) {
            this.user.set(fullUser);
            this.authService.currentUser.set(fullUser);
            this.formData = {
              name: fullUser.name,
              email: fullUser.email,
              phone: fullUser.phone || '',
              cpf: fullUser.cpf || '',
              department: fullUser.department || '',
              position: fullUser.position || '',
              workStartTime: fullUser.workStartTime || '08:00',
              workEndTime: fullUser.workEndTime || '17:00',
              hourlyRate: fullUser.hourlyRate || 0,
            };
          }
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.error.set('Erro ao carregar dados do perfil.');
        },
      });
    }
  }

  startEdit() {
    this.isEditing.set(true);
    this.clearMessages();
  }

  cancelEdit() {
    this.isEditing.set(false);
    this.loadProfile();
    this.clearMessages();
  }

  saveProfile() {
    if (!this.user()) return;
    this.loading.set(true);
    this.clearMessages();

    const updateData = {
      name: this.formData.name,
      phone: this.formData.phone,
      department: this.formData.department,
      position: this.formData.position,
      workStartTime: this.formData.workStartTime,
      workEndTime: this.formData.workEndTime,
      hourlyRate: this.formData.hourlyRate,
    };

    this.usersService.update(this.user()!.id, updateData).subscribe({
      next: (updatedUser) => {
        this.user.set(updatedUser);
        this.authService.currentUser.set(updatedUser);
        this.isEditing.set(false);
        this.success.set('Perfil atualizado com sucesso.');
        this.loading.set(false);
        setTimeout(() => this.success.set(''), 4000);
      },
      error: () => {
        this.error.set('Erro ao atualizar perfil. Tente novamente.');
        this.loading.set(false);
        setTimeout(() => this.error.set(''), 4000);
      },
    });
  }

  logout() {
    this.authService.logout('logout');
  }

  private clearMessages() {
    this.success.set('');
    this.error.set('');
  }
}
