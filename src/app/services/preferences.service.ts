import { Injectable, signal, effect } from '@angular/core';

export interface UserPreferences {
  volume: number; // 0-1 range
  isMuted: boolean;
  theme: 'dark' | 'light';
  notificationsEnabled: boolean;
}

const STORAGE_KEY = 'radio-calico-preferences';

const DEFAULT_PREFERENCES: UserPreferences = {
  volume: 0.8,
  isMuted: false,
  theme: 'dark',
  notificationsEnabled: false,
};

@Injectable({
  providedIn: 'root',
})
export class PreferencesService {
  // Signals for reactive preferences
  private _volume = signal<number>(DEFAULT_PREFERENCES.volume);
  private _isMuted = signal<boolean>(DEFAULT_PREFERENCES.isMuted);
  private _theme = signal<'dark' | 'light'>(DEFAULT_PREFERENCES.theme);
  private _notificationsEnabled = signal<boolean>(DEFAULT_PREFERENCES.notificationsEnabled);

  // Public readonly signals
  readonly volume = this._volume.asReadonly();
  readonly isMuted = this._isMuted.asReadonly();
  readonly theme = this._theme.asReadonly();
  readonly notificationsEnabled = this._notificationsEnabled.asReadonly();

  constructor() {
    this.loadPreferences();

    // Auto-save when any preference changes
    effect(() => {
      const prefs: UserPreferences = {
        volume: this._volume(),
        isMuted: this._isMuted(),
        theme: this._theme(),
        notificationsEnabled: this._notificationsEnabled(),
      };
      this.saveToStorage(prefs);
    });
  }

  /**
   * Load preferences from localStorage
   */
  private loadPreferences(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const prefs: Partial<UserPreferences> = JSON.parse(stored);

        if (typeof prefs.volume === 'number' && prefs.volume >= 0 && prefs.volume <= 1) {
          this._volume.set(prefs.volume);
        }
        if (typeof prefs.isMuted === 'boolean') {
          this._isMuted.set(prefs.isMuted);
        }
        if (prefs.theme === 'dark' || prefs.theme === 'light') {
          this._theme.set(prefs.theme);
        }
        if (typeof prefs.notificationsEnabled === 'boolean') {
          this._notificationsEnabled.set(prefs.notificationsEnabled);
        }
      }
    } catch (e) {
      console.warn('Failed to load preferences from localStorage:', e);
    }
  }

  /**
   * Save preferences to localStorage
   */
  private saveToStorage(prefs: UserPreferences): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch (e) {
      console.warn('Failed to save preferences to localStorage:', e);
    }
  }

  /**
   * Update volume preference
   */
  setVolume(volume: number): void {
    const clamped = Math.max(0, Math.min(1, volume));
    this._volume.set(clamped);
  }

  /**
   * Update muted state preference
   */
  setMuted(isMuted: boolean): void {
    this._isMuted.set(isMuted);
  }

  /**
   * Update theme preference
   */
  setTheme(theme: 'dark' | 'light'): void {
    this._theme.set(theme);
  }

  /**
   * Update notifications enabled preference
   */
  setNotificationsEnabled(enabled: boolean): void {
    this._notificationsEnabled.set(enabled);
  }

  /**
   * Reset all preferences to defaults
   */
  resetToDefaults(): void {
    this._volume.set(DEFAULT_PREFERENCES.volume);
    this._isMuted.set(DEFAULT_PREFERENCES.isMuted);
    this._theme.set(DEFAULT_PREFERENCES.theme);
    this._notificationsEnabled.set(DEFAULT_PREFERENCES.notificationsEnabled);
  }
}
