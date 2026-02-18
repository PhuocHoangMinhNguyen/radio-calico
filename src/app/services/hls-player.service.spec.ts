import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { HlsPlayerService } from './hls-player.service';
import { AnnouncerService } from './announcer.service';
import { PreferencesService } from './preferences.service';
import { NotificationService } from './notification.service';
import { ErrorMonitoringService } from './error-monitoring.service';
import { MetaService } from './meta.service';
import { StreamMetadata } from '../models/track-info';

// Mock all the service dependencies
const mockAnnouncer = {
  announceTrackChange: vi.fn(),
  announcement: vi.fn(() => ''),
};

const mockPreferences = {
  volume: vi.fn(() => 0.8),
  setVolume: vi.fn(),
  isMuted: vi.fn(() => false),
};

const mockNotification = {
  notifyTrackChange: vi.fn(),
};

const mockErrorMonitoring = {
  trackHlsError: vi.fn(() => 'error-id-123'),
  recordRecoveryAttempt: vi.fn(),
  recordSuccessfulRecovery: vi.fn(),
  trackMediaError: vi.fn(),
  trackNetworkError: vi.fn(),
  trackError: vi.fn(),
};

const mockMeta = {
  updateForTrack: vi.fn(),
};

describe('HlsPlayerService', () => {
  let service: HlsPlayerService;
  let fetchSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    fetchSpy = vi.spyOn(globalThis, 'fetch');

    TestBed.configureTestingModule({
      providers: [
        HlsPlayerService,
        { provide: AnnouncerService, useValue: mockAnnouncer },
        { provide: PreferencesService, useValue: mockPreferences },
        { provide: NotificationService, useValue: mockNotification },
        { provide: ErrorMonitoringService, useValue: mockErrorMonitoring },
        { provide: MetaService, useValue: mockMeta },
      ],
    });
    service = TestBed.inject(HlsPlayerService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should have initial state', () => {
    expect(service.isPlaying()).toBe(false);
    expect(service.volume()).toBe(0.8);
    expect(service.status()).toBe('initializing');
  });

  it('should set volume correctly', () => {
    service.setVolume(50);
    expect(service.volume()).toBe(0.5);
  });

  it('should clamp volume between 0 and 1', () => {
    service.setVolume(150);
    expect(service.volume()).toBe(1);

    service.setVolume(-10);
    expect(service.volume()).toBe(0);
  });

  it('should compute status class correctly', () => {
    expect(service.statusClass()).toBe('');
  });

  // -------------------------------------------------------------------------
  // Metadata polling tests
  // -------------------------------------------------------------------------
  describe('metadata polling', () => {
    it('fetches metadata immediately on initializePlayer', async () => {
      const mockMetadata: StreamMetadata = {
        title: 'Test Song',
        artist: 'Test Artist',
        album: 'Test Album',
        date: '2026-02-06',
        bit_depth: 24,
        sample_rate: 48000,
        prev_title_1: '',
        prev_artist_1: '',
        prev_title_2: '',
        prev_artist_2: '',
        prev_title_3: '',
        prev_artist_3: '',
        prev_title_4: '',
        prev_artist_4: '',
        prev_title_5: '',
        prev_artist_5: '',
        is_new: false,
        is_summer: false,
        is_vidgames: false,
      };
      fetchSpy.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockMetadata),
      } as Response);

      const audioElement = document.createElement('audio');
      const mockHlsIsSupported = vi.fn(() => false);
      vi.stubGlobal('Hls', { isSupported: mockHlsIsSupported });

      service.initializePlayer(audioElement, 'test-stream.m3u8');

      // Wait for async fetch to complete and track to be set
      await vi.waitFor(() => {
        expect(fetchSpy).toHaveBeenCalledWith(
          'https://d3d4yli4hf5bmh.cloudfront.net/metadatav2.json',
          expect.objectContaining({
            cache: 'default',
            signal: expect.any(AbortSignal)
          })
        );
        expect(service.currentTrack()?.title).toBe('Test Song');
      });

      expect(service.currentTrack()?.artist).toBe('Test Artist');

      service.destroy();
    });

    it('logs error and continues when metadata fetch fails', async () => {
      fetchSpy.mockRejectedValue(new Error('Network failure'));

      const audioElement = document.createElement('audio');
      const mockHlsIsSupported = vi.fn(() => false);
      vi.stubGlobal('Hls', { isSupported: mockHlsIsSupported });

      service.initializePlayer(audioElement, 'test-stream.m3u8');

      await vi.waitFor(() => {
        expect(mockErrorMonitoring.trackNetworkError).toHaveBeenCalledWith(
          'Failed to fetch track metadata',
          'https://d3d4yli4hf5bmh.cloudfront.net/metadatav2.json'
        );
      });

      service.destroy();
    });
  });

  // -------------------------------------------------------------------------
  // Track-change detection tests
  // -------------------------------------------------------------------------
  describe('track-change detection', () => {
    it('detects track change when title differs', async () => {
      const firstTrack: StreamMetadata = {
        title: 'First Song',
        artist: 'Artist',
        album: '',
        date: '2026-02-06',
        bit_depth: 24,
        sample_rate: 48000,
        prev_title_1: '',
        prev_artist_1: '',
        prev_title_2: '',
        prev_artist_2: '',
        prev_title_3: '',
        prev_artist_3: '',
        prev_title_4: '',
        prev_artist_4: '',
        prev_title_5: '',
        prev_artist_5: '',
        is_new: false,
        is_summer: false,
        is_vidgames: false,
      };
      const secondTrack: StreamMetadata = {
        ...firstTrack,
        title: 'Second Song',
      };

      fetchSpy
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(firstTrack),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(secondTrack),
        });

      const audioElement = document.createElement('audio');
      const mockHlsIsSupported = vi.fn(() => false);
      vi.stubGlobal('Hls', { isSupported: mockHlsIsSupported });

      service.initializePlayer(audioElement, 'test-stream.m3u8');

      // Wait for first fetch
      await vi.waitFor(() => {
        expect(service.currentTrack()?.title).toBe('First Song');
      });

      // No announcement on first track
      expect(mockAnnouncer.announceTrackChange).not.toHaveBeenCalled();

      // Manually trigger second metadata fetch
      fetchSpy.mockClear();
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(secondTrack),
      });

      // Call fetchMetadata again (simulating poll)
      await (service as any).fetchMetadata();

      // Should announce track change on second track
      expect(mockAnnouncer.announceTrackChange).toHaveBeenCalledWith('Second Song', 'Artist');

      service.destroy();
    });

    it('detects track change when artist differs', async () => {
      const firstTrack: StreamMetadata = {
        title: 'Song',
        artist: 'First Artist',
        album: '',
        date: '2026-02-06',
        bit_depth: 24,
        sample_rate: 48000,
        prev_title_1: '',
        prev_artist_1: '',
        prev_title_2: '',
        prev_artist_2: '',
        prev_title_3: '',
        prev_artist_3: '',
        prev_title_4: '',
        prev_artist_4: '',
        prev_title_5: '',
        prev_artist_5: '',
        is_new: false,
        is_summer: false,
        is_vidgames: false,
      };
      const secondTrack: StreamMetadata = {
        ...firstTrack,
        artist: 'Second Artist',
      };

      fetchSpy
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(firstTrack),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(secondTrack),
        });

      const audioElement = document.createElement('audio');
      const mockHlsIsSupported = vi.fn(() => false);
      vi.stubGlobal('Hls', { isSupported: mockHlsIsSupported });

      service.initializePlayer(audioElement, 'test-stream.m3u8');

      await vi.waitFor(() => {
        expect(service.currentTrack()?.artist).toBe('First Artist');
      });

      fetchSpy.mockClear();
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(secondTrack),
      });

      await (service as any).fetchMetadata();

      expect(mockAnnouncer.announceTrackChange).toHaveBeenCalledWith('Song', 'Second Artist');

      service.destroy();
    });
  });

  // -------------------------------------------------------------------------
  // Cover caching test
  // -------------------------------------------------------------------------
  describe('cover caching', () => {
    it('uses cover URL without cache-busting for service worker caching', async () => {
      const track: StreamMetadata = {
        title: 'Song',
        artist: 'Artist',
        album: '',
        date: '2026-02-06',
        bit_depth: 24,
        sample_rate: 48000,
        prev_title_1: '',
        prev_artist_1: '',
        prev_title_2: '',
        prev_artist_2: '',
        prev_title_3: '',
        prev_artist_3: '',
        prev_title_4: '',
        prev_artist_4: '',
        prev_title_5: '',
        prev_artist_5: '',
        is_new: false,
        is_summer: false,
        is_vidgames: false,
      };

      fetchSpy.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(track),
      });

      const audioElement = document.createElement('audio');
      const mockHlsIsSupported = vi.fn(() => false);
      vi.stubGlobal('Hls', { isSupported: mockHlsIsSupported });

      service.initializePlayer(audioElement, 'test-stream.m3u8');

      await vi.waitFor(() => {
        const coverUrl = service.coverUrl();
        expect(coverUrl).toBeTruthy();
        // Should be plain URL without query params to allow caching
        expect(coverUrl).toBe('https://d3d4yli4hf5bmh.cloudfront.net/cover.jpg');
      });

      service.destroy();
    });
  });

  // -------------------------------------------------------------------------
  // First-load guard test (no announcement on initial track)
  // -------------------------------------------------------------------------
  describe('first-load guard', () => {
    it('does not announce track change or send notification on first track', async () => {
      const track: StreamMetadata = {
        title: 'First Song',
        artist: 'First Artist',
        album: '',
        date: '2026-02-06',
        bit_depth: 24,
        sample_rate: 48000,
        prev_title_1: '',
        prev_artist_1: '',
        prev_title_2: '',
        prev_artist_2: '',
        prev_title_3: '',
        prev_artist_3: '',
        prev_title_4: '',
        prev_artist_4: '',
        prev_title_5: '',
        prev_artist_5: '',
        is_new: false,
        is_summer: false,
        is_vidgames: false,
      };

      fetchSpy.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(track),
      });

      const audioElement = document.createElement('audio');
      const mockHlsIsSupported = vi.fn(() => false);
      vi.stubGlobal('Hls', { isSupported: mockHlsIsSupported });

      service.initializePlayer(audioElement, 'test-stream.m3u8');

      await vi.waitFor(() => {
        expect(service.currentTrack()?.title).toBe('First Song');
      });

      // Should NOT announce or notify on first track
      expect(mockAnnouncer.announceTrackChange).not.toHaveBeenCalled();
      expect(mockNotification.notifyTrackChange).not.toHaveBeenCalled();

      service.destroy();
    });

    it('announces and notifies on second track', async () => {
      const firstTrack: StreamMetadata = {
        title: 'First Song',
        artist: 'Artist',
        album: '',
        date: '2026-02-06',
        bit_depth: 24,
        sample_rate: 48000,
        prev_title_1: '',
        prev_artist_1: '',
        prev_title_2: '',
        prev_artist_2: '',
        prev_title_3: '',
        prev_artist_3: '',
        prev_title_4: '',
        prev_artist_4: '',
        prev_title_5: '',
        prev_artist_5: '',
        is_new: false,
        is_summer: false,
        is_vidgames: false,
      };
      const secondTrack: StreamMetadata = {
        ...firstTrack,
        title: 'Second Song',
      };

      fetchSpy
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(firstTrack),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(secondTrack),
        });

      const audioElement = document.createElement('audio');
      const mockHlsIsSupported = vi.fn(() => false);
      vi.stubGlobal('Hls', { isSupported: mockHlsIsSupported });

      service.initializePlayer(audioElement, 'test-stream.m3u8');

      await vi.waitFor(() => {
        expect(service.currentTrack()?.title).toBe('First Song');
      });

      fetchSpy.mockClear();
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(secondTrack),
      });

      await (service as any).fetchMetadata();

      // Should announce and notify on second track
      expect(mockAnnouncer.announceTrackChange).toHaveBeenCalledWith('Second Song', 'Artist');
      expect(mockNotification.notifyTrackChange).toHaveBeenCalled();

      service.destroy();
    });
  });

  // -------------------------------------------------------------------------
  // Connection quality tests
  // -------------------------------------------------------------------------
  describe('connection quality', () => {
    it('computes good quality when buffer > 10s and latency < 500ms', () => {
      (service as any)._bufferHealth.set(12);
      (service as any)._fragmentLatency.set(300);

      expect(service.connectionQuality()).toBe('good');
    });

    it('computes fair quality when buffer > 5s and latency < 1000ms', () => {
      (service as any)._bufferHealth.set(7);
      (service as any)._fragmentLatency.set(800);

      expect(service.connectionQuality()).toBe('fair');
    });

    it('computes poor quality when buffer < 5s', () => {
      (service as any)._bufferHealth.set(3);
      (service as any)._fragmentLatency.set(200);

      expect(service.connectionQuality()).toBe('poor');
    });

    it('computes poor quality when latency > 1000ms', () => {
      (service as any)._bufferHealth.set(12);
      (service as any)._fragmentLatency.set(1500);

      expect(service.connectionQuality()).toBe('poor');
    });
  });

  // -------------------------------------------------------------------------
  // Lifecycle and cleanup tests
  // -------------------------------------------------------------------------
  describe('lifecycle and cleanup', () => {
    it('destroy can be called before initialization', () => {
      expect(() => service.destroy()).not.toThrow();
    });

    it('destroy can be called multiple times safely', () => {
      const audioElement = document.createElement('audio');
      const mockHlsIsSupported = vi.fn(() => false);
      vi.stubGlobal('Hls', { isSupported: mockHlsIsSupported });

      service.initializePlayer(audioElement, 'test-stream.m3u8');

      expect(() => {
        service.destroy();
        service.destroy();
        service.destroy();
      }).not.toThrow();
    });

    it('signals remain in safe state after destroy', () => {
      service.destroy();

      // Core signals should be in safe state
      expect(service.isPlaying()).toBe(false);
      expect(service.status()).toBe('initializing');
    });

    it('handles empty stream URL gracefully', () => {
      const mockHlsIsSupported = vi.fn(() => false);
      vi.stubGlobal('Hls', { isSupported: mockHlsIsSupported });

      const audioElement = document.createElement('audio');

      expect(() => {
        service.initializePlayer(audioElement, '');
      }).not.toThrow();

      service.destroy();
    });
  });
});
