export interface User {
  id: number;
  name: string;
  email: string;
  role: 'colaborador' | 'rh' | 'admin';
  status: string;
  phone?: string;
  cpf?: string;
  department?: string;
  position?: string;
  workStartTime?: string;
  workEndTime?: string;
  hourlyRate?: number;
  createdAt?: string;
}

export interface LoginResponse {
  access_token: string;
  user: {
    id: number;
    name: string;
    email: string;
    role: string;
  };
}
