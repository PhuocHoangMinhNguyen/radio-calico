import { Component, HostListener, inject } from '@angular/core';
import { Sidebar } from './components/sidebar/sidebar';
import { NowPlayingHero } from './components/now-playing-hero/now-playing-hero';
import { RecentlyPlayed } from './components/recently-played/recently-played';
import { PlayerBar } from './components/player-bar/player-bar';
import { KeyboardShortcutService } from './services/keyboard-shortcut.service';
import { AnnouncerService } from './services/announcer.service';
import { ThemeService } from './services/theme.service';

@Component({
  selector: 'app-root',
  imports: [Sidebar, NowPlayingHero, RecentlyPlayed, PlayerBar],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly keyboardService = inject(KeyboardShortcutService);
  private readonly announcerService = inject(AnnouncerService);
  private readonly themeService = inject(ThemeService); // Initialize theme on app start

  /** Expose announcement signal for live region in template */
  readonly announcement = this.announcerService.announcement;

  @HostListener('document:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent): void {
    this.keyboardService.handleKeyboardEvent(event);
  }
}
