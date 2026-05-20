export interface User {
  id: number;
  name: string;
  email: string;
  role: 'colaborador' | 'rh' | 'admin' | 'super_admin';
  status: string;
  phone?: string;
  cpf?: string;
  department?: string;
  position?: string;
  workStartTime?: string;
  workEndTime?: string;
  hourlyRate?: number;
  empresaId?: number;
  createdAt?: string;
}

export interface LoginResponse {
  access_token: string;
  user: {
    id: number;
    name: string;
    email: string;
    role: string;
    empresaId?: number | null;
  };
}
