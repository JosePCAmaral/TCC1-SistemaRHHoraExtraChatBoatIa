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

  activeTab = signal<'users' | 'import'>('users');

  showUserModal = signal(false);
  editingUser = signal<User | null>(null);

  userForm = {
    name: '',
    email: '',
    password: '',
    role: 'colaborador' as 'colaborador' | 'rh' | 'admin' | 'super_admin',
    cpf: '',
    department: '',
    position: '',
    phone: '',
    workStartTime: '08:00',
    workEndTime: '17:00',
    hourlyRate: 0,
  };

  // Importação via JSON
  importPreview = signal<any[]>([]);
  importResult = signal<{ imported: number; errors: Array<{ row: number; email: string; reason: string }> } | null>(null);
  importLoading = signal(false);
  importError = signal('');
  isDragging = signal(false);

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
      role: user.role as 'colaborador' | 'rh' | 'admin' | 'super_admin',
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

  onFileChange(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) this.readFile(file);
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

  private readFile(file: File) {
    this.importPreview.set([]);
    this.importResult.set(null);
    this.importError.set('');

    if (!file.name.endsWith('.json')) {
      this.importError.set('Somente arquivos .json são aceitos');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        if (!Array.isArray(data)) {
          this.importError.set('O arquivo deve conter um array JSON (ex: [{ "name": "...", ... }])');
          return;
        }
        this.importPreview.set(data);
      } catch {
        this.importError.set('Arquivo JSON inválido. Verifique a estrutura do arquivo.');
      }
    };
    reader.readAsText(file);
  }

  confirmImport() {
    const users = this.importPreview();
    if (!users.length) return;

    this.importLoading.set(true);
    this.importError.set('');

    this.usersService.importUsers(users).subscribe({
      next: (result) => {
        this.importResult.set(result);
        this.importLoading.set(false);
        if (result.imported > 0) {
          this.loadUsers();
          this.importPreview.set([]);
        }
      },
      error: (err) => {
        this.importLoading.set(false);
        this.importError.set(err.error?.message ?? 'Erro ao importar usuários');
      },
    });
  }

  clearImport() {
    this.importPreview.set([]);
    this.importResult.set(null);
    this.importError.set('');
  }

  downloadTemplate() {
    this.usersService.downloadTemplate();
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
