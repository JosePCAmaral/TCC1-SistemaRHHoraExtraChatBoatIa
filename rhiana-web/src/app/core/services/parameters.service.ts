import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Parameter {
  id: number;
  key: string;
  value: string;
  description: string;
  type: 'percentual' | 'feriado' | 'tolerancia' | 'configuracao';
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateParameterDto {
  key: string;
  value: string;
  description: string;
  type: 'percentual' | 'feriado' | 'tolerancia' | 'configuracao';
  active?: boolean;
}

export interface UpdateParameterDto {
  value?: string;
  description?: string;
  active?: boolean;
}

@Injectable({ providedIn: 'root' })
export class ParametersService {
  private apiUrl = 'http://localhost:5000/api/parameters';

  constructor(private http: HttpClient) {}

  getAll(): Observable<Parameter[]> {
    return this.http.get<Parameter[]>(this.apiUrl);
  }

  getByType(type: string): Observable<Parameter[]> {
    return this.http.get<Parameter[]>(`${this.apiUrl}/type/${type}`);
  }

  create(dto: CreateParameterDto): Observable<Parameter> {
    return this.http.post<Parameter>(this.apiUrl, dto);
  }

  update(id: number, dto: UpdateParameterDto): Observable<Parameter> {
    return this.http.put<Parameter>(`${this.apiUrl}/${id}`, dto);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
