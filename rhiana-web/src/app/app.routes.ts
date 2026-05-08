import { Routes } from '@angular/router';
import { authGuard, adminGuard, rhGuard } from './core/guards/auth.guard';

export const routes: Routes = [
	{ path: '', redirectTo: '/dashboard', pathMatch: 'full' },
	{
		path: 'login',
		loadComponent: () => import('./features/auth/login/login.component').then(m => m.LoginComponent)
	},
	{
		path: 'dashboard',
		canActivate: [authGuard],
		loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent)
	},
	{
		path: 'solicitacoes',
		canActivate: [authGuard],
		loadComponent: () => import('./features/requests/requests.component').then(m => m.RequestsComponent)
	},
	{
		path: 'rh',
		canActivate: [authGuard, rhGuard],
		loadComponent: () => import('./features/rh/rh.component').then(m => m.RhComponent)
	},
	{
		path: 'admin',
		canActivate: [authGuard, adminGuard],
		loadComponent: () => import('./features/admin/admin.component').then(m => m.AdminComponent)
	},
	{ path: '**', redirectTo: '/dashboard' }
];
