export interface Request {
  id: number;
  userId: number;
  reviewerId?: number;
  type: 'compensacao' | 'pagamento';
  status: 'pendente' | 'aprovado' | 'rejeitado';
  referenceDate: string;
  hoursAmount: number;
  justification: string;
  reviewerComment?: string;
  reviewedAt?: string;
  createdAt: string;
  user?: any;
  reviewer?: any;
}

export interface CreateRequest {
  type: 'compensacao' | 'pagamento';
  referenceDate: string;
  hoursAmount: number;
  justification: string;
}
