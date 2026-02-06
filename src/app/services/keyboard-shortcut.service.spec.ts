import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { KeyboardShortcutService } from './keyboard-shortcut.service';
import { HlsPlayerService } from './hls-player.service';
import { RatingService } from './rating.service';
import { PreferencesService } from './preferences.service';

describe('KeyboardShortcutService', () => {
  let service: KeyboardShortcutService;
  let mockTogglePlayPause: ReturnType<typeof vi.fn>;
  let mockSetVolume: ReturnType<typeof vi.fn>;
  let mockSubmitRating: ReturnType<typeof vi.fn>;
  let mockSetMuted: ReturnType<typeof vi.fn>;
  let volumeSignal: ReturnType<typeof signal<number>>;
  let userRatingSignal: ReturnType<typeof signal<'up' | 'down' | null>>;
  let mockPreferencesService: any;

  beforeEach(() => {
    volumeSignal = signal(0.5);
    const currentTrackSignal = signal({ title: 'Test Song', artist: 'Test Artist' });
    userRatingSignal = signal<'up' | 'down' | null>(null);

    mockTogglePlayPause = vi.fn();
    mockSetVolume = vi.fn();
    mockSubmitRating = vi.fn();
    mockSetMuted = vi.fn();

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

    mockPreferencesService = {
      volume: signal(0.8),
      isMuted: signal(false),
      setMuted: mockSetMuted,
    };

    TestBed.configureTestingModule({
      providers: [
        KeyboardShortcutService,
        { provide: HlsPlayerService, useValue: mockPlayerService },
        { provide: RatingService, useValue: mockRatingService },
        { provide: PreferencesService, useValue: mockPreferencesService },
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

    it('should call preventDefault on Space key', () => {
      const event = new KeyboardEvent('keydown', { key: ' ' });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

      service.handleKeyboardEvent(event);

      expect(preventDefaultSpy).toHaveBeenCalled();
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

    it('should not exceed max volume (1.0)', () => {
      volumeSignal.set(0.98); // Close to max
      const event = new KeyboardEvent('keydown', { key: 'ArrowUp' });

      service.handleKeyboardEvent(event);

      // Should cap at 100 (1.0 * 100)
      expect(mockSetVolume).toHaveBeenCalledWith(100);
    });

    it('should not go below min volume (0)', () => {
      volumeSignal.set(0.02); // Close to min
      const event = new KeyboardEvent('keydown', { key: 'ArrowDown' });

      service.handleKeyboardEvent(event);

      // Should cap at 0
      expect(mockSetVolume).toHaveBeenCalledWith(0);
    });

    it('should call preventDefault on arrow keys', () => {
      const event = new KeyboardEvent('keydown', { key: 'ArrowUp' });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

      service.handleKeyboardEvent(event);

      expect(preventDefaultSpy).toHaveBeenCalled();
    });

    it('should clear muted state when increasing volume from 0', () => {
      volumeSignal.set(0);
      service['_isMuted'].set(true);
      const event = new KeyboardEvent('keydown', { key: 'ArrowUp' });

      service.handleKeyboardEvent(event);

      expect(service.isMuted()).toBe(false);
      expect(mockSetMuted).toHaveBeenCalledWith(false);
    });

    it('should set muted state when decreasing volume to 0', () => {
      volumeSignal.set(0.05); // Will become 0 after decrease
      const event = new KeyboardEvent('keydown', { key: 'ArrowDown' });

      service.handleKeyboardEvent(event);

      expect(service.isMuted()).toBe(true);
      expect(mockSetMuted).toHaveBeenCalledWith(true);
    });
  });

  describe('M key', () => {
    it('should mute when pressing M', () => {
      const event = new KeyboardEvent('keydown', { key: 'm' });
      const handled = service.handleKeyboardEvent(event);

      expect(handled).toBe(true);
      expect(mockSetVolume).toHaveBeenCalledWith(0);
      expect(service.isMuted()).toBe(true);
      expect(mockSetMuted).toHaveBeenCalledWith(true);
    });

    it('should unmute when pressing M again', () => {
      // First press - mute
      service.handleKeyboardEvent(new KeyboardEvent('keydown', { key: 'm' }));
      expect(service.isMuted()).toBe(true);

      // Second press - unmute (should restore to 0.5 * 100 = 50)
      service.handleKeyboardEvent(new KeyboardEvent('keydown', { key: 'm' }));
      expect(service.isMuted()).toBe(false);
      expect(mockSetVolume).toHaveBeenLastCalledWith(50);
      expect(mockSetMuted).toHaveBeenCalledWith(false);
    });

    it('should restore to default volume (0.8) if no previous volume saved', () => {
      volumeSignal.set(0);
      service['_isMuted'].set(true);
      service['_previousVolume'].set(0); // No saved volume

      service.handleKeyboardEvent(new KeyboardEvent('keydown', { key: 'm' }));

      expect(mockSetVolume).toHaveBeenCalledWith(80); // Default 0.8 * 100
    });

    it('should handle uppercase M', () => {
      const event = new KeyboardEvent('keydown', { key: 'M' });
      const handled = service.handleKeyboardEvent(event);

      expect(handled).toBe(true);
      expect(mockSetVolume).toHaveBeenCalledWith(0);
    });

    it('should call preventDefault on M key', () => {
      const event = new KeyboardEvent('keydown', { key: 'm' });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

      service.handleKeyboardEvent(event);

      expect(preventDefaultSpy).toHaveBeenCalled();
    });

    it('should unmute when volume is 0 but not explicitly muted', () => {
      volumeSignal.set(0);
      service['_isMuted'].set(false);

      service.handleKeyboardEvent(new KeyboardEvent('keydown', { key: 'm' }));

      expect(service.isMuted()).toBe(false);
      expect(mockSetVolume).toHaveBeenCalled();
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

    it('should handle uppercase L', () => {
      const event = new KeyboardEvent('keydown', { key: 'L' });
      const handled = service.handleKeyboardEvent(event);

      expect(handled).toBe(true);
      expect(mockSubmitRating).toHaveBeenCalled();
    });

    it('should call preventDefault on L key', () => {
      const event = new KeyboardEvent('keydown', { key: 'l' });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

      service.handleKeyboardEvent(event);

      expect(preventDefaultSpy).toHaveBeenCalled();
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

    it('should not handle events when target is a textarea', () => {
      const textarea = document.createElement('textarea');
      const event = new KeyboardEvent('keydown', { key: ' ' });
      Object.defineProperty(event, 'target', { value: textarea });

      const handled = service.handleKeyboardEvent(event);

      expect(handled).toBe(false);
      expect(mockTogglePlayPause).not.toHaveBeenCalled();
    });

    it('should not handle events when target is a select', () => {
      const select = document.createElement('select');
      const event = new KeyboardEvent('keydown', { key: ' ' });
      Object.defineProperty(event, 'target', { value: select });

      const handled = service.handleKeyboardEvent(event);

      expect(handled).toBe(false);
      expect(mockTogglePlayPause).not.toHaveBeenCalled();
    });

    it('should not handle events when target is contentEditable', () => {
      const div = document.createElement('div');
      div.contentEditable = 'true';
      // Explicitly set isContentEditable for the test environment
      Object.defineProperty(div, 'isContentEditable', { value: true, configurable: true });
      const event = new KeyboardEvent('keydown', { key: ' ' });
      Object.defineProperty(event, 'target', { value: div });

      const handled = service.handleKeyboardEvent(event);

      expect(handled).toBe(false);
      expect(mockTogglePlayPause).not.toHaveBeenCalled();
    });

    it('should handle events when target is null', () => {
      const event = new KeyboardEvent('keydown', { key: ' ' });
      Object.defineProperty(event, 'target', { value: null });

      const handled = service.handleKeyboardEvent(event);

      expect(handled).toBe(true); // Should handle the event when no element is focused
      expect(mockTogglePlayPause).toHaveBeenCalled();
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

    it('should not call preventDefault for unhandled keys', () => {
      const event = new KeyboardEvent('keydown', { key: 'x' });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

      service.handleKeyboardEvent(event);

      expect(preventDefaultSpy).not.toHaveBeenCalled();
    });

    it('should handle multiple different unhandled keys', () => {
      ['a', 'b', 'c', '1', '2', 'Tab', 'Enter', 'Escape'].forEach((key) => {
        const event = new KeyboardEvent('keydown', { key });
        const handled = service.handleKeyboardEvent(event);
        expect(handled).toBe(false);
      });
    });
  });

  describe('isMuted signal', () => {
    it('should expose readonly isMuted signal', () => {
      expect(service.isMuted).toBeDefined();
      expect(typeof service.isMuted()).toBe('boolean');
    });

    it('should initialize with preferences isMuted value', () => {
      // Need to create a new service with isMuted=true in preferences
      const newMockPreferencesService = {
        volume: signal(0.8),
        isMuted: signal(true), // Set to true before service creation
        setMuted: mockSetMuted,
      };

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          KeyboardShortcutService,
          {
            provide: HlsPlayerService,
            useValue: {
              togglePlayPause: mockTogglePlayPause,
              setVolume: mockSetVolume,
              volume: volumeSignal,
              currentTrack: signal({ title: 'Test Song', artist: 'Test Artist' }),
            },
          },
          { provide: RatingService, useValue: { submitRating: mockSubmitRating, userRating: userRatingSignal } },
          { provide: PreferencesService, useValue: newMockPreferencesService },
        ],
      });
      const newService = TestBed.inject(KeyboardShortcutService);
      expect(newService.isMuted()).toBe(true);
    });
  });

  describe('Volume rounding', () => {
    it('should round volume to avoid floating-point precision issues', () => {
      volumeSignal.set(0.123456);
      const event = new KeyboardEvent('keydown', { key: 'ArrowUp' });

      service.handleKeyboardEvent(event);

      // 0.123456 + 0.05 = 0.173456, rounded * 100 = 17
      expect(mockSetVolume).toHaveBeenCalledWith(17);
    });
  });
});
