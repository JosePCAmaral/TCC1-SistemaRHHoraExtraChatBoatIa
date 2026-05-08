import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ReportsService {
  private apiUrl = 'http://localhost:5000/api/reports';

  constructor(private http: HttpClient) {}

  getDashboard(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/dashboard`);
  }

  getMyReport(startDate: string, endDate: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/individual/me?startDate=${startDate}&endDate=${endDate}`);
  }

  getIndividualReport(userId: number, startDate: string, endDate: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/individual/${userId}?startDate=${startDate}&endDate=${endDate}`);
  }

  getCollectiveReport(startDate: string, endDate: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/collective?startDate=${startDate}&endDate=${endDate}`);
  }
}
