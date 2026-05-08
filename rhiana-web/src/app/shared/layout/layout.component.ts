import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { HeaderComponent } from '../header/header.component';
import { ChatbotComponent } from '../chatbot/chatbot.component';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, SidebarComponent, HeaderComponent, ChatbotComponent],
  templateUrl: './layout.component.html',
})
export class LayoutComponent {
  sidebarOpen = signal(true);

  toggleSidebar() {
    this.sidebarOpen.set(!this.sidebarOpen());
  }
}