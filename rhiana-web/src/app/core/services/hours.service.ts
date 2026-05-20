import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { HourRecord, MonthlySummary } from '../models/hour.model';

@Injectable({ providedIn: 'root' })
export class HoursService {
  private apiUrl = 'http://localhost:5000/api/hours';

  constructor(private http: HttpClient) {}

  clockIn(observation?: string): Observable<HourRecord> {
    return this.http.post<HourRecord>(`${this.apiUrl}/clock`, { observation });
  }

  manualRecord(data: {
    userId: number;
    date: string;
    time: string;
    type: 'entrada' | 'saida';
    dayType: string;
    observation?: string;
  }): Observable<HourRecord> {
    return this.http.post<HourRecord>(`${this.apiUrl}/manual`, data);
  }

  updateRecord(id: number, data: any): Observable<HourRecord> {
    return this.http.patch<HourRecord>(`${this.apiUrl}/${id}`, data);
  }

  deleteRecord(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }

  getAllRecordsByDate(date: string): Observable<HourRecord[]> {
    return this.http.get<HourRecord[]>(`${this.apiUrl}/all/date?date=${date}`);
  }

  getRecordsByUserAndDate(userId: number, date: string): Observable<HourRecord[]> {
    return this.http.get<HourRecord[]>(`${this.apiUrl}/user/${userId}/date?date=${date}`);
  }

  getTodayRecords(): Observable<HourRecord[]> {
    return this.http.get<HourRecord[]>(`${this.apiUrl}/me/today`);
  }

  getMyMonthlySummary(year: number, month: number): Observable<MonthlySummary> {
    return this.http.get<MonthlySummary>(
      `${this.apiUrl}/me/summary?year=${year}&month=${month}`
    );
  }

  getMonthlySummary(userId: number, year: number, month: number): Observable<MonthlySummary> {
    return this.http.get<MonthlySummary>(
      `${this.apiUrl}/user/${userId}/summary?year=${year}&month=${month}`
    );
  }

  getPeriodRecords(userId: number, startDate: string, endDate: string): Observable<HourRecord[]> {
    return this.http.get<HourRecord[]>(
      `${this.apiUrl}/user/${userId}/period?startDate=${startDate}&endDate=${endDate}`
    );
  }

  getAllTodayRecords(): Observable<HourRecord[]> {
    return this.http.get<HourRecord[]>(`${this.apiUrl}/all/today`);
  }
}
