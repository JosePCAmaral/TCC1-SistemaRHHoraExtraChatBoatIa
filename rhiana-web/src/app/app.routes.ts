import { Routes } from '@angular/router';
import { authGuard, adminGuard, rhGuard, superAdminGuard, notSuperAdminGuard } from './core/guards/auth.guard';

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
        canActivate: [notSuperAdminGuard],
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent),
      },
      {
        path: 'solicitacoes',
        canActivate: [notSuperAdminGuard],
        loadComponent: () =>
          import('./features/requests/requests.component').then(m => m.RequestsComponent),
      },
      {
        path: 'rh',
        canActivate: [rhGuard, notSuperAdminGuard],
        loadComponent: () =>
          import('./features/rh/rh.component').then(m => m.RhComponent),
      },
      {
        path: 'relatorios',
        canActivate: [rhGuard, notSuperAdminGuard],
        loadComponent: () =>
          import('./features/reports/reports.component').then(m => m.ReportsComponent),
      },
      {
        path: 'pontos',
        canActivate: [rhGuard, notSuperAdminGuard],
        loadComponent: () =>
          import('./features/timesheet/timesheet.component').then(m => m.TimesheetComponent),
      },
      {
        path: 'admin',
        canActivate: [adminGuard, notSuperAdminGuard],
        loadComponent: () =>
          import('./features/admin/admin.component').then(m => m.AdminComponent),
      },
      {
        path: 'parametros',
        canActivate: [adminGuard, notSuperAdminGuard],
        loadComponent: () =>
          import('./features/parameters/parameters.component').then(m => m.ParametersComponent),
      },
      {
        path: 'periodos',
        canActivate: [adminGuard, notSuperAdminGuard],
        loadComponent: () =>
          import('./features/periodos/periodos.component').then(m => m.PeriodosComponent),
      },
      {
        path: 'feriados',
        canActivate: [adminGuard, notSuperAdminGuard],
        loadComponent: () =>
          import('./features/feriados/feriados.component').then(m => m.FeriadosComponent),
      },
      {
        path: 'meu-relatorio',
        canActivate: [notSuperAdminGuard],
        loadComponent: () =>
          import('./features/meu-relatorio/meu-relatorio.component').then(m => m.MeuRelatorioComponent),
      },
      {
        path: 'relatorio-empresa',
        canActivate: [adminGuard, notSuperAdminGuard],
        loadComponent: () =>
          import('./features/relatorio-empresa/relatorio-empresa.component').then(m => m.RelatorioEmpresaComponent),
      },
      {
        path: 'perfil',
        loadComponent: () =>
          import('./features/profile/profile.component').then(m => m.ProfileComponent),
      },
      {
        path: 'empresas',
        canActivate: [superAdminGuard],
        loadComponent: () =>
          import('./features/empresas/empresas.component').then(m => m.EmpresasComponent),
      },
    ],
  },
  { path: '**', redirectTo: '/dashboard' },
];
