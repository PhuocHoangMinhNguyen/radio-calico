import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ShareService } from './share.service';
import { HlsPlayerService } from './hls-player.service';

describe('ShareService', () => {
  let service: ShareService;
  let mockHlsService: any;
  let mockNavigator: any;

  beforeEach(() => {
    // Mock HlsPlayerService
    mockHlsService = {
      currentTrack: signal(null as any),
    };

    // Mock navigator
    mockNavigator = {
      share: vi.fn().mockResolvedValue(undefined),
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    };

    // Replace navigator with mock
    Object.defineProperty(globalThis, 'navigator', {
      value: mockNavigator,
      writable: true,
      configurable: true,
    });

    // Mock window.open
    globalThis.window.open = vi.fn();

    TestBed.configureTestingModule({
      providers: [ShareService, { provide: HlsPlayerService, useValue: mockHlsService }],
    });

    service = TestBed.inject(ShareService);
  });

  it('should create', () => {
    expect(service).toBeTruthy();
  });

  describe('canUseNativeShare', () => {
    it('should return true when navigator.share exists', () => {
      expect(service.canUseNativeShare()).toBe(true);
    });

    it('should return false when navigator.share does not exist', () => {
      delete (globalThis.navigator as any).share;
      const newService = TestBed.inject(ShareService);
      expect(newService.canUseNativeShare()).toBe(false);
    });
  });

  describe('getShareData', () => {
    it('should return null when no track', () => {
      mockHlsService.currentTrack.set(null);

      const data = service.getShareData();

      expect(data).toBeNull();
    });

    it('should return share data when track exists', () => {
      const track = { title: 'Test Song', artist: 'Test Artist', duration: 180 };
      mockHlsService.currentTrack.set(track);

      const data = service.getShareData();

      expect(data).toEqual({
        title: 'Test Song',
        artist: 'Test Artist',
        url: 'https://radio-calico.app',
      });
    });
  });

  describe('shareNative', () => {
    it('should share using native API', async () => {
      const track = { title: 'Test Song', artist: 'Test Artist', duration: 180 };
      mockHlsService.currentTrack.set(track);

      const result = await service.shareNative();

      expect(mockNavigator.share).toHaveBeenCalledWith({
        title: 'Test Song - Test Artist',
        text: 'Listening to "Test Song" by Test Artist on Radio Calico',
        url: 'https://radio-calico.app',
      });
      expect(result).toBe(true);
    });

    it('should return false when no track', async () => {
      mockHlsService.currentTrack.set(null);

      const result = await service.shareNative();

      expect(mockNavigator.share).not.toHaveBeenCalled();
      expect(result).toBe(false);
    });

    it('should return false when native share not available', async () => {
      delete (globalThis.navigator as any).share;
      const track = { title: 'Test Song', artist: 'Test Artist', duration: 180 };
      mockHlsService.currentTrack.set(track);

      const result = await service.shareNative();

      expect(result).toBe(false);
    });

    it('should return false on AbortError (user cancelled)', async () => {
      const track = { title: 'Test Song', artist: 'Test Artist', duration: 180 };
      mockHlsService.currentTrack.set(track);
      const abortError = new Error('User cancelled');
      abortError.name = 'AbortError';
      mockNavigator.share.mockRejectedValue(abortError);

      const result = await service.shareNative();

      expect(result).toBe(false);
    });

    it('should handle other share errors', async () => {
      const track = { title: 'Test Song', artist: 'Test Artist', duration: 180 };
      mockHlsService.currentTrack.set(track);
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      mockNavigator.share.mockRejectedValue(new Error('Share failed'));

      const result = await service.shareNative();

      expect(result).toBe(false);
      expect(consoleWarnSpy).toHaveBeenCalled();
    });
  });

  describe('shareToTwitter', () => {
    it('should open Twitter share URL', () => {
      const track = { title: 'Test Song', artist: 'Test Artist', duration: 180 };
      mockHlsService.currentTrack.set(track);

      service.shareToTwitter();

      expect(window.open).toHaveBeenCalledWith(
        expect.stringContaining('https://twitter.com/intent/tweet'),
        '_blank',
        'width=550,height=420,noopener,noreferrer'
      );
      expect(window.open).toHaveBeenCalledWith(
        expect.stringContaining('Test%20Song'),
        expect.any(String),
        expect.any(String)
      );
    });

    it('should not open window when no track', () => {
      mockHlsService.currentTrack.set(null);

      service.shareToTwitter();

      expect(window.open).not.toHaveBeenCalled();
    });
  });

  describe('shareToFacebook', () => {
    it('should open Facebook share URL', () => {
      const track = { title: 'Test Song', artist: 'Test Artist', duration: 180 };
      mockHlsService.currentTrack.set(track);

      service.shareToFacebook();

      expect(window.open).toHaveBeenCalledWith(
        expect.stringContaining('https://www.facebook.com/sharer/sharer.php'),
        '_blank',
        'width=550,height=420,noopener,noreferrer'
      );
    });

    it('should not open window when no track', () => {
      mockHlsService.currentTrack.set(null);

      service.shareToFacebook();

      expect(window.open).not.toHaveBeenCalled();
    });
  });

  describe('copyToClipboard', () => {
    it('should copy share text to clipboard', async () => {
      const track = { title: 'Test Song', artist: 'Test Artist', duration: 180 };
      mockHlsService.currentTrack.set(track);

      const result = await service.copyToClipboard();

      expect(mockNavigator.clipboard.writeText).toHaveBeenCalledWith(
        'Listening to "Test Song" by Test Artist on Radio Calico\nhttps://radio-calico.app'
      );
      expect(result).toBe(true);
    });

    it('should return false when no track', async () => {
      mockHlsService.currentTrack.set(null);

      const result = await service.copyToClipboard();

      expect(mockNavigator.clipboard.writeText).not.toHaveBeenCalled();
      expect(result).toBe(false);
    });

    it('should handle clipboard write failures', async () => {
      const track = { title: 'Test Song', artist: 'Test Artist', duration: 180 };
      mockHlsService.currentTrack.set(track);
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      mockNavigator.clipboard.writeText.mockRejectedValue(new Error('Clipboard failed'));

      const result = await service.copyToClipboard();

      expect(result).toBe(false);
      expect(consoleWarnSpy).toHaveBeenCalled();
    });
  });
});
