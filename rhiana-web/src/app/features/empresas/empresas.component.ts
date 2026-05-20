import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EmpresasService } from '../../core/services/empresas.service';
import { UsersService } from '../../core/services/users.service';
import { Empresa } from '../../core/models/empresa.model';
import { User } from '../../core/models/user.model';
import { forkJoin } from 'rxjs';

export interface EmpresaStats {
  empresa: Empresa;
  totalUsers: number;
  usersAtivos: number;
  usersInativos: number;
  adminCount: number;
  rhCount: number;
  colaboradorCount: number;
}

@Component({
  selector: 'app-empresas',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './empresas.component.html',
})
export class EmpresasComponent implements OnInit {
  activeTab = signal<'lista' | 'relatorios'>('lista');

  // Lista
  empresas = signal<Empresa[]>([]);
  loading = signal(false);
  success = signal('');
  error = signal('');

  showModal = signal(false);
  editingEmpresa = signal<Empresa | null>(null);
  confirmDeleteId = signal<number | null>(null);

  form = {
    razaoSocial: '',
    nomeFantasia: '',
    cnpj: '',
    email: '',
    telefone: '',
    endereco: '',
    logo: '',
  };

  // Relatórios
  reportLoading = signal(false);
  empresaStats = signal<EmpresaStats[]>([]);
  allUsers = signal<User[]>([]);
  reportError = signal('');

  // Modal criar usuário da empresa
  showAdminModal = signal(false);
  adminModalEmpresa = signal<Empresa | null>(null);
  adminSaving = signal(false);
  adminError = signal('');
  adminForm = {
    name: '',
    email: '',
    password: '',
    role: 'admin' as 'admin' | 'rh' | 'colaborador',
  };

  constructor(
    private empresasService: EmpresasService,
    private usersService: UsersService,
  ) {}

  ngOnInit() {
    this.load();
  }

  // ─── Aba Relatórios ───────────────────────────────────────────────────────

  loadRelatorio() {
    this.reportLoading.set(true);
    this.reportError.set('');

    forkJoin({
      empresas: this.empresasService.getAll(),
      users: this.usersService.getAll(),
    }).subscribe({
      next: ({ empresas, users }) => {
        this.allUsers.set(users);

        const stats: EmpresaStats[] = empresas.map(empresa => {
          const eu = users.filter(u => u.empresaId === empresa.id);
          return {
            empresa,
            totalUsers: eu.length,
            usersAtivos: eu.filter(u => u.status === 'ativo').length,
            usersInativos: eu.filter(u => u.status !== 'ativo').length,
            adminCount: eu.filter(u => u.role === 'admin').length,
            rhCount: eu.filter(u => u.role === 'rh').length,
            colaboradorCount: eu.filter(u => u.role === 'colaborador').length,
          };
        });

        this.empresaStats.set(stats);
        this.reportLoading.set(false);
      },
      error: () => {
        this.reportError.set('Erro ao carregar dados do relatório.');
        this.reportLoading.set(false);
      },
    });
  }

  switchTab(tab: 'lista' | 'relatorios') {
    this.activeTab.set(tab);
    if (tab === 'relatorios' && this.empresaStats().length === 0) {
      this.loadRelatorio();
    }
  }

  // Totalizadores do relatório
  get totalEmpresas(): number { return this.empresaStats().length; }
  get totalAtivas(): number { return this.empresas().filter(e => e.status === 'ativa').length; }
  get totalInativas(): number { return this.empresas().filter(e => e.status !== 'ativa').length; }
  get totalUsuarios(): number { return this.allUsers().length; }
  get totalUsuariosAtivos(): number { return this.allUsers().filter(u => u.status === 'ativo').length; }

  exportarCSV() {
    const header = [
      'Empresa',
      'Nome Fantasia',
      'CNPJ',
      'Status',
      'Total Usuários',
      'Usuários Ativos',
      'Usuários Inativos',
      'Admins',
      'RH',
      'Colaboradores',
    ].join(';');

    const rows = this.empresaStats().map(s => [
      `"${s.empresa.razaoSocial}"`,
      `"${s.empresa.nomeFantasia ?? ''}"`,
      `"${s.empresa.cnpj}"`,
      s.empresa.status,
      s.totalUsers,
      s.usersAtivos,
      s.usersInativos,
      s.adminCount,
      s.rhCount,
      s.colaboradorCount,
    ].join(';'));

    const csv = [header, ...rows].join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio-empresas-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ─── Gestão de empresas ───────────────────────────────────────────────────

  load() {
    this.loading.set(true);
    this.empresasService.getAll().subscribe({
      next: (data) => {
        this.empresas.set(data);
        this.loading.set(false);
        // Atualiza relatório se a aba já estiver aberta
        if (this.activeTab() === 'relatorios') this.loadRelatorio();
      },
      error: () => this.loading.set(false),
    });
  }

  openCreate() {
    this.editingEmpresa.set(null);
    this.form = { razaoSocial: '', nomeFantasia: '', cnpj: '', email: '', telefone: '', endereco: '', logo: '' };
    this.error.set('');
    this.showModal.set(true);
  }

  openEdit(empresa: Empresa) {
    this.editingEmpresa.set(empresa);
    this.form = {
      razaoSocial: empresa.razaoSocial,
      nomeFantasia: empresa.nomeFantasia ?? '',
      cnpj: empresa.cnpj,
      email: empresa.email ?? '',
      telefone: empresa.telefone ?? '',
      endereco: empresa.endereco ?? '',
      logo: empresa.logo ?? '',
    };
    this.error.set('');
    this.showModal.set(true);
  }

  save() {
    const editing = this.editingEmpresa();
    const payload: any = { razaoSocial: this.form.razaoSocial, cnpj: this.form.cnpj };
    if (this.form.nomeFantasia) payload.nomeFantasia = this.form.nomeFantasia;
    if (this.form.email) payload.email = this.form.email;
    if (this.form.telefone) payload.telefone = this.form.telefone;
    if (this.form.endereco) payload.endereco = this.form.endereco;
    if (this.form.logo) payload.logo = this.form.logo;

    const op$ = editing
      ? this.empresasService.update(editing.id, payload)
      : this.empresasService.create(payload);

    op$.subscribe({
      next: () => {
        this.showModal.set(false);
        this.success.set(editing ? '✅ Empresa atualizada com sucesso!' : '✅ Empresa criada com sucesso!');
        this.load();
        setTimeout(() => this.success.set(''), 3000);
      },
      error: (err) => this.error.set(err.error?.message ?? 'Erro ao salvar empresa'),
    });
  }

  toggleStatus(empresa: Empresa) {
    this.empresasService.toggleStatus(empresa.id).subscribe({
      next: () => {
        this.success.set('Status atualizado!');
        this.load();
        setTimeout(() => this.success.set(''), 3000);
      },
      error: () => this.error.set('Erro ao atualizar status'),
    });
  }

  confirmDelete(id: number) { this.confirmDeleteId.set(id); }
  cancelDelete() { this.confirmDeleteId.set(null); }

  remove(id: number) {
    this.empresasService.remove(id).subscribe({
      next: () => {
        this.confirmDeleteId.set(null);
        this.success.set('✅ Empresa removida com sucesso!');
        this.load();
        setTimeout(() => this.success.set(''), 3000);
      },
      error: (err) => this.error.set(err.error?.message ?? 'Erro ao remover empresa'),
    });
  }

  closeModal() {
    this.showModal.set(false);
    this.error.set('');
  }

  openCreateAdmin(empresa: Empresa) {
    this.adminModalEmpresa.set(empresa);
    this.adminForm = { name: '', email: '', password: '', role: 'admin' };
    this.adminError.set('');
    this.showAdminModal.set(true);
  }

  saveAdmin() {
    const empresa = this.adminModalEmpresa();
    if (!empresa) return;
    if (!this.adminForm.name || !this.adminForm.email || !this.adminForm.password) {
      this.adminError.set('Preencha nome, e-mail e senha');
      return;
    }

    this.adminSaving.set(true);
    this.adminError.set('');

    this.usersService.create({
      name: this.adminForm.name,
      email: this.adminForm.email,
      password: this.adminForm.password,
      role: this.adminForm.role,
      empresaId: empresa.id,
    }).subscribe({
      next: () => {
        this.adminSaving.set(false);
        this.showAdminModal.set(false);
        this.success.set(`✅ Usuário criado para ${empresa.nomeFantasia || empresa.razaoSocial}!`);
        setTimeout(() => this.success.set(''), 4000);
      },
      error: (err) => {
        this.adminSaving.set(false);
        this.adminError.set(err.error?.message ?? 'Erro ao criar usuário');
      },
    });
  }

  closeAdminModal() {
    this.showAdminModal.set(false);
    this.adminError.set('');
  }

  getStatusClass(status: string): string {
    return status === 'ativa' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700';
  }

  getBarWidth(value: number, total: number): string {
    if (!total) return '0%';
    return Math.round((value / total) * 100) + '%';
  }
}
