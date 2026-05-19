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
  isUserAdmin = signal(false);

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

  passwordForm = {
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  };

  showPasswordModal = signal(false);
  changingPassword = signal(false);

  constructor(
    private authService: AuthService,
    private usersService: UsersService,
    private router: Router,
  ) {}

  ngOnInit() {
    this.isUserAdmin.set(this.authService.isAdmin());
    this.loadProfile();
  }

  loadProfile() {
    const currentUser = this.authService.currentUser();
    if (currentUser) {
      this.loading.set(true);

      if (this.isUserAdmin()) {
        // Admin: fetch all users and find self
        this.usersService.getAll().subscribe({
          next: (users) => this.populateUserData(users.find(u => u.id === currentUser.id)),
          error: () => this.populateUserData(currentUser),
        });
      } else {
        // Non-admin: fetch own profile
        this.usersService.getMe().subscribe({
          next: (user) => this.populateUserData(user),
          error: () => this.populateUserData(currentUser),
        });
      }
    }
  }

  private populateUserData(fullUser: User | undefined) {
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

    // Montar dados baseado no role do usuário
    const updateData: any = {
      name: this.formData.name,
      phone: this.formData.phone,
    };

    // Apenas admin pode editar estes campos
    if (this.isUserAdmin()) {
      updateData.department = this.formData.department;
      updateData.position = this.formData.position;
      updateData.workStartTime = this.formData.workStartTime;
      updateData.workEndTime = this.formData.workEndTime;
      updateData.hourlyRate = this.formData.hourlyRate;
    }

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

  openPasswordModal() {
    this.passwordForm = { currentPassword: '', newPassword: '', confirmPassword: '' };
    this.showPasswordModal.set(true);
    this.clearMessages();
  }

  closePasswordModal() {
    this.showPasswordModal.set(false);
    this.passwordForm = { currentPassword: '', newPassword: '', confirmPassword: '' };
  }

  changePassword() {
    if (!this.passwordForm.currentPassword?.trim()) {
      this.error.set('Digite sua senha atual.');
      return;
    }
    if (!this.passwordForm.newPassword?.trim() || this.passwordForm.newPassword.length < 6) {
      this.error.set('Nova senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if (this.passwordForm.newPassword !== this.passwordForm.confirmPassword) {
      this.error.set('As senhas não coincidem.');
      return;
    }

    this.changingPassword.set(true);
    this.clearMessages();

    this.usersService.changePassword(
      this.passwordForm.currentPassword,
      this.passwordForm.newPassword
    ).subscribe({
      next: () => {
        this.success.set('Senha alterada com sucesso.');
        this.closePasswordModal();
        this.changingPassword.set(false);
        setTimeout(() => this.success.set(''), 4000);
      },
      error: (err) => {
        this.error.set(err.error?.message ?? 'Erro ao alterar senha. Tente novamente.');
        this.changingPassword.set(false);
        setTimeout(() => this.error.set(''), 4000);
      },
    });
  }

  private clearMessages() {
    this.success.set('');
    this.error.set('');
  }
}
