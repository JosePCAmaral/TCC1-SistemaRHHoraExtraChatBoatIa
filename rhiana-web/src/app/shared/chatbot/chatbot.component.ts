import { Component, OnInit, signal, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatbotService, ChatMessage } from '../../core/services/chatbot.service';

@Component({
  selector: 'app-chatbot',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chatbot.component.html',
})
export class ChatbotComponent implements OnInit, AfterViewChecked {
  @ViewChild('messagesContainer') messagesContainer!: ElementRef;

  isOpen = signal(false);
  messages = signal<ChatMessage[]>([]);
  inputMessage = '';
  loading = signal(false);
  shouldScroll = false;

  constructor(private chatbotService: ChatbotService) {}

  ngOnInit() {
    this.messages.set([
      {
        role: 'assistant',
        content: 'Olá! Sou a RHIANA, sua assistente virtual de RH 👋\n\nPosso te ajudar com:\n• Consultar saldo de horas extras\n• Dúvidas sobre a CLT\n• Status de solicitações\n• Relatórios\n\nComo posso te ajudar?',
      }
    ]);
  }

  ngAfterViewChecked() {
    if (this.shouldScroll) {
      this.scrollToBottom();
      this.shouldScroll = false;
    }
  }

  toggleChat() {
    this.isOpen.set(!this.isOpen());
    if (this.isOpen()) {
      this.shouldScroll = true;
    }
  }

  sendMessage() {
    const message = this.inputMessage.trim();
    if (!message || this.loading()) return;

    this.messages.update(msgs => [...msgs, { role: 'user', content: message }]);
    this.inputMessage = '';
    this.loading.set(true);
    this.shouldScroll = true;

    this.chatbotService.sendMessage(message).subscribe({
      next: (response) => {
        this.chatbotService.currentSessionId = response.sessionId;
        this.messages.update(msgs => [...msgs, {
          role: 'assistant',
          content: response.response,
        }]);
        this.loading.set(false);
        this.shouldScroll = true;
      },
      error: () => {
        this.messages.update(msgs => [...msgs, {
          role: 'assistant',
          content: 'Desculpe, ocorreu um erro. Tente novamente.',
        }]);
        this.loading.set(false);
        this.shouldScroll = true;
      }
    });
  }

  onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  clearChat() {
    this.chatbotService.clearSession().subscribe();
    this.chatbotService.currentSessionId = null;
    this.ngOnInit();
  }

  private scrollToBottom() {
    try {
      const el = this.messagesContainer?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    } catch {}
  }

  formatMessage(content: string): string {
    return content.replace(/\n/g, '<br>');
  }
}