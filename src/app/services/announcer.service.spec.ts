import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { AnnouncerService } from './announcer.service';

describe('AnnouncerService', () => {
  let service: AnnouncerService;

  beforeEach(() => {
    vi.useFakeTimers();

    TestBed.configureTestingModule({
      providers: [AnnouncerService],
    });

    service = TestBed.inject(AnnouncerService);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should create', () => {
    expect(service).toBeTruthy();
  });

  it('should initialize with empty announcement', () => {
    expect(service.announcement()).toBe('');
  });

  describe('announce', () => {
    it('should clear announcement first', () => {
      // Set initial announcement
      service.announce('Initial message');
      vi.advanceTimersByTime(100);
      expect(service.announcement()).toBe('Initial message');

      // New announcement should clear first
      service.announce('New message');
      expect(service.announcement()).toBe('');
    });

    it('should set announcement after 100ms delay', () => {
      service.announce('Test message');

      expect(service.announcement()).toBe('');

      vi.advanceTimersByTime(100);

      expect(service.announcement()).toBe('Test message');
    });

    it('should allow repeated identical announcements', () => {
      service.announce('Same message');
      vi.advanceTimersByTime(100);
      expect(service.announcement()).toBe('Same message');

      service.announce('Same message');
      expect(service.announcement()).toBe(''); // Cleared
      vi.advanceTimersByTime(100);
      expect(service.announcement()).toBe('Same message'); // Re-announced
    });
  });

  describe('announceTrackChange', () => {
    it('should announce track change with proper format', () => {
      service.announceTrackChange('Test Song', 'Test Artist');

      vi.advanceTimersByTime(100);

      expect(service.announcement()).toBe('Now playing: Test Song by Test Artist');
    });

    it('should handle special characters in track info', () => {
      service.announceTrackChange("Song's Title", 'Artist & Band');

      vi.advanceTimersByTime(100);

      expect(service.announcement()).toBe("Now playing: Song's Title by Artist & Band");
    });
  });

  describe('announceRating', () => {
    it('should announce thumbs up', () => {
      service.announceRating('up');

      vi.advanceTimersByTime(100);

      expect(service.announcement()).toBe('Liked this track');
    });

    it('should announce thumbs down', () => {
      service.announceRating('down');

      vi.advanceTimersByTime(100);

      expect(service.announcement()).toBe('Disliked this track');
    });
  });

  describe('announcePlaybackState', () => {
    it('should announce playing state', () => {
      service.announcePlaybackState(true);

      vi.advanceTimersByTime(100);

      expect(service.announcement()).toBe('Playing');
    });

    it('should announce paused state', () => {
      service.announcePlaybackState(false);

      vi.advanceTimersByTime(100);

      expect(service.announcement()).toBe('Paused');
    });
  });

  describe('announceVolume', () => {
    it('should announce volume percentage', () => {
      service.announceVolume(75, false);

      vi.advanceTimersByTime(100);

      expect(service.announcement()).toBe('Volume 75%');
    });

    it('should announce muted when isMuted is true', () => {
      service.announceVolume(50, true);

      vi.advanceTimersByTime(100);

      expect(service.announcement()).toBe('Muted');
    });

    it('should announce muted when volume is 0', () => {
      service.announceVolume(0, false);

      vi.advanceTimersByTime(100);

      expect(service.announcement()).toBe('Muted');
    });

    it('should round volume to nearest integer', () => {
      service.announceVolume(75.6, false);

      vi.advanceTimersByTime(100);

      expect(service.announcement()).toBe('Volume 76%');
    });

    it('should handle low volume', () => {
      service.announceVolume(5, false);

      vi.advanceTimersByTime(100);

      expect(service.announcement()).toBe('Volume 5%');
    });

    it('should handle max volume', () => {
      service.announceVolume(100, false);

      vi.advanceTimersByTime(100);

      expect(service.announcement()).toBe('Volume 100%');
    });
  });

  describe('multiple rapid announcements', () => {
    it('should handle rapid announcement changes', () => {
      service.announce('First');
      vi.advanceTimersByTime(50); // Only advance 50ms (need 100ms for 'First')

      service.announce('Second'); // This clears announcement but doesn't cancel the first timeout
      vi.advanceTimersByTime(50); // Total 100ms - 'First' timeout fires now

      // First announcement timeout has fired (100ms elapsed since 'First' was announced)
      expect(service.announcement()).toBe('First');

      vi.advanceTimersByTime(50); // Total 150ms - 'Second' timeout fires now

      // Second announcement should now be set
      expect(service.announcement()).toBe('Second');
    });
  });
});
