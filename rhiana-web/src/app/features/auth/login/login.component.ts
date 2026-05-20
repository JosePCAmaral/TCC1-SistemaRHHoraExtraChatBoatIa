import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
})
export class LoginComponent {
  email = '';
  password = '';
  loading = signal(false);
  error = signal('');

  constructor(private authService: AuthService, private router: Router) {
    if (this.authService.isAuthenticated()) {
      this.redirectByRole();
    }
  }

  private redirectByRole(): void {
    const dest = this.authService.isSuperAdmin() ? '/empresas' : '/dashboard';
    this.router.navigate([dest]);
  }

  onSubmit(): void {
    if (!this.email || !this.password) {
      this.error.set('Preencha todos os campos');
      return;
    }

    this.loading.set(true);
    this.error.set('');

    this.authService.login(this.email, this.password).subscribe({
      next: () => {
        this.loading.set(false);
        this.redirectByRole();
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(
          err.status === 401
            ? 'Email ou senha incorretos'
            : 'Erro ao conectar. Tente novamente.'
        );
      }
    });
  }
}
