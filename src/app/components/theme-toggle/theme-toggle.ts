import { Component, inject, computed } from '@angular/core';
import { ThemeService } from '../../services/theme.service';

@Component({
  selector: 'app-theme-toggle',
  templateUrl: './theme-toggle.html',
  styleUrl: './theme-toggle.scss',
})
export class ThemeToggle {
  private readonly themeService = inject(ThemeService);

  readonly theme = this.themeService.theme;
  readonly isDark = computed(() => this.theme() === 'dark');

  toggle(): void {
    this.themeService.toggle();
  }
}
