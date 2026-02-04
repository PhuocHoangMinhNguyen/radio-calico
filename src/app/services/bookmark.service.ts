import { Injectable, signal, computed } from '@angular/core';

export interface BookmarkedTrack {
  title: string;
  artist: string;
  savedAt: number; // timestamp
}

const STORAGE_KEY = 'radio-calico-bookmarks';
const MAX_BOOKMARKS = 50;

@Injectable({
  providedIn: 'root',
})
export class BookmarkService {
  private _bookmarks = signal<BookmarkedTrack[]>(this.loadFromStorage());

  readonly bookmarks = this._bookmarks.asReadonly();
  readonly count = computed(() => this._bookmarks().length);

  /**
   * Check if a track is bookmarked
   */
  isBookmarked(title: string, artist: string): boolean {
    return this._bookmarks().some((b) => b.title === title && b.artist === artist);
  }

  /**
   * Computed signal to check if current track is bookmarked
   */
  isTrackBookmarked(title: string, artist: string) {
    return computed(() => this.isBookmarked(title, artist));
  }

  /**
   * Toggle bookmark status for a track
   */
  toggle(title: string, artist: string): boolean {
    if (this.isBookmarked(title, artist)) {
      this.remove(title, artist);
      return false;
    } else {
      this.add(title, artist);
      return true;
    }
  }

  /**
   * Add a track to bookmarks
   */
  add(title: string, artist: string): void {
    if (this.isBookmarked(title, artist)) return;

    const newBookmark: BookmarkedTrack = {
      title,
      artist,
      savedAt: Date.now(),
    };

    this._bookmarks.update((bookmarks) => {
      const updated = [newBookmark, ...bookmarks];
      // Limit to MAX_BOOKMARKS
      if (updated.length > MAX_BOOKMARKS) {
        updated.pop();
      }
      return updated;
    });

    this.saveToStorage();
  }

  /**
   * Remove a track from bookmarks
   */
  remove(title: string, artist: string): void {
    this._bookmarks.update((bookmarks) =>
      bookmarks.filter((b) => !(b.title === title && b.artist === artist))
    );
    this.saveToStorage();
  }

  /**
   * Clear all bookmarks
   */
  clearAll(): void {
    this._bookmarks.set([]);
    this.saveToStorage();
  }

  private loadFromStorage(): BookmarkedTrack[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn('[BookmarkService] Failed to load bookmarks:', e);
    }
    return [];
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this._bookmarks()));
    } catch (e) {
      console.warn('[BookmarkService] Failed to save bookmarks:', e);
    }
  }
}
