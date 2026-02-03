import { Component, inject } from '@angular/core';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-notification-toggle',
  imports: [],
  templateUrl: './notification-toggle.html',
  styleUrl: './notification-toggle.scss',
})
export class NotificationToggle {
  private readonly notificationService = inject(NotificationService);

  readonly permission = this.notificationService.permission;
  readonly isEnabled = this.notificationService.isEnabled;
  readonly isSupported = this.notificationService.isSupported;

  async onRequestPermission(): Promise<void> {
    await this.notificationService.requestPermission();
  }

  onToggle(): void {
    this.notificationService.toggleEnabled();
  }
}
