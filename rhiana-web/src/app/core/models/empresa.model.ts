export interface Empresa {
  id: number;
  razaoSocial: string;
  nomeFantasia?: string;
  cnpj: string;
  email?: string;
  telefone?: string;
  endereco?: string;
  logo?: string;
  status: 'ativa' | 'inativa';
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateEmpresa {
  razaoSocial: string;
  nomeFantasia?: string;
  cnpj: string;
  email?: string;
  telefone?: string;
  endereco?: string;
  logo?: string;
}

export interface UpdateEmpresa extends Partial<CreateEmpresa> {}
