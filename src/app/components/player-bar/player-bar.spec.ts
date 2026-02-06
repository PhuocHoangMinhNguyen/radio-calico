import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { PlayerBar } from './player-bar';
import { HlsPlayerService } from '../../services/hls-player.service';
import { KeyboardShortcutService } from '../../services/keyboard-shortcut.service';
import { NotificationService } from '../../services/notification.service';

describe('PlayerBar', () => {
  let component: PlayerBar;
  let mockHlsService: any;
  let mockKeyboardService: any;
  let mockNotificationService: any;

  beforeEach(() => {
    // Mock HlsPlayerService
    mockHlsService = {
      isPlaying: signal(false),
      volume: signal(0.8),
      currentTrack: signal(null as any),
      hasTrackInfo: signal(false),
      coverUrl: signal(''),
      statusMessage: signal(''),
      initializePlayer: vi.fn(),
      destroy: vi.fn(),
      togglePlayPause: vi.fn(),
      setVolume: vi.fn(),
    };

    // Mock KeyboardShortcutService
    mockKeyboardService = {
      isMuted: signal(false),
      handleKeyboardEvent: vi.fn(),
    };

    // Mock NotificationService
    mockNotificationService = {
      permission: signal('default' as NotificationPermission),
      isEnabled: signal(false),
      isSupported: signal(true),
      requestPermission: vi.fn(),
      toggleEnabled: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        PlayerBar,
        { provide: HlsPlayerService, useValue: mockHlsService },
        { provide: KeyboardShortcutService, useValue: mockKeyboardService },
        { provide: NotificationService, useValue: mockNotificationService },
      ],
    });

    component = TestBed.inject(PlayerBar);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should expose HlsPlayerService signals', () => {
    expect(component.isPlaying).toBe(mockHlsService.isPlaying);
    expect(component.volume).toBe(mockHlsService.volume);
    expect(component.currentTrack).toBe(mockHlsService.currentTrack);
    expect(component.hasTrackInfo).toBe(mockHlsService.hasTrackInfo);
    expect(component.coverUrl).toBe(mockHlsService.coverUrl);
    expect(component.statusMessage).toBe(mockHlsService.statusMessage);
  });

  it('should expose KeyboardShortcutService isMuted signal', () => {
    expect(component.isMuted).toBe(mockKeyboardService.isMuted);
  });

  it('should expose NotificationService signals', () => {
    expect(component.notificationPermission).toBe(mockNotificationService.permission);
    expect(component.notificationsEnabled).toBe(mockNotificationService.isEnabled);
    expect(component.notificationsSupported).toBe(mockNotificationService.isSupported);
  });

  describe('volumeIcon computed', () => {
    it('should return volume_off when muted', () => {
      mockKeyboardService.isMuted.set(true);
      expect(component.volumeIcon()).toBe('volume_off');
    });

    it('should return volume_off when volume is 0', () => {
      mockHlsService.volume.set(0);
      mockKeyboardService.isMuted.set(false);
      expect(component.volumeIcon()).toBe('volume_off');
    });

    it('should return volume_down for low volume', () => {
      mockHlsService.volume.set(0.3);
      mockKeyboardService.isMuted.set(false);
      expect(component.volumeIcon()).toBe('volume_down');
    });

    it('should return volume_down for medium volume', () => {
      mockHlsService.volume.set(0.6);
      mockKeyboardService.isMuted.set(false);
      expect(component.volumeIcon()).toBe('volume_down');
    });

    it('should return volume_up for high volume', () => {
      mockHlsService.volume.set(0.8);
      mockKeyboardService.isMuted.set(false);
      expect(component.volumeIcon()).toBe('volume_up');
    });

    it('should return volume_up for max volume', () => {
      mockHlsService.volume.set(1.0);
      mockKeyboardService.isMuted.set(false);
      expect(component.volumeIcon()).toBe('volume_up');
    });
  });

  describe('ngAfterViewInit', () => {
    it('should initialize HLS player with audio element', () => {
      const mockAudioElement = document.createElement('audio');
      component.audioPlayerRef = { nativeElement: mockAudioElement } as any;

      component.ngAfterViewInit();

      expect(mockHlsService.initializePlayer).toHaveBeenCalledWith(
        mockAudioElement,
        'https://d3d4yli4hf5bmh.cloudfront.net/hls/live.m3u8'
      );
    });

    it('should not initialize if audioPlayerRef is undefined', () => {
      component.audioPlayerRef = undefined as any;

      component.ngAfterViewInit();

      expect(mockHlsService.initializePlayer).not.toHaveBeenCalled();
    });
  });

  describe('ngOnDestroy', () => {
    it('should destroy HLS player', () => {
      component.ngOnDestroy();

      expect(mockHlsService.destroy).toHaveBeenCalled();
    });
  });

  describe('onTogglePlayPause', () => {
    it('should toggle play/pause', () => {
      component.onTogglePlayPause();

      expect(mockHlsService.togglePlayPause).toHaveBeenCalled();
    });
  });

  describe('onVolumeChange', () => {
    it('should set volume from input event', () => {
      const mockInput = document.createElement('input');
      mockInput.value = '75';
      const event = { target: mockInput } as any;

      component.onVolumeChange(event);

      expect(mockHlsService.setVolume).toHaveBeenCalledWith(75);
    });
  });

  describe('onToggleMute', () => {
    it('should simulate M key press to toggle mute', () => {
      component.onToggleMute();

      expect(mockKeyboardService.handleKeyboardEvent).toHaveBeenCalledWith(
        expect.objectContaining({ key: 'm' })
      );
    });
  });

  describe('onNotificationToggle', () => {
    it('should request permission when permission is default', () => {
      mockNotificationService.permission.set('default');

      component.onNotificationToggle();

      expect(mockNotificationService.requestPermission).toHaveBeenCalled();
      expect(mockNotificationService.toggleEnabled).not.toHaveBeenCalled();
    });

    it('should toggle enabled when permission is granted', () => {
      mockNotificationService.permission.set('granted');

      component.onNotificationToggle();

      expect(mockNotificationService.toggleEnabled).toHaveBeenCalled();
      expect(mockNotificationService.requestPermission).not.toHaveBeenCalled();
    });

    it('should not call any method when permission is denied', () => {
      mockNotificationService.permission.set('denied');

      component.onNotificationToggle();

      expect(mockNotificationService.requestPermission).not.toHaveBeenCalled();
      expect(mockNotificationService.toggleEnabled).not.toHaveBeenCalled();
    });
  });
});
