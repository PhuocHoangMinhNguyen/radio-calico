import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { KeyboardShortcutService } from './keyboard-shortcut.service';
import { HlsPlayerService } from './hls-player.service';
import { RatingService } from './rating.service';

describe('KeyboardShortcutService', () => {
  let service: KeyboardShortcutService;
  let mockTogglePlayPause: ReturnType<typeof vi.fn>;
  let mockSetVolume: ReturnType<typeof vi.fn>;
  let mockSubmitRating: ReturnType<typeof vi.fn>;
  let volumeSignal: ReturnType<typeof signal<number>>;
  let userRatingSignal: ReturnType<typeof signal<'up' | 'down' | null>>;

  beforeEach(() => {
    volumeSignal = signal(0.5);
    const currentTrackSignal = signal({ title: 'Test Song', artist: 'Test Artist' });
    userRatingSignal = signal<'up' | 'down' | null>(null);

    mockTogglePlayPause = vi.fn();
    mockSetVolume = vi.fn();
    mockSubmitRating = vi.fn();

    const mockPlayerService = {
      togglePlayPause: mockTogglePlayPause,
      setVolume: mockSetVolume,
      volume: volumeSignal,
      currentTrack: currentTrackSignal,
    };

    const mockRatingService = {
      submitRating: mockSubmitRating,
      userRating: userRatingSignal,
    };

    TestBed.configureTestingModule({
      providers: [
        KeyboardShortcutService,
        { provide: HlsPlayerService, useValue: mockPlayerService },
        { provide: RatingService, useValue: mockRatingService },
      ],
    });

    service = TestBed.inject(KeyboardShortcutService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('Space key', () => {
    it('should toggle play/pause', () => {
      const event = new KeyboardEvent('keydown', { key: ' ' });
      const handled = service.handleKeyboardEvent(event);

      expect(handled).toBe(true);
      expect(mockTogglePlayPause).toHaveBeenCalled();
    });
  });

  describe('Arrow keys', () => {
    it('should increase volume on ArrowUp', () => {
      const event = new KeyboardEvent('keydown', { key: 'ArrowUp' });
      const handled = service.handleKeyboardEvent(event);

      expect(handled).toBe(true);
      expect(mockSetVolume).toHaveBeenCalledWith(55); // 0.5 + 0.05 = 0.55 * 100 (rounded)
    });

    it('should decrease volume on ArrowDown', () => {
      const event = new KeyboardEvent('keydown', { key: 'ArrowDown' });
      const handled = service.handleKeyboardEvent(event);

      expect(handled).toBe(true);
      expect(mockSetVolume).toHaveBeenCalledWith(45); // 0.5 - 0.05 = 0.45 * 100
    });
  });

  describe('M key', () => {
    it('should mute when pressing M', () => {
      const event = new KeyboardEvent('keydown', { key: 'm' });
      const handled = service.handleKeyboardEvent(event);

      expect(handled).toBe(true);
      expect(mockSetVolume).toHaveBeenCalledWith(0);
      expect(service.isMuted()).toBe(true);
    });

    it('should unmute when pressing M again', () => {
      // First press - mute
      service.handleKeyboardEvent(new KeyboardEvent('keydown', { key: 'm' }));
      expect(service.isMuted()).toBe(true);

      // Second press - unmute (should restore to 0.5 * 100 = 50)
      service.handleKeyboardEvent(new KeyboardEvent('keydown', { key: 'm' }));
      expect(service.isMuted()).toBe(false);
      expect(mockSetVolume).toHaveBeenLastCalledWith(50);
    });
  });

  describe('L key', () => {
    it('should like current track', () => {
      const event = new KeyboardEvent('keydown', { key: 'l' });
      const handled = service.handleKeyboardEvent(event);

      expect(handled).toBe(true);
      expect(mockSubmitRating).toHaveBeenCalledWith('Test Song', 'Test Artist', 'up');
    });

    it('should not like if already liked', () => {
      userRatingSignal.set('up');
      const event = new KeyboardEvent('keydown', { key: 'l' });
      service.handleKeyboardEvent(event);

      expect(mockSubmitRating).not.toHaveBeenCalled();
    });
  });

  describe('Input elements', () => {
    it('should not handle events when target is an input', () => {
      const input = document.createElement('input');
      const event = new KeyboardEvent('keydown', { key: ' ' });
      Object.defineProperty(event, 'target', { value: input });

      const handled = service.handleKeyboardEvent(event);

      expect(handled).toBe(false);
      expect(mockTogglePlayPause).not.toHaveBeenCalled();
    });
  });

  describe('getShortcuts', () => {
    it('should return list of available shortcuts', () => {
      const shortcuts = service.getShortcuts();

      expect(shortcuts.length).toBe(5);
      expect(shortcuts[0]).toEqual({ key: 'Space', description: 'Play/Pause' });
    });
  });

  describe('Unhandled keys', () => {
    it('should return false for unhandled keys', () => {
      const event = new KeyboardEvent('keydown', { key: 'x' });
      const handled = service.handleKeyboardEvent(event);

      expect(handled).toBe(false);
    });
  });
});
