import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Feriado {
  id: number;
  date: string;
  description: string;
  empresaId: number | null;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class FeriadosService {
  private apiUrl = 'http://localhost:5000/api/feriados';

  constructor(private http: HttpClient) {}

  getAll(): Observable<Feriado[]> {
    return this.http.get<Feriado[]>(this.apiUrl);
  }

  create(dto: { date: string; description: string }): Observable<Feriado> {
    return this.http.post<Feriado>(this.apiUrl, dto);
  }

  update(id: number, dto: { date: string; description: string }): Observable<Feriado> {
    return this.http.put<Feriado>(`${this.apiUrl}/${id}`, dto);
  }

  remove(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
