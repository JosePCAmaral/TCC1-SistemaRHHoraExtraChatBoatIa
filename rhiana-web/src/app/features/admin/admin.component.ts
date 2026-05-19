import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UsersService } from '../../core/services/users.service';
import { User } from '../../core/models/user.model';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin.component.html',
})
export class AdminComponent implements OnInit {
  users = signal<User[]>([]);
  loading = signal(false);
  success = signal('');
  error = signal('');

  activeTab = signal<'users' | 'network' | 'parameters'>('users');

  showUserModal = signal(false);
  editingUser = signal<User | null>(null);

  userForm = {
    name: '',
    email: '',
    password: '',
    role: 'colaborador' as 'colaborador' | 'rh' | 'admin',
    cpf: '',
    department: '',
    position: '',
    phone: '',
    workStartTime: '08:00',
    workEndTime: '17:00',
    hourlyRate: 0,
  };

  constructor(private usersService: UsersService) {}

  ngOnInit() {
    this.loadUsers();
  }

  loadUsers() {
    this.loading.set(true);
    this.usersService.getAll().subscribe({
      next: (data) => {
        this.users.set(data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  openCreateModal() {
    this.editingUser.set(null);
    this.userForm = {
      name: '',
      email: '',
      password: '',
      role: 'colaborador',
      cpf: '',
      department: '',
      position: '',
      phone: '',
      workStartTime: '08:00',
      workEndTime: '17:00',
      hourlyRate: 0,
    };
    this.showUserModal.set(true);
  }

  openEditModal(user: User) {
    this.editingUser.set(user);
    this.userForm = {
      name: user.name,
      email: user.email,
      password: '',
      role: user.role,
      cpf: user.cpf ?? '',
      department: user.department ?? '',
      position: user.position ?? '',
      phone: user.phone ?? '',
      workStartTime: user.workStartTime ?? '08:00',
      workEndTime: user.workEndTime ?? '17:00',
      hourlyRate: user.hourlyRate ?? 0,
    };
    this.showUserModal.set(true);
  }

  saveUser() {
    const editing = this.editingUser();

    if (editing) {
      const data: any = {
        name: this.userForm.name,
        email: this.userForm.email,
        role: this.userForm.role,
        cpf: this.userForm.cpf,
        department: this.userForm.department,
        position: this.userForm.position,
        phone: this.userForm.phone,
        workStartTime: this.userForm.workStartTime,
        workEndTime: this.userForm.workEndTime,
        hourlyRate: Number(this.userForm.hourlyRate),
      };

      // Enviar senha apenas se foi preenchida
      if (this.userForm.password && this.userForm.password.trim() !== '') {
        data.password = this.userForm.password;
      }

      this.usersService.update(editing.id, data).subscribe({
        next: () => {
          this.showUserModal.set(false);
          this.success.set('✅ Usuário atualizado com sucesso!');
          this.loadUsers();
          setTimeout(() => this.success.set(''), 3000);
        },
        error: (err) => this.error.set(err.error?.message ?? 'Erro ao atualizar usuário'),
      });
    } else {
      const data = {
        ...this.userForm,
        hourlyRate: Number(this.userForm.hourlyRate),
      };
      this.usersService.create(data).subscribe({
        next: () => {
          this.showUserModal.set(false);
          this.success.set('✅ Usuário criado com sucesso!');
          this.loadUsers();
          setTimeout(() => this.success.set(''), 3000);
        },
        error: (err) => this.error.set(err.error?.message ?? 'Erro ao criar usuário'),
      });
    }
  }

  toggleStatus(user: User) {
    this.usersService.toggleStatus(user.id).subscribe({
      next: () => {
        this.success.set('Status atualizado!');
        this.loadUsers();
        setTimeout(() => this.success.set(''), 3000);
      },
      error: () => this.error.set('Erro ao atualizar status'),
    });
  }

  getRoleClass(role: string): string {
    switch (role) {
      case 'admin': return 'bg-purple-100 text-purple-700';
      case 'rh': return 'bg-blue-100 text-blue-700';
      default: return 'bg-green-100 text-green-700';
    }
  }

  getRoleLabel(role: string): string {
    switch (role) {
      case 'admin': return '👑 Admin';
      case 'rh': return '👥 RH';
      default: return '👤 Colaborador';
    }
  }
}
