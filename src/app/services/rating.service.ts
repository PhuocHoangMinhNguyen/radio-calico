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
      this._ratings.set({ thumbs_up: data.thumbs_up, thumbs_down: data.thumbs_down });
      // Server's IP-based vote takes precedence over localStorage
      if (data.user_vote) {
        this._userRating.set(data.user_vote);
      }
    } catch (e) {
      console.warn('Failed to fetch ratings:', e);
    }
  }

  async submitRating(title: string, artist: string, rating: 'up' | 'down'): Promise<void> {
    const currentRating = this._userRating();

    // If clicking the same rating, do nothing (or could implement toggle-off)
    if (currentRating === rating) {
      return;
    }

    // Optimistically update UI
    const prevRatings = this._ratings();
    const newRatings = { ...prevRatings };

    // If changing vote, adjust counts
    if (currentRating) {
      // Remove old vote
      if (currentRating === 'up') newRatings.thumbs_up = Math.max(0, newRatings.thumbs_up - 1);
      else newRatings.thumbs_down = Math.max(0, newRatings.thumbs_down - 1);
    }

    // Add new vote
    if (rating === 'up') newRatings.thumbs_up++;
    else newRatings.thumbs_down++;

    this._ratings.set(newRatings);
    this._userRating.set(rating);
    localStorage.setItem(`${STORAGE_PREFIX}${title}::${artist}`, rating);

    try {
      const response = await fetch('/api/ratings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, artist, rating }),
      });
      const data: SongRatings = await response.json();

      // Update with server response (source of truth)
      if (response.ok || response.status === 409) {
        this._ratings.set({ thumbs_up: data.thumbs_up, thumbs_down: data.thumbs_down });
        if (data.user_vote) {
          this._userRating.set(data.user_vote);
          localStorage.setItem(`${STORAGE_PREFIX}${title}::${artist}`, data.user_vote);
        }
      }
    } catch (e) {
      // Revert on error
      this._ratings.set(prevRatings);
      this._userRating.set(currentRating);
      if (currentRating) {
        localStorage.setItem(`${STORAGE_PREFIX}${title}::${artist}`, currentRating);
      } else {
        localStorage.removeItem(`${STORAGE_PREFIX}${title}::${artist}`);
      }
      console.warn('Failed to submit rating:', e);
    }
  }

  private getStoredRating(title: string, artist: string): 'up' | 'down' | null {
    const stored = localStorage.getItem(`${STORAGE_PREFIX}${title}::${artist}`);
    return stored === 'up' || stored === 'down' ? stored : null;
  }
}
