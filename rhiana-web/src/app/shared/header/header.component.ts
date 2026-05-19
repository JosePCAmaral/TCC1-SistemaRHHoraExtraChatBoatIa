import { Component, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ThemeService } from '../../core/services/theme.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './header.component.html',
})
export class HeaderComponent {
  @Output() toggleSidebar = new EventEmitter<void>();

  showProfileMenu = signal(false);

  constructor(
    public authService: AuthService,
    public themeService: ThemeService,
    private router: Router,
  ) {}

  toggleProfileMenu() {
    this.showProfileMenu.set(!this.showProfileMenu());
  }

  closeMenu() {
    this.showProfileMenu.set(false);
  }

  goToProfile() {
    this.router.navigate(['/perfil']);
    this.closeMenu();
  }

  logout() {
    this.authService.logout('logout');
    this.closeMenu();
  }

  getCurrentDate(): string {
    return new Date().toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  }
}
