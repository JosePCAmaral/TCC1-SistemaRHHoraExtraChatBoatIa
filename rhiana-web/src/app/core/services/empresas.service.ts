import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Empresa, CreateEmpresa, UpdateEmpresa } from '../models/empresa.model';

@Injectable({ providedIn: 'root' })
export class EmpresasService {
  private apiUrl = 'http://localhost:5000/api/empresas';

  constructor(private http: HttpClient) {}

  getAll(): Observable<Empresa[]> {
    return this.http.get<Empresa[]>(this.apiUrl);
  }

  getOne(id: number): Observable<Empresa> {
    return this.http.get<Empresa>(`${this.apiUrl}/${id}`);
  }

  getMinha(): Observable<Empresa> {
    return this.http.get<Empresa>(`${this.apiUrl}/minha`);
  }

  create(data: CreateEmpresa): Observable<Empresa> {
    return this.http.post<Empresa>(this.apiUrl, data);
  }

  update(id: number, data: UpdateEmpresa): Observable<Empresa> {
    return this.http.put<Empresa>(`${this.apiUrl}/${id}`, data);
  }

  toggleStatus(id: number): Observable<Empresa> {
    return this.http.patch<Empresa>(`${this.apiUrl}/${id}/toggle-status`, {});
  }

  remove(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/${id}`);
  }
}
