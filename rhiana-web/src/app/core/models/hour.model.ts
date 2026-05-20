export interface HourRecord {
  id: number;
  userId: number;
  date: string;
  time: string;
  type: 'entrada' | 'saida';
  dayType: 'util' | 'sabado' | 'domingo' | 'feriado';
  status: string;
  regularHours: number;
  extraHours50: number;
  extraHours60: number;
  extraHours100: number;
  nightHours: number;
  observation?: string;
  isManual: boolean;
  createdAt: string;
}

export interface MonthlySummary {
  userId: number;
  year: number;
  month: number;
  totalRegularHours: number;
  totalExtraHours50: number;
  totalExtraHours60: number;
  totalExtraHours100: number;
  totalNightHours: number;
  totalExtraHours: number;
  records: HourRecord[];
  saldoAnterior?: {
    extraHours50: number;
    extraHours60: number;
    extraHours100: number;
    nightHours: number;
    totalExtraHours: number;
    extraValue: number;
    nightValue: number;
    totalValue: number;
  } | null;
}
