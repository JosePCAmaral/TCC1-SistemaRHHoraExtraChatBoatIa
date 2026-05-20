import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Periodo, PeriodUserBalance, SaldoAnterior } from '../models/periodo.model';

@Injectable({ providedIn: 'root' })
export class PeriodosService {
  private apiUrl = 'http://localhost:5000/api/periodos';

  constructor(private http: HttpClient) {}

  getAll(): Observable<Periodo[]> {
    return this.http.get<Periodo[]>(this.apiUrl);
  }

  getAtivo(): Observable<Periodo | null> {
    return this.http.get<Periodo | null>(`${this.apiUrl}/ativo`);
  }

  getMySaldoAnterior(): Observable<SaldoAnterior | null> {
    return this.http.get<SaldoAnterior | null>(`${this.apiUrl}/me/saldo-anterior`);
  }

  getOne(id: number): Observable<Periodo> {
    return this.http.get<Periodo>(`${this.apiUrl}/${id}`);
  }

  getRelatorio(id: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${id}/relatorio`);
  }

  getSaldos(id: number): Observable<{ periodo: any; balances: PeriodUserBalance[] }> {
    return this.http.get<any>(`${this.apiUrl}/${id}/saldos`);
  }

  getEmendas(id: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/${id}/emendas`);
  }

  create(dto: { nome: string; startDate: string; endDate: string }): Observable<Periodo> {
    return this.http.post<Periodo>(this.apiUrl, dto);
  }

  update(id: number, dto: Partial<{ nome: string; startDate: string; endDate: string }>): Observable<Periodo> {
    return this.http.patch<Periodo>(`${this.apiUrl}/${id}`, dto);
  }

  fechar(id: number): Observable<Periodo> {
    return this.http.post<Periodo>(`${this.apiUrl}/${id}/fechar`, {});
  }

  emendar(id: number, dto: {
    userId: number; date: string; time: string; type: string;
    dayType?: string; observation?: string; description: string;
  }): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/${id}/emendar`, dto);
  }
}
