import { Injectable, signal, computed, inject } from '@angular/core';
import Hls from 'hls.js';
import { TrackInfo, StreamMetadata } from '../models/track-info';
import { AnnouncerService } from './announcer.service';
import { PreferencesService } from './preferences.service';
import { NotificationService } from './notification.service';
import { ErrorMonitoringService } from './error-monitoring.service';

export type PlayerStatus = 'initializing' | 'ready' | 'playing' | 'paused' | 'buffering' | 'error';
export type ConnectionQuality = 'good' | 'fair' | 'poor';

const METADATA_URL = 'https://d3d4yli4hf5bmh.cloudfront.net/metadatav2.json';
const COVER_URL = 'https://d3d4yli4hf5bmh.cloudfront.net/cover.jpg';
const METADATA_POLL_INTERVAL = 10_000;

@Injectable({
  providedIn: 'root'
})
export class HlsPlayerService {
  private readonly announcerService = inject(AnnouncerService);
  private readonly preferencesService = inject(PreferencesService);
  private readonly notificationService = inject(NotificationService);
  private readonly errorMonitoring = inject(ErrorMonitoringService);

  private hls: Hls | null = null;
  private audioElement: HTMLAudioElement | null = null;
  private metadataIntervalId: ReturnType<typeof setInterval> | null = null;

  // Writable signals for internal state management
  private _isPlaying = signal<boolean>(false);
  private _volume = signal<number>(this.preferencesService.volume());
  private _status = signal<PlayerStatus>('initializing');
  private _statusMessage = signal<string>('Initializing...');
  private _errorMessage = signal<string>('');
  private _currentTrack = signal<TrackInfo | null>(null);
  private _recentlyPlayed = signal<TrackInfo[]>([]);
  private _coverUrl = signal<string | null>(null);

  // Stream quality signals
  private _bufferHealth = signal<number>(0); // Seconds of buffered content
  private _bitrate = signal<number>(0); // Current bitrate in kbps
  private _fragmentLatency = signal<number>(0); // Last fragment load time in ms
  private bufferCheckIntervalId: ReturnType<typeof setInterval> | null = null;

  // Public readonly signals
  readonly isPlaying = this._isPlaying.asReadonly();
  readonly volume = this._volume.asReadonly();
  readonly status = this._status.asReadonly();
  readonly statusMessage = this._statusMessage.asReadonly();
  readonly errorMessage = this._errorMessage.asReadonly();
  readonly currentTrack = this._currentTrack.asReadonly();
  readonly recentlyPlayed = this._recentlyPlayed.asReadonly();
  readonly coverUrl = this._coverUrl.asReadonly();

  // Stream quality readonly signals
  readonly bufferHealth = this._bufferHealth.asReadonly();
  readonly bitrate = this._bitrate.asReadonly();
  readonly fragmentLatency = this._fragmentLatency.asReadonly();

  // Computed signals
  readonly statusClass = computed(() => {
    const status = this._status();
    return status === 'playing' ? 'playing' : status === 'error' ? 'error' : '';
  });
  readonly hasTrackInfo = computed(() => this._currentTrack() !== null);

  // Computed connection quality based on buffer health and latency
  readonly connectionQuality = computed<ConnectionQuality>(() => {
    const buffer = this._bufferHealth();
    const latency = this._fragmentLatency();

    // Good: buffer > 10s and latency < 500ms
    // Fair: buffer > 5s and latency < 1000ms
    // Poor: anything else
    if (buffer >= 10 && latency < 500) return 'good';
    if (buffer >= 5 && latency < 1000) return 'fair';
    return 'poor';
  });

  /**
   * Initialize the HLS player with an audio element and stream URL
   */
  initializePlayer(audioElement: HTMLAudioElement, streamUrl: string): void {
    this.audioElement = audioElement;
    this.audioElement.volume = this._volume();

    // Setup audio element event listeners
    this.setupAudioListeners();

    // Setup Media Session API for lock screen/notification controls
    this.setupMediaSession();

    // Check if HLS is supported
    if (Hls.isSupported()) {
      this.initializeHls(streamUrl);
    } else if (audioElement.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS support (Safari)
      this.initializeNativeHls(streamUrl);
    } else {
      this.handleError('HLS not supported in this browser');
    }

    // Start polling for track metadata
    this.startMetadataPolling();

    // Start monitoring buffer health
    this.startBufferMonitoring();
  }

  /**
   * Initialize HLS.js
   */
  private initializeHls(streamUrl: string): void {
    this.hls = new Hls({
      enableWorker: true,
      lowLatencyMode: true,
      backBufferLength: 90
    });

    this.hls.loadSource(streamUrl);
    this.hls.attachMedia(this.audioElement!);

    // HLS event listeners
    this.hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
      this._status.set('ready');
      this._statusMessage.set('Ready to play');
      // Set initial bitrate from first level
      if (data.levels && data.levels.length > 0) {
        this._bitrate.set(Math.round(data.levels[0].bitrate / 1000));
      }
      console.log('HLS manifest loaded successfully');
    });

    // Track fragment load times for latency measurement
    this.hls.on(Hls.Events.FRAG_LOADED, (_event, data) => {
      if (data.frag.stats) {
        const loadTime = data.frag.stats.loading.end - data.frag.stats.loading.start;
        this._fragmentLatency.set(Math.round(loadTime));
      }
    });

    // Update bitrate when level changes
    this.hls.on(Hls.Events.LEVEL_SWITCHED, (_event, data) => {
      const level = this.hls?.levels[data.level];
      if (level) {
        this._bitrate.set(Math.round(level.bitrate / 1000));
      }
    });

    this.hls.on(Hls.Events.ERROR, (_event, data) => {
      const errorId = this.errorMonitoring.trackHlsError(
        data.type,
        data.fatal,
        data.details || 'Unknown HLS error',
        { url: data.url, response: data.response }
      );

      if (data.fatal) {
        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            this._status.set('error');
            this._statusMessage.set('Network error - Retrying...');
            this.errorMonitoring.recordRecoveryAttempt(errorId);
            this.hls!.startLoad();
            // Track successful recovery after a short delay
            setTimeout(() => {
              if (this._status() !== 'error') {
                this.errorMonitoring.recordSuccessfulRecovery(errorId);
              }
            }, 5000);
            break;
          case Hls.ErrorTypes.MEDIA_ERROR:
            this._status.set('error');
            this._statusMessage.set('Media error - Recovering...');
            this.errorMonitoring.recordRecoveryAttempt(errorId);
            this.hls!.recoverMediaError();
            // Track successful recovery after a short delay
            setTimeout(() => {
              if (this._status() !== 'error') {
                this.errorMonitoring.recordSuccessfulRecovery(errorId);
              }
            }, 5000);
            break;
          default:
            this._status.set('error');
            this._statusMessage.set('Fatal error - Cannot play stream');
            this._errorMessage.set(data.details || 'Unknown error');
            this.hls!.destroy();
            break;
        }
      }
    });
  }

  /**
   * Initialize native HLS support (Safari)
   */
  private initializeNativeHls(streamUrl: string): void {
    this.audioElement!.src = streamUrl;
    this._status.set('ready');
    this._statusMessage.set('Ready to play');
  }

  /**
   * Setup Media Session API for lock screen and notification controls
   */
  private setupMediaSession(): void {
    if (!('mediaSession' in navigator)) {
      console.log('Media Session API not supported');
      return;
    }

    // Set initial metadata
    navigator.mediaSession.metadata = new MediaMetadata({
      title: 'Radio Calico',
      artist: 'Lossless Internet Radio',
      album: '48kHz / 24-bit FLAC',
      artwork: [
        { src: '/icons/icon-192.svg', sizes: '192x192', type: 'image/svg+xml' },
        { src: '/icons/icon-512.svg', sizes: '512x512', type: 'image/svg+xml' },
      ],
    });

    // Set up action handlers
    navigator.mediaSession.setActionHandler('play', () => {
      this.play();
    });

    navigator.mediaSession.setActionHandler('pause', () => {
      this.pause();
    });

    navigator.mediaSession.setActionHandler('stop', () => {
      this.pause();
    });

    console.log('Media Session API initialized');
  }

  /**
   * Update Media Session metadata with current track info
   */
  private updateMediaSessionMetadata(track: TrackInfo, coverUrl: string | null): void {
    if (!('mediaSession' in navigator)) return;

    const artwork: MediaImage[] = coverUrl
      ? [
          { src: coverUrl, sizes: '300x300', type: 'image/jpeg' },
          { src: '/icons/icon-192.svg', sizes: '192x192', type: 'image/svg+xml' },
          { src: '/icons/icon-512.svg', sizes: '512x512', type: 'image/svg+xml' },
        ]
      : [
          { src: '/icons/icon-192.svg', sizes: '192x192', type: 'image/svg+xml' },
          { src: '/icons/icon-512.svg', sizes: '512x512', type: 'image/svg+xml' },
        ];

    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: track.artist,
      album: track.album || 'Radio Calico',
      artwork,
    });
  }

  /**
   * Setup audio element event listeners
   */
  private setupAudioListeners(): void {
    if (!this.audioElement) return;

    this.audioElement.addEventListener('play', () => {
      this._isPlaying.set(true);
      this._status.set('playing');
      this._statusMessage.set('Now Playing');
    });

    this.audioElement.addEventListener('pause', () => {
      this._isPlaying.set(false);
      this._status.set('paused');
      this._statusMessage.set('Paused');
    });

    this.audioElement.addEventListener('waiting', () => {
      this._status.set('buffering');
      this._statusMessage.set('Buffering...');
    });

    this.audioElement.addEventListener('playing', () => {
      this._isPlaying.set(true);
      this._status.set('playing');
      this._statusMessage.set('Now Playing');
    });

    this.audioElement.addEventListener('error', () => {
      this._isPlaying.set(false);
      this._status.set('error');
      this._statusMessage.set('Error loading stream');
      this._errorMessage.set('Audio element error');
      this.errorMonitoring.trackMediaError(
        'Audio element error',
        this.audioElement?.error
      );
    });
  }

  /**
   * Start polling the metadata endpoint for track info
   */
  private startMetadataPolling(): void {
    this.fetchMetadata();
    this.metadataIntervalId = setInterval(() => this.fetchMetadata(), METADATA_POLL_INTERVAL);
  }

  /**
   * Start monitoring buffer health from the audio element
   */
  private startBufferMonitoring(): void {
    // Check buffer every second
    this.bufferCheckIntervalId = setInterval(() => {
      if (!this.audioElement) return;

      const buffered = this.audioElement.buffered;
      const currentTime = this.audioElement.currentTime;

      if (buffered.length > 0) {
        // Find the buffer range that contains the current playback position
        for (let i = 0; i < buffered.length; i++) {
          if (currentTime >= buffered.start(i) && currentTime <= buffered.end(i)) {
            const bufferAhead = buffered.end(i) - currentTime;
            this._bufferHealth.set(Math.round(bufferAhead * 10) / 10); // Round to 1 decimal
            return;
          }
        }
      }
      this._bufferHealth.set(0);
    }, 1000);
  }

  /**
   * Fetch track metadata from the JSON endpoint
   */
  private async fetchMetadata(): Promise<void> {
    try {
      const response = await fetch(METADATA_URL, { cache: 'no-store' });
      if (!response.ok) return;
      const data: StreamMetadata = await response.json();

      const current = this._currentTrack();
      const trackChanged =
        !current || current.title !== data.title || current.artist !== data.artist;

      const newTrack: TrackInfo = {
        title: data.title,
        artist: data.artist,
        album: data.album,
      };

      if (trackChanged) {
        const newCoverUrl = `${COVER_URL}?t=${Date.now()}`;
        this._coverUrl.set(newCoverUrl);
        this.updateMediaSessionMetadata(newTrack, newCoverUrl);

        // Announce track change to screen readers (only if we had a previous track)
        if (current) {
          this.announcerService.announceTrackChange(newTrack.title, newTrack.artist);

          // Send browser notification if enabled and page is backgrounded
          this.notificationService.notifyTrackChange(newTrack.title, newTrack.artist, newCoverUrl);
        }
      }

      this._currentTrack.set(newTrack);

      // Build recently played list from metadata's previous tracks
      const recentTracks: TrackInfo[] = [];
      const prevData = [
        { title: data.prev_title_1, artist: data.prev_artist_1 },
        { title: data.prev_title_2, artist: data.prev_artist_2 },
        { title: data.prev_title_3, artist: data.prev_artist_3 },
        { title: data.prev_title_4, artist: data.prev_artist_4 },
        { title: data.prev_title_5, artist: data.prev_artist_5 },
      ];
      for (const track of prevData) {
        if (track.title && track.artist) {
          recentTracks.push({ title: track.title, artist: track.artist });
        }
      }
      this._recentlyPlayed.set(recentTracks);
    } catch (e) {
      this.errorMonitoring.trackNetworkError(
        'Failed to fetch track metadata',
        METADATA_URL
      );
    }
  }

  /**
   * Play the audio stream
   */
  play(): void {
    if (this.audioElement) {
      this.audioElement.play().catch((error) => {
        this.errorMonitoring.trackError(
          'media',
          'error',
          'Could not play stream',
          error.message,
          { name: error.name }
        );
        this.handleError('Could not play stream');
      });
    }
  }

  /**
   * Pause the audio stream
   */
  pause(): void {
    if (this.audioElement) {
      this.audioElement.pause();
    }
  }

  /**
   * Toggle play/pause
   */
  togglePlayPause(): void {
    if (this._isPlaying()) {
      this.pause();
    } else {
      this.play();
    }
  }

  /**
   * Set volume (0-100)
   */
  setVolume(volume: number): void {
    const normalizedVolume = Math.max(0, Math.min(100, volume)) / 100;
    this._volume.set(normalizedVolume);
    this.preferencesService.setVolume(normalizedVolume);
    if (this.audioElement) {
      this.audioElement.volume = normalizedVolume;
    }
  }

  /**
   * Handle errors
   */
  private handleError(message: string): void {
    this._status.set('error');
    this._statusMessage.set(message);
    this._errorMessage.set(message);
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.metadataIntervalId !== null) {
      clearInterval(this.metadataIntervalId);
      this.metadataIntervalId = null;
    }
    if (this.bufferCheckIntervalId !== null) {
      clearInterval(this.bufferCheckIntervalId);
      this.bufferCheckIntervalId = null;
    }
    if (this.hls) {
      this.hls.destroy();
      this.hls = null;
    }
    this.audioElement = null;
  }
}
