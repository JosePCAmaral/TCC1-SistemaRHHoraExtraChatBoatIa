import { Injectable, signal, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { User, LoginResponse } from '../models/user.model';

const ACTIVITY_THRESHOLD_MS = 5 * 60 * 1000;  // 5 min sem atividade → não renova
const REFRESH_CHECK_INTERVAL_MS = 30 * 1000;   // checa a cada 30s
const REFRESH_WHEN_REMAINING_MS = 10 * 60 * 1000; // renova se restar < 10min
const WARNING_COUNTDOWN_S = 30;                 // segundos no modal de aviso

@Injectable({ providedIn: 'root' })
export class AuthService {
  private apiUrl = 'http://localhost:5000/api';

  currentUser = signal<User | null>(null);
  isAuthenticated = signal<boolean>(false);

  // Sessão
  sessionWarning = signal<'expiring' | 'expired' | null>(null);
  sessionCountdown = signal(WARNING_COUNTDOWN_S);

  private lastActivityAt = Date.now();
  private checkInterval: ReturnType<typeof setInterval> | null = null;
  private countdownInterval: ReturnType<typeof setInterval> | null = null;
  private activityEvents = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];

  constructor(private http: HttpClient, private router: Router) {
    this.loadFromStorage();
  }

  login(email: string, password: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/auth/login`, { email, password }).pipe(
      tap(response => {
        localStorage.setItem('token', response.access_token);
        localStorage.setItem('user', JSON.stringify(response.user));
        this.currentUser.set(response.user as User);
        this.isAuthenticated.set(true);
        this.startSessionManagement();
      })
    );
  }

  logout(reason?: string): void {
    this.stopSessionManagement();
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    this.currentUser.set(null);
    this.isAuthenticated.set(false);
    this.sessionWarning.set(null);
    this.router.navigate(['/login'], reason ? { queryParams: { reason } } : {});
  }

  getToken(): string | null {
    return localStorage.getItem('token');
  }

  isAdmin(): boolean {
    return this.currentUser()?.role === 'admin';
  }

  isRH(): boolean {
    return this.currentUser()?.role === 'rh' || this.isAdmin();
  }

  isColaborador(): boolean {
    return this.currentUser()?.role === 'colaborador';
  }

  // Chamado pelo interceptor quando recebe 401
  handleUnauthorized(): void {
    if (this.sessionWarning() === 'expired') return; // já mostrando
    this.sessionWarning.set('expired');
    this.startExpiredCountdown();
  }

  dismissSessionWarning(): void {
    this.sessionWarning.set(null);
    this.stopCountdown();
  }

  confirmStillActive(): void {
    // Usuário confirmou que está ativo — tenta renovar o token
    this.http.post<LoginResponse>(`${this.apiUrl}/auth/refresh`, {}).pipe(
      tap(response => {
        localStorage.setItem('token', response.access_token);
        if (response.user) {
          localStorage.setItem('user', JSON.stringify(response.user));
          this.currentUser.set(response.user as User);
        }
      })
    ).subscribe({
      next: () => {
        this.sessionWarning.set(null);
        this.stopCountdown();
      },
      error: () => {
        // Token já expirou no servidor — redireciona para login
        this.logout('expired');
      },
    });
  }

  private startSessionManagement(): void {
    this.stopSessionManagement();
    this.lastActivityAt = Date.now();

    // Registrar eventos de atividade
    this.activityEvents.forEach(event =>
      window.addEventListener(event, this.onActivity, { passive: true })
    );

    // Checar token periodicamente
    this.checkInterval = setInterval(() => this.checkToken(), REFRESH_CHECK_INTERVAL_MS);
  }

  private stopSessionManagement(): void {
    this.activityEvents.forEach(event =>
      window.removeEventListener(event, this.onActivity)
    );
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.stopCountdown();
  }

  private onActivity = (): void => {
    this.lastActivityAt = Date.now();
    // Se havia aviso de "expirando em breve", fecha ao detectar atividade
    if (this.sessionWarning() === 'expiring') {
      this.sessionWarning.set(null);
      this.stopCountdown();
    }
  };

  private checkToken(): void {
    const token = this.getToken();
    if (!token) return;

    const remaining = this.getTokenRemainingMs(token);

    if (remaining <= 0) {
      // Token já expirado
      this.sessionWarning.set('expired');
      this.startExpiredCountdown();
      return;
    }

    if (remaining < REFRESH_WHEN_REMAINING_MS) {
      const userWasActive = (Date.now() - this.lastActivityAt) < ACTIVITY_THRESHOLD_MS;

      if (userWasActive) {
        // Renova silenciosamente
        this.silentRefresh();
      } else if (this.sessionWarning() === null) {
        // Usuário inativo → avisa que está expirando
        this.sessionWarning.set('expiring');
        this.startExpiringCountdown(Math.floor(remaining / 1000));
      }
    }
  }

  private silentRefresh(): void {
    this.http.post<LoginResponse>(`${this.apiUrl}/auth/refresh`, {}).pipe(
      tap(response => {
        localStorage.setItem('token', response.access_token);
        if (response.user) {
          localStorage.setItem('user', JSON.stringify(response.user));
          this.currentUser.set(response.user as User);
        }
      })
    ).subscribe({ error: () => {} }); // silencioso — falha sem interromper
  }

  private startExpiringCountdown(seconds: number): void {
    this.stopCountdown();
    this.sessionCountdown.set(Math.min(seconds, WARNING_COUNTDOWN_S));
    this.countdownInterval = setInterval(() => {
      const current = this.sessionCountdown();
      if (current <= 1) {
        this.stopCountdown();
        this.logout('expired');
      } else {
        this.sessionCountdown.set(current - 1);
      }
    }, 1000);
  }

  private startExpiredCountdown(): void {
    this.stopCountdown();
    this.sessionCountdown.set(WARNING_COUNTDOWN_S);
    this.countdownInterval = setInterval(() => {
      const current = this.sessionCountdown();
      if (current <= 1) {
        this.stopCountdown();
        this.logout('expired');
      } else {
        this.sessionCountdown.set(current - 1);
      }
    }, 1000);
  }

  private stopCountdown(): void {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
  }

  getTokenRemainingMs(token: string): number {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp * 1000 - Date.now();
    } catch {
      return 0;
    }
  }

  private loadFromStorage(): void {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    if (token && user) {
      const remaining = this.getTokenRemainingMs(token);
      if (remaining > 0) {
        this.currentUser.set(JSON.parse(user));
        this.isAuthenticated.set(true);
        this.startSessionManagement();
      } else {
        // Token expirado mesmo antes de carregar — limpa storage
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }
  }
}
