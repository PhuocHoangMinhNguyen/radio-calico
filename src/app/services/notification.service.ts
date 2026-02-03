import { Injectable, inject, signal } from '@angular/core';
import { PreferencesService } from './preferences.service';

export type NotificationPermissionState = 'default' | 'granted' | 'denied' | 'unsupported';

@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  private readonly preferencesService = inject(PreferencesService);

  private _permission = signal<NotificationPermissionState>(this.getInitialPermission());
  private _isEnabled = signal<boolean>(this.preferencesService.notificationsEnabled());

  readonly permission = this._permission.asReadonly();
  readonly isEnabled = this._isEnabled.asReadonly();

  /**
   * Check if notifications are supported in this browser
   */
  get isSupported(): boolean {
    return 'Notification' in window;
  }

  /**
   * Check if notifications can be shown (supported, granted, and enabled)
   */
  get canNotify(): boolean {
    return this.isSupported && this._permission() === 'granted' && this._isEnabled();
  }

  /**
   * Get initial permission state
   */
  private getInitialPermission(): NotificationPermissionState {
    if (!('Notification' in window)) {
      return 'unsupported';
    }
    return Notification.permission as NotificationPermissionState;
  }

  /**
   * Request notification permission from the user
   */
  async requestPermission(): Promise<NotificationPermissionState> {
    if (!this.isSupported) {
      return 'unsupported';
    }

    try {
      const result = await Notification.requestPermission();
      this._permission.set(result as NotificationPermissionState);

      // If granted, enable notifications by default
      if (result === 'granted') {
        this.setEnabled(true);
      }

      return result as NotificationPermissionState;
    } catch (e) {
      console.error('Failed to request notification permission:', e);
      return 'denied';
    }
  }

  /**
   * Enable or disable notifications (user preference)
   */
  setEnabled(enabled: boolean): void {
    this._isEnabled.set(enabled);
    this.preferencesService.setNotificationsEnabled(enabled);
  }

  /**
   * Toggle notifications enabled state
   */
  toggleEnabled(): void {
    this.setEnabled(!this._isEnabled());
  }

  /**
   * Show a notification for a track change
   * Only shows if page is hidden (backgrounded) and notifications are enabled
   */
  notifyTrackChange(title: string, artist: string, coverUrl: string | null): void {
    // Only notify if page is hidden (user is not actively viewing the app)
    if (!document.hidden) {
      return;
    }

    if (!this.canNotify) {
      return;
    }

    const options: NotificationOptions = {
      body: artist,
      icon: coverUrl || '/icons/icon-192.svg',
      badge: '/icons/icon-192.svg',
      tag: 'track-change', // Replace previous track notification
      silent: false,
    };

    try {
      const notification = new Notification(title, options);

      // Focus the app when notification is clicked
      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      // Auto-close after 5 seconds
      setTimeout(() => notification.close(), 5000);
    } catch (e) {
      console.warn('Failed to show notification:', e);
    }
  }
}
