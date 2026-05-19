import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  createdAt?: string;
}

@Injectable({ providedIn: 'root' })
export class ChatbotService {
  private apiUrl = 'http://localhost:5000/api/chatbot';
  currentSessionId: string | null = null;

  constructor(private http: HttpClient) {}

  sendMessage(message: string): Observable<{ response: string; sessionId: string }> {
    return this.http.post<{ response: string; sessionId: string }>(`${this.apiUrl}/message`, {
      message,
      sessionId: this.currentSessionId,
    });
  }

  clearSession(): Observable<any> {
    if (!this.currentSessionId) return new Observable();
    return this.http.delete(`${this.apiUrl}/session/${this.currentSessionId}`);
  }
}
