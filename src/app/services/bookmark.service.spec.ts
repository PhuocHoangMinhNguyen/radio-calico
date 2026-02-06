import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BookmarkService, BookmarkedTrack } from './bookmark.service';

// ---------------------------------------------------------------------------
// localStorage stub — Node's test environment lacks full Web Storage support.
// vi.stubGlobal replaces globalThis.localStorage for the entire file.
// ---------------------------------------------------------------------------
let lsStore: Record<string, string> = {};

vi.stubGlobal('localStorage', {
  getItem(key: string) {
    return lsStore[key] ?? null;
  },
  setItem(key: string, value: string) {
    lsStore[key] = String(value);
  },
  removeItem(key: string) {
    delete lsStore[key];
  },
  clear() {
    lsStore = {};
  },
});

describe('BookmarkService', () => {
  let service: BookmarkService;

  beforeEach(() => {
    lsStore = {};
    TestBed.configureTestingModule({ providers: [BookmarkService] });
    service = TestBed.inject(BookmarkService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should start with empty bookmarks when localStorage is empty', () => {
    expect(service.bookmarks()).toEqual([]);
    expect(service.count()).toBe(0);
  });

  it('should load bookmarks from localStorage on initialization', () => {
    const stored: BookmarkedTrack[] = [
      { title: 'Song 1', artist: 'Artist 1', savedAt: 1000 },
      { title: 'Song 2', artist: 'Artist 2', savedAt: 2000 },
    ];
    localStorage.setItem('radio-calico-bookmarks', JSON.stringify(stored));

    // Re-inject service to trigger loadFromStorage
    service = TestBed.inject(BookmarkService);

    expect(service.bookmarks()).toEqual(stored);
    expect(service.count()).toBe(2);
  });

  it('should return empty array when localStorage contains corrupted JSON', () => {
    localStorage.setItem('radio-calico-bookmarks', '{not valid json');

    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    service = TestBed.inject(BookmarkService);

    expect(service.bookmarks()).toEqual([]);
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      '[BookmarkService] Failed to load bookmarks:',
      expect.any(Error)
    );

    consoleWarnSpy.mockRestore();
  });

  // -------------------------------------------------------------------------
  // add()
  // -------------------------------------------------------------------------
  describe('add', () => {
    it('adds a new bookmark and persists to localStorage', () => {
      service.add('Test Song', 'Test Artist');

      const bookmarks = service.bookmarks();
      expect(bookmarks.length).toBe(1);
      expect(bookmarks[0].title).toBe('Test Song');
      expect(bookmarks[0].artist).toBe('Test Artist');
      expect(bookmarks[0].savedAt).toBeGreaterThan(0);

      const stored = JSON.parse(localStorage.getItem('radio-calico-bookmarks')!);
      expect(stored).toEqual(bookmarks);
    });

    it('does not add duplicate bookmarks', () => {
      service.add('Song', 'Artist');
      service.add('Song', 'Artist');

      expect(service.count()).toBe(1);
    });

    it('prepends new bookmarks to the beginning of the list', () => {
      service.add('First', 'Artist');
      service.add('Second', 'Artist');

      const bookmarks = service.bookmarks();
      expect(bookmarks[0].title).toBe('Second');
      expect(bookmarks[1].title).toBe('First');
    });

    it('evicts oldest bookmark when limit of 50 is reached', () => {
      // Add 50 bookmarks
      for (let i = 1; i <= 50; i++) {
        service.add(`Song ${i}`, `Artist ${i}`);
      }

      expect(service.count()).toBe(50);

      // Add one more, should evict the oldest (Song 1)
      service.add('Song 51', 'Artist 51');

      expect(service.count()).toBe(50);
      expect(service.bookmarks()[0].title).toBe('Song 51');
      expect(service.bookmarks()[49].title).toBe('Song 2'); // Song 1 was evicted
      expect(service.isBookmarked('Song 1', 'Artist 1')).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // remove()
  // -------------------------------------------------------------------------
  describe('remove', () => {
    it('removes a bookmark and persists to localStorage', () => {
      service.add('Song 1', 'Artist 1');
      service.add('Song 2', 'Artist 2');

      service.remove('Song 1', 'Artist 1');

      expect(service.count()).toBe(1);
      expect(service.bookmarks()[0].title).toBe('Song 2');

      const stored = JSON.parse(localStorage.getItem('radio-calico-bookmarks')!);
      expect(stored.length).toBe(1);
      expect(stored[0].title).toBe('Song 2');
    });

    it('does nothing when removing a non-existent bookmark', () => {
      service.add('Song 1', 'Artist 1');

      service.remove('Nonexistent', 'Nobody');

      expect(service.count()).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // toggle()
  // -------------------------------------------------------------------------
  describe('toggle', () => {
    it('adds a bookmark when it does not exist and returns true', () => {
      const result = service.toggle('Song', 'Artist');

      expect(result).toBe(true);
      expect(service.isBookmarked('Song', 'Artist')).toBe(true);
    });

    it('removes a bookmark when it exists and returns false', () => {
      service.add('Song', 'Artist');

      const result = service.toggle('Song', 'Artist');

      expect(result).toBe(false);
      expect(service.isBookmarked('Song', 'Artist')).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // isBookmarked()
  // -------------------------------------------------------------------------
  describe('isBookmarked', () => {
    it('returns true when track is bookmarked', () => {
      service.add('Song', 'Artist');

      expect(service.isBookmarked('Song', 'Artist')).toBe(true);
    });

    it('returns false when track is not bookmarked', () => {
      expect(service.isBookmarked('Song', 'Artist')).toBe(false);
    });

    it('matches on both title and artist', () => {
      service.add('Song', 'Artist 1');

      expect(service.isBookmarked('Song', 'Artist 1')).toBe(true);
      expect(service.isBookmarked('Song', 'Artist 2')).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // clearAll()
  // -------------------------------------------------------------------------
  describe('clearAll', () => {
    it('removes all bookmarks and persists to localStorage', () => {
      service.add('Song 1', 'Artist 1');
      service.add('Song 2', 'Artist 2');
      service.add('Song 3', 'Artist 3');

      service.clearAll();

      expect(service.count()).toBe(0);
      expect(service.bookmarks()).toEqual([]);

      const stored = JSON.parse(localStorage.getItem('radio-calico-bookmarks')!);
      expect(stored).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // Error handling
  // -------------------------------------------------------------------------
  describe('error handling', () => {
    it('logs a warning and continues when localStorage.setItem fails', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Make setItem throw an error (e.g., quota exceeded)
      vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
        throw new DOMException('QuotaExceededError');
      });

      service.add('Song', 'Artist');

      // Service still updates in-memory state
      expect(service.count()).toBe(1);

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[BookmarkService] Failed to save bookmarks:',
        expect.any(DOMException)
      );

      consoleWarnSpy.mockRestore();
    });
  });
});
