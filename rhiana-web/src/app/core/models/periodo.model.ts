export interface Periodo {
  id: number;
  empresaId: number;
  nome: string;
  startDate: string;
  endDate: string;
  status: 'ativo' | 'fechado';
  hasAmendments: boolean;
  amendmentCount: number;
  reportSnapshot: any | null;
  closedByUserId: number | null;
  closedAt: string | null;
  createdAt: string;
}

export interface PeriodUserBalance {
  userId: number;
  name: string;
  department: string | null;
  position: string | null;
  extraHours50: number;
  extraHours60: number;
  extraHours100: number;
  nightHours: number;
  totalExtraHours: number;
  extraValue: number;
  nightValue: number;
}

export interface SaldoAnterior {
  extraHours50: number;
  extraHours60: number;
  extraHours100: number;
  nightHours: number;
  totalExtraHours: number;
  extraValue: number;
  nightValue: number;
  totalValue: number;
}
