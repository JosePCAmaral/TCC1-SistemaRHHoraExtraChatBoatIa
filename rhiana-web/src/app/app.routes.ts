import { Routes } from '@angular/router';
import { authGuard, adminGuard, rhGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: '/dashboard', pathMatch: 'full' },
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login.component').then(m => m.LoginComponent),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./shared/layout/layout.component').then(m => m.LayoutComponent),
    children: [
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent),
      },
      {
        path: 'solicitacoes',
        loadComponent: () =>
          import('./features/requests/requests.component').then(m => m.RequestsComponent),
      },
      {
        path: 'rh',
        canActivate: [rhGuard],
        loadComponent: () =>
          import('./features/rh/rh.component').then(m => m.RhComponent),
      },
      {
        path: 'relatorios',
        canActivate: [rhGuard],
        loadComponent: () =>
          import('./features/reports/reports.component').then(m => m.ReportsComponent),
      },
      {
        path: 'pontos',
        canActivate: [rhGuard],
        loadComponent: () =>
          import('./features/timesheet/timesheet.component').then(m => m.TimesheetComponent),
      },
      {
        path: 'admin',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./features/admin/admin.component').then(m => m.AdminComponent),
      },
      {
        path: 'parametros',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./features/parameters/parameters.component').then(m => m.ParametersComponent),
      },
      {
        path: 'perfil',
        loadComponent: () =>
          import('./features/profile/profile.component').then(m => m.ProfileComponent),
      },
    ],
  },
  { path: '**', redirectTo: '/dashboard' },
];