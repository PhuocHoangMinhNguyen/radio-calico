import { Injectable, inject, effect } from '@angular/core';
import { PreferencesService } from './preferences.service';

export type Theme = 'dark' | 'light';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly preferencesService = inject(PreferencesService);

  readonly theme = this.preferencesService.theme;

  constructor() {
    // Apply theme on initialization and whenever it changes
    effect(() => {
      this.applyTheme(this.theme());
    });
  }

  /**
   * Set the theme
   */
  setTheme(theme: Theme): void {
    this.preferencesService.setTheme(theme);
  }

  /**
   * Toggle between dark and light themes
   */
  toggle(): void {
    const newTheme = this.theme() === 'dark' ? 'light' : 'dark';
    this.setTheme(newTheme);
  }

  /**
   * Apply theme to the document
   */
  private applyTheme(theme: Theme): void {
    document.documentElement.setAttribute('data-theme', theme);
  }
}
