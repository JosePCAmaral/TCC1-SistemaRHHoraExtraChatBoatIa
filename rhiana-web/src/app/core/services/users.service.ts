import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { User } from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class UsersService {
  private apiUrl = 'http://localhost:5000/api/users';

  constructor(private http: HttpClient) {}

  getMe(): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/me`);
  }

  getAll(): Observable<User[]> {
    return this.http.get<User[]>(this.apiUrl);
  }

  create(data: any): Observable<User> {
    return this.http.post<User>(this.apiUrl, data);
  }

  update(id: number, data: any): Observable<User> {
    return this.http.put<User>(`${this.apiUrl}/${id}`, data);
  }

  toggleStatus(id: number): Observable<User> {
    return this.http.patch<User>(`${this.apiUrl}/${id}/toggle-status`, {});
  }

  changePassword(currentPassword: string, newPassword: string): Observable<any> {
    return this.http.patch<any>(`${this.apiUrl}/me/password`, {
      currentPassword,
      newPassword,
    });
  }

  importUsers(users: any[]): Observable<{ imported: number; errors: Array<{ row: number; email: string; reason: string }> }> {
    return this.http.post<any>(`${this.apiUrl}/import`, { users });
  }

  downloadTemplate(): void {
    const template = [
      {
        name: 'João Silva',
        email: 'joao@empresa.com',
        password: 'Senha@123',
        role: 'colaborador',
        cpf: '000.000.000-00',
        department: 'Tecnologia',
        position: 'Desenvolvedor',
        phone: '(43) 99999-9999',
        workStartTime: '08:00',
        workEndTime: '17:00',
        hourlyRate: 25.00,
      },
    ];
    const blob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'template-importacao-usuarios.json';
    a.click();
    URL.revokeObjectURL(url);
  }
}
