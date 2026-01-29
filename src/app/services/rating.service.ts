import { Injectable, signal } from '@angular/core';
import { SongRatings } from '../models/track-info';

const STORAGE_PREFIX = 'rated:';

@Injectable({
  providedIn: 'root',
})
export class RatingService {
  private _ratings = signal<SongRatings>({ thumbs_up: 0, thumbs_down: 0 });
  private _userRating = signal<'up' | 'down' | null>(null);

  readonly ratings = this._ratings.asReadonly();
  readonly userRating = this._userRating.asReadonly();

  async fetchRatings(title: string, artist: string): Promise<void> {
    this._ratings.set({ thumbs_up: 0, thumbs_down: 0 });
    this._userRating.set(this.getStoredRating(title, artist));

    try {
      const params = new URLSearchParams({ title, artist });
      const response = await fetch(`/api/ratings?${params}`);
      if (!response.ok) return;
      const data: SongRatings = await response.json();
      this._ratings.set(data);
    } catch (e) {
      console.warn('Failed to fetch ratings:', e);
    }
  }

  async submitRating(title: string, artist: string, rating: 'up' | 'down'): Promise<void> {
    try {
      const response = await fetch('/api/ratings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, artist, rating }),
      });
      if (!response.ok) return;
      const data: SongRatings = await response.json();
      this._ratings.set(data);
      this._userRating.set(rating);
      localStorage.setItem(`${STORAGE_PREFIX}${title}::${artist}`, rating);
    } catch (e) {
      console.warn('Failed to submit rating:', e);
    }
  }

  private getStoredRating(title: string, artist: string): 'up' | 'down' | null {
    const stored = localStorage.getItem(`${STORAGE_PREFIX}${title}::${artist}`);
    return stored === 'up' || stored === 'down' ? stored : null;
  }
}
