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

    const previousBookmarks = this._bookmarks();

    this._bookmarks.update((bookmarks) => {
      const updated = [newBookmark, ...bookmarks];
      // Limit to MAX_BOOKMARKS
      if (updated.length > MAX_BOOKMARKS) {
        updated.pop();
      }
      return updated;
    });

    // Try to save and revert if it fails
    if (!this.saveToStorage()) {
      // Revert to previous state on failure
      this._bookmarks.set(previousBookmarks);
      this.showQuotaExceededNotification();
    }
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

  private saveToStorage(): boolean {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this._bookmarks()));
      return true;
    } catch (e) {
      console.error('[BookmarkService] Failed to save bookmarks:', e);
      return false;
    }
  }

  private showQuotaExceededNotification(): void {
    // Show user-visible notification about quota exceeded
    // In a real app, this would use a toast/snackbar service
    console.error(
      '[BookmarkService] localStorage quota exceeded. Unable to save bookmark. Please clear some bookmarks or browser data.'
    );

    // You could also dispatch an event or use a notification service here
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Bookmark Failed', {
        body: 'Unable to save bookmark. Storage quota exceeded.',
        icon: '/favicon.ico',
      });
    }
  }
}
