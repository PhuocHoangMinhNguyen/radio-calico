import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { NowPlayingHero } from './now-playing-hero';
import { HlsPlayerService } from '../../services/hls-player.service';
import { ThemeService } from '../../services/theme.service';

describe('NowPlayingHero', () => {
  let component: NowPlayingHero;
  let mockHlsService: any;
  let mockThemeService: any;

  beforeEach(() => {
    // Mock HlsPlayerService
    mockHlsService = {
      currentTrack: signal({ title: 'Test Song', artist: 'Test Artist', duration: 180 }),
      hasTrackInfo: signal(true),
      coverUrl: signal('https://example.com/cover.jpg'),
    };

    // Mock ThemeService
    mockThemeService = {
      theme: signal('light' as 'light' | 'dark'),
      toggle: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        NowPlayingHero,
        { provide: HlsPlayerService, useValue: mockHlsService },
        { provide: ThemeService, useValue: mockThemeService },
      ],
    });

    component = TestBed.inject(NowPlayingHero);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should expose currentTrack signal from HlsPlayerService', () => {
    expect(component.currentTrack).toBe(mockHlsService.currentTrack);
  });

  it('should expose hasTrackInfo signal from HlsPlayerService', () => {
    expect(component.hasTrackInfo).toBe(mockHlsService.hasTrackInfo);
  });

  it('should expose coverUrl signal from HlsPlayerService', () => {
    expect(component.coverUrl).toBe(mockHlsService.coverUrl);
  });

  it('should expose theme signal from ThemeService', () => {
    expect(component.theme).toBe(mockThemeService.theme);
  });

  it('should call ThemeService.toggle when toggleTheme is called', () => {
    component.toggleTheme();

    expect(mockThemeService.toggle).toHaveBeenCalled();
  });

  it('should reflect changes in currentTrack', () => {
    const newTrack = { title: 'New Song', artist: 'New Artist', duration: 200 };
    mockHlsService.currentTrack.set(newTrack);

    expect(component.currentTrack()).toEqual(newTrack);
  });

  it('should reflect changes in hasTrackInfo', () => {
    mockHlsService.hasTrackInfo.set(false);
    expect(component.hasTrackInfo()).toBe(false);

    mockHlsService.hasTrackInfo.set(true);
    expect(component.hasTrackInfo()).toBe(true);
  });

  it('should reflect changes in coverUrl', () => {
    const newUrl = 'https://example.com/new-cover.jpg';
    mockHlsService.coverUrl.set(newUrl);

    expect(component.coverUrl()).toBe(newUrl);
  });

  it('should reflect changes in theme', () => {
    mockThemeService.theme.set('dark');
    expect(component.theme()).toBe('dark');

    mockThemeService.theme.set('light');
    expect(component.theme()).toBe('light');
  });
});
