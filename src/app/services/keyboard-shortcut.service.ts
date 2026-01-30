import { Injectable, inject, signal } from '@angular/core';
import { HlsPlayerService } from './hls-player.service';
import { RatingService } from './rating.service';

export interface ShortcutAction {
  key: string;
  description: string;
  action: () => void;
}

@Injectable({
  providedIn: 'root',
})
export class KeyboardShortcutService {
  private readonly playerService = inject(HlsPlayerService);
  private readonly ratingService = inject(RatingService);

  // Store previous volume for mute/unmute toggle
  private _previousVolume = signal<number>(0.8);
  private _isMuted = signal<boolean>(false);

  readonly isMuted = this._isMuted.asReadonly();

  /**
   * Handle keyboard events and execute corresponding actions
   * Returns true if the event was handled, false otherwise
   */
  handleKeyboardEvent(event: KeyboardEvent): boolean {
    // Don't handle if user is typing in an input field
    if (this.isInputElement(event.target)) {
      return false;
    }

    const key = event.key.toLowerCase();

    switch (key) {
      case ' ':
        event.preventDefault();
        this.togglePlayPause();
        return true;

      case 'arrowup':
        event.preventDefault();
        this.volumeUp();
        return true;

      case 'arrowdown':
        event.preventDefault();
        this.volumeDown();
        return true;

      case 'm':
        event.preventDefault();
        this.toggleMute();
        return true;

      case 'l':
        event.preventDefault();
        this.toggleLike();
        return true;

      default:
        return false;
    }
  }

  /**
   * Toggle play/pause
   */
  private togglePlayPause(): void {
    this.playerService.togglePlayPause();
  }

  /**
   * Increase volume by 5%
   */
  private volumeUp(): void {
    const currentVolume = this.playerService.volume();
    const newVolume = Math.min(1, currentVolume + 0.05);
    // Round to avoid floating-point precision issues
    this.playerService.setVolume(Math.round(newVolume * 100));

    // If unmuting via volume up, clear muted state
    if (this._isMuted() && newVolume > 0) {
      this._isMuted.set(false);
    }
  }

  /**
   * Decrease volume by 5%
   */
  private volumeDown(): void {
    const currentVolume = this.playerService.volume();
    const newVolume = Math.max(0, currentVolume - 0.05);
    // Round to avoid floating-point precision issues
    this.playerService.setVolume(Math.round(newVolume * 100));

    // If volume reaches 0, consider it muted
    if (newVolume === 0) {
      this._isMuted.set(true);
    }
  }

  /**
   * Toggle mute/unmute
   */
  private toggleMute(): void {
    const currentVolume = this.playerService.volume();

    if (this._isMuted() || currentVolume === 0) {
      // Unmute: restore previous volume
      const restoreVolume = this._previousVolume() || 0.8;
      this.playerService.setVolume(restoreVolume * 100);
      this._isMuted.set(false);
    } else {
      // Mute: save current volume and set to 0
      this._previousVolume.set(currentVolume);
      this.playerService.setVolume(0);
      this._isMuted.set(true);
    }
  }

  /**
   * Toggle like on current track
   */
  private toggleLike(): void {
    const currentTrack = this.playerService.currentTrack();
    if (!currentTrack) return;

    const currentRating = this.ratingService.userRating();

    if (currentRating === 'up') {
      // Already liked - we don't have an "unlike" API, so this is a no-op
      // In a real app, you might want to add an unlike endpoint
      return;
    }

    // Like the track
    this.ratingService.submitRating(currentTrack.title, currentTrack.artist, 'up');
  }

  /**
   * Check if the event target is an input element
   */
  private isInputElement(target: EventTarget | null): boolean {
    if (!target) return false;
    const tagName = (target as HTMLElement).tagName?.toLowerCase();
    return (
      tagName === 'input' ||
      tagName === 'textarea' ||
      tagName === 'select' ||
      (target as HTMLElement).isContentEditable
    );
  }

  /**
   * Get list of available shortcuts for display
   */
  getShortcuts(): { key: string; description: string }[] {
    return [
      { key: 'Space', description: 'Play/Pause' },
      { key: '↑', description: 'Volume up (5%)' },
      { key: '↓', description: 'Volume down (5%)' },
      { key: 'M', description: 'Mute/Unmute' },
      { key: 'L', description: 'Like current track' },
    ];
  }
}
