import { Injectable, effect, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  isDarkMode = signal(this.getStoredTheme() === 'dark');

  constructor() {
    effect(() => {
      const isDark = this.isDarkMode();
      if (isDark) {
        document.documentElement.classList.add('dark');
        localStorage.setItem('rhiana-theme', 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        localStorage.removeItem('rhiana-theme');
      }
    });
  }

  toggleDarkMode(): void {
    this.isDarkMode.set(!this.isDarkMode());
  }

  private getStoredTheme(): string | null {
    return localStorage.getItem('rhiana-theme');
  }
}
