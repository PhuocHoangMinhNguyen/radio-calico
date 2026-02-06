import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ShareButton } from './share-button';
import { ShareService } from '../../services/share.service';
import { HlsPlayerService } from '../../services/hls-player.service';

describe('ShareButton', () => {
  let component: ShareButton;
  let mockShareService: any;
  let mockHlsService: any;

  beforeEach(() => {
    // Mock ShareService
    mockShareService = {
      canUseNativeShare: signal(false),
      shareNative: vi.fn().mockResolvedValue(undefined),
      shareToTwitter: vi.fn(),
      shareToFacebook: vi.fn(),
      copyToClipboard: vi.fn().mockResolvedValue(true),
    };

    // Mock HlsPlayerService
    mockHlsService = {
      hasTrackInfo: signal(false),
    };

    TestBed.configureTestingModule({
      providers: [
        ShareButton,
        { provide: ShareService, useValue: mockShareService },
        { provide: HlsPlayerService, useValue: mockHlsService },
      ],
    });

    component = TestBed.inject(ShareButton);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize with menu closed', () => {
    expect(component.isMenuOpen()).toBe(false);
  });

  it('should initialize with copySuccess false', () => {
    expect(component.copySuccess()).toBe(false);
  });

  it('should expose HlsPlayerService hasTrackInfo signal', () => {
    expect(component.hasTrackInfo).toBe(mockHlsService.hasTrackInfo);
  });

  it('should expose ShareService canUseNativeShare signal', () => {
    expect(component.canUseNativeShare).toBe(mockShareService.canUseNativeShare);
  });

  describe('toggleMenu', () => {
    it('should open menu when closed', () => {
      component.isMenuOpen.set(false);

      component.toggleMenu();

      expect(component.isMenuOpen()).toBe(true);
    });

    it('should close menu when open', () => {
      component.isMenuOpen.set(true);

      component.toggleMenu();

      expect(component.isMenuOpen()).toBe(false);
    });
  });

  describe('closeMenu', () => {
    it('should close menu', () => {
      component.isMenuOpen.set(true);

      component.closeMenu();

      expect(component.isMenuOpen()).toBe(false);
    });
  });

  describe('onShare', () => {
    it('should use native share on mobile', async () => {
      mockShareService.canUseNativeShare.set(true);

      await component.onShare();

      expect(mockShareService.shareNative).toHaveBeenCalled();
    });

    it('should toggle menu on desktop', async () => {
      mockShareService.canUseNativeShare.set(false);
      component.isMenuOpen.set(false);

      await component.onShare();

      expect(component.isMenuOpen()).toBe(true);
      expect(mockShareService.shareNative).not.toHaveBeenCalled();
    });
  });

  describe('onShareTwitter', () => {
    it('should share to Twitter and close menu', () => {
      component.isMenuOpen.set(true);

      component.onShareTwitter();

      expect(mockShareService.shareToTwitter).toHaveBeenCalled();
      expect(component.isMenuOpen()).toBe(false);
    });
  });

  describe('onShareFacebook', () => {
    it('should share to Facebook and close menu', () => {
      component.isMenuOpen.set(true);

      component.onShareFacebook();

      expect(mockShareService.shareToFacebook).toHaveBeenCalled();
      expect(component.isMenuOpen()).toBe(false);
    });
  });

  describe('onCopyLink', () => {
    it('should copy link to clipboard successfully', async () => {
      component.isMenuOpen.set(true);
      mockShareService.copyToClipboard.mockResolvedValue(true);

      await component.onCopyLink();

      expect(mockShareService.copyToClipboard).toHaveBeenCalled();
      expect(component.copySuccess()).toBe(true);
      expect(component.isMenuOpen()).toBe(false);
    });

    it('should reset copySuccess after 2 seconds', async () => {
      vi.useFakeTimers();
      mockShareService.copyToClipboard.mockResolvedValue(true);

      await component.onCopyLink();

      expect(component.copySuccess()).toBe(true);

      vi.advanceTimersByTime(2000);

      expect(component.copySuccess()).toBe(false);

      vi.useRealTimers();
    });

    it('should not set copySuccess when copy fails', async () => {
      mockShareService.copyToClipboard.mockResolvedValue(false);

      await component.onCopyLink();

      expect(component.copySuccess()).toBe(false);
      expect(component.isMenuOpen()).toBe(false);
    });

    it('should close menu after copy attempt', async () => {
      component.isMenuOpen.set(true);
      mockShareService.copyToClipboard.mockResolvedValue(true);

      await component.onCopyLink();

      expect(component.isMenuOpen()).toBe(false);
    });
  });
});
