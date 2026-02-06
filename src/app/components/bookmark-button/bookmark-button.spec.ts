import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { BookmarkButton } from './bookmark-button';
import { BookmarkService } from '../../services/bookmark.service';
import { HlsPlayerService } from '../../services/hls-player.service';

describe('BookmarkButton', () => {
  let component: BookmarkButton;
  let mockBookmarkService: any;
  let mockHlsService: any;

  beforeEach(() => {
    // Mock BookmarkService
    mockBookmarkService = {
      isBookmarked: vi.fn().mockReturnValue(false),
      toggle: vi.fn(),
    };

    // Mock HlsPlayerService
    mockHlsService = {
      currentTrack: signal(null as any),
      hasTrackInfo: signal(false),
    };

    TestBed.configureTestingModule({
      providers: [
        BookmarkButton,
        { provide: BookmarkService, useValue: mockBookmarkService },
        { provide: HlsPlayerService, useValue: mockHlsService },
      ],
    });

    component = TestBed.inject(BookmarkButton);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should expose HlsPlayerService signals', () => {
    expect(component.hasTrackInfo).toBe(mockHlsService.hasTrackInfo);
    expect(component.currentTrack).toBe(mockHlsService.currentTrack);
  });

  describe('isBookmarked computed', () => {
    it('should return false when no track', () => {
      mockHlsService.currentTrack.set(null);

      expect(component.isBookmarked()).toBe(false);
      expect(mockBookmarkService.isBookmarked).not.toHaveBeenCalled();
    });

    it('should check if track is bookmarked', () => {
      const track = { title: 'Test Song', artist: 'Test Artist', duration: 180 };
      mockHlsService.currentTrack.set(track);
      mockBookmarkService.isBookmarked.mockReturnValue(true);

      expect(component.isBookmarked()).toBe(true);
      expect(mockBookmarkService.isBookmarked).toHaveBeenCalledWith('Test Song', 'Test Artist');
    });

    it('should return false when track is not bookmarked', () => {
      const track = { title: 'Test Song', artist: 'Test Artist', duration: 180 };
      mockHlsService.currentTrack.set(track);
      mockBookmarkService.isBookmarked.mockReturnValue(false);

      expect(component.isBookmarked()).toBe(false);
    });

    it('should update when track changes', () => {
      const track1 = { title: 'Song 1', artist: 'Artist 1', duration: 180 };
      const track2 = { title: 'Song 2', artist: 'Artist 2', duration: 200 };

      mockHlsService.currentTrack.set(track1);
      component.isBookmarked();

      mockHlsService.currentTrack.set(track2);
      component.isBookmarked();

      expect(mockBookmarkService.isBookmarked).toHaveBeenCalledWith('Song 1', 'Artist 1');
      expect(mockBookmarkService.isBookmarked).toHaveBeenCalledWith('Song 2', 'Artist 2');
    });
  });

  describe('onToggleBookmark', () => {
    it('should toggle bookmark for current track', () => {
      const track = { title: 'Test Song', artist: 'Test Artist', duration: 180 };
      mockHlsService.currentTrack.set(track);

      component.onToggleBookmark();

      expect(mockBookmarkService.toggle).toHaveBeenCalledWith('Test Song', 'Test Artist');
    });

    it('should not toggle when no track', () => {
      mockHlsService.currentTrack.set(null);

      component.onToggleBookmark();

      expect(mockBookmarkService.toggle).not.toHaveBeenCalled();
    });

    it('should handle multiple toggles', () => {
      const track = { title: 'Test Song', artist: 'Test Artist', duration: 180 };
      mockHlsService.currentTrack.set(track);

      component.onToggleBookmark();
      component.onToggleBookmark();
      component.onToggleBookmark();

      expect(mockBookmarkService.toggle).toHaveBeenCalledTimes(3);
    });
  });
});
