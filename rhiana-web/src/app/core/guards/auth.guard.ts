import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return true;
  }

  router.navigate(['/login']);
  return false;
};

export const superAdminGuard = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isSuperAdmin()) {
    return true;
  }

  router.navigate(['/dashboard']);
  return false;
};

export const adminGuard = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAdmin()) {
    return true;
  }

  router.navigate(['/dashboard']);
  return false;
};

export const rhGuard = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isRH()) {
    return true;
  }

  router.navigate(['/dashboard']);
  return false;
};

// Bloqueia super_admin de rotas específicas de empresa (redireciona para /empresas)
export const notSuperAdminGuard = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isSuperAdmin()) {
    router.navigate(['/empresas']);
    return false;
  }

  return true;
};
