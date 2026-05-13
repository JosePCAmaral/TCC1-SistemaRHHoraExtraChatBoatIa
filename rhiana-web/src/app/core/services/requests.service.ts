import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Request, CreateRequest } from '../models/request.model';

@Injectable({ providedIn: 'root' })
export class RequestsService {
  private apiUrl = 'http://localhost:5000/api/requests';

  constructor(private http: HttpClient) {}

  create(data: CreateRequest): Observable<Request> {
    return this.http.post<Request>(this.apiUrl, data);
  }

  getMyRequests(): Observable<Request[]> {
    return this.http.get<Request[]>(`${this.apiUrl}/me`);
  }

  getAllRequests(): Observable<Request[]> {
    return this.http.get<Request[]>(this.apiUrl);
  }

  getPendingRequests(): Observable<Request[]> {
    return this.http.get<Request[]>(`${this.apiUrl}/pending`);
  }

  review(id: number, status: string, comment?: string): Observable<Request> {
    return this.http.patch<Request>(`${this.apiUrl}/${id}/review`, {
      status,
      reviewerComment: comment,
    });
  }

  cancel(id: number): Observable<Request> {
    return this.http.patch<Request>(`${this.apiUrl}/${id}/cancel`, {});
  }

  getRequestWithBalance(id: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${id}/balance`);
  }
}
