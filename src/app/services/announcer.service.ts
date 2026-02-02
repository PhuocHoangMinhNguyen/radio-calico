import { Injectable, signal } from '@angular/core';

/**
 * Service for announcing messages to screen readers via ARIA live regions.
 * This service provides a centralized way to communicate dynamic content
 * changes to assistive technology users.
 */
@Injectable({
  providedIn: 'root',
})
export class AnnouncerService {
  private _announcement = signal<string>('');
  readonly announcement = this._announcement.asReadonly();

  /**
   * Announce a message to screen readers via aria-live region.
   * @param message The message to announce
   */
  announce(message: string): void {
    // Clear first to ensure repeated announcements work
    this._announcement.set('');

    // Use setTimeout to ensure DOM update triggers announcement
    setTimeout(() => {
      this._announcement.set(message);
    }, 100);
  }

  /**
   * Announce track change to screen readers.
   * @param title The track title
   * @param artist The track artist
   */
  announceTrackChange(title: string, artist: string): void {
    this.announce(`Now playing: ${title} by ${artist}`);
  }

  /**
   * Announce rating feedback to screen readers.
   * @param type The rating type ('up' or 'down')
   */
  announceRating(type: 'up' | 'down'): void {
    const rating = type === 'up' ? 'Liked' : 'Disliked';
    this.announce(`${rating} this track`);
  }

  /**
   * Announce playback state changes.
   * @param isPlaying Whether playback is currently active
   */
  announcePlaybackState(isPlaying: boolean): void {
    this.announce(isPlaying ? 'Playing' : 'Paused');
  }

  /**
   * Announce volume changes.
   * @param volume The new volume level (0-100)
   * @param isMuted Whether audio is muted
   */
  announceVolume(volume: number, isMuted: boolean): void {
    if (isMuted || volume === 0) {
      this.announce('Muted');
    } else {
      this.announce(`Volume ${Math.round(volume)}%`);
    }
  }
}
