import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

interface NavItem {
  label: string;
  route: string;
  icon: string;
  roles: string[];
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './sidebar.component.html',
})
export class SidebarComponent {
  @Input() isOpen = true;
  @Output() closeSidebar = new EventEmitter<void>();

  constructor(public authService: AuthService) {}

  navItems: NavItem[] = [
    {
      label: 'Dashboard',
      route: '/dashboard',
      icon: 'home',
      roles: ['colaborador', 'rh', 'admin'],
    },
    {
      label: 'Minhas Solicitações',
      route: '/solicitacoes',
      icon: 'requests',
      roles: ['colaborador', 'rh', 'admin'],
    },
    {
      label: 'Painel RH',
      route: '/rh',
      icon: 'rh',
      roles: ['rh', 'admin'],
    },
    {
      label: 'Relatórios',
      route: '/relatorios',
      icon: 'reports',
      roles: ['rh', 'admin'],
    },
    {
      label: 'Gestão de Pontos',
      route: '/pontos',
      icon: 'timesheet',
      roles: ['rh', 'admin'],
    },
    {
      label: 'Meu Relatório',
      route: '/meu-relatorio',
      icon: 'myreport',
      roles: ['colaborador'],
    },
    {
      label: 'Relatório da Empresa',
      route: '/relatorio-empresa',
      icon: 'company-report',
      roles: ['admin'],
    },
    {
      label: 'Administração',
      route: '/admin',
      icon: 'admin',
      roles: ['admin'],
    },
    {
      label: 'Parâmetros CLT',
      route: '/parametros',
      icon: 'parameters',
      roles: ['admin'],
    },
    {
      label: 'Períodos',
      route: '/periodos',
      icon: 'periodos',
      roles: ['admin'],
    },
    {
      label: 'Feriados',
      route: '/feriados',
      icon: 'feriados',
      roles: ['admin'],
    },
    {
      label: 'Empresas',
      route: '/empresas',
      icon: 'empresas',
      roles: ['super_admin'],
    },
  ];

  get filteredNavItems(): NavItem[] {
    const role = this.authService.currentUser()?.role;
    return this.navItems.filter(item => item.roles.includes(role ?? ''));
  }

  logout() {
    this.authService.logout();
  }

  onNavClick() {
  // Só fecha em mobile (largura < 1024px)
  if (window.innerWidth < 1024) {
    this.closeSidebar.emit();
  }
}
}