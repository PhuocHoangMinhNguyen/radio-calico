import { Injectable, signal, computed } from '@angular/core';
import Hls from 'hls.js';
import { TrackInfo, StreamMetadata } from '../models/track-info';

export type PlayerStatus = 'initializing' | 'ready' | 'playing' | 'paused' | 'buffering' | 'error';

const METADATA_URL = 'https://d3d4yli4hf5bmh.cloudfront.net/metadatav2.json';
const METADATA_POLL_INTERVAL = 10_000;

@Injectable({
  providedIn: 'root'
})
export class HlsPlayerService {
  private hls: Hls | null = null;
  private audioElement: HTMLAudioElement | null = null;
  private metadataIntervalId: ReturnType<typeof setInterval> | null = null;

  // Writable signals for internal state management
  private _isPlaying = signal<boolean>(false);
  private _volume = signal<number>(0.8);
  private _status = signal<PlayerStatus>('initializing');
  private _statusMessage = signal<string>('Initializing...');
  private _errorMessage = signal<string>('');
  private _currentTrack = signal<TrackInfo | null>(null);
  private _recentlyPlayed = signal<TrackInfo[]>([]);

  // Public readonly signals
  readonly isPlaying = this._isPlaying.asReadonly();
  readonly volume = this._volume.asReadonly();
  readonly status = this._status.asReadonly();
  readonly statusMessage = this._statusMessage.asReadonly();
  readonly errorMessage = this._errorMessage.asReadonly();
  readonly currentTrack = this._currentTrack.asReadonly();
  readonly recentlyPlayed = this._recentlyPlayed.asReadonly();

  // Computed signals
  readonly statusClass = computed(() => {
    const status = this._status();
    return status === 'playing' ? 'playing' : status === 'error' ? 'error' : '';
  });
  readonly hasTrackInfo = computed(() => this._currentTrack() !== null);

  /**
   * Initialize the HLS player with an audio element and stream URL
   */
  initializePlayer(audioElement: HTMLAudioElement, streamUrl: string): void {
    this.audioElement = audioElement;
    this.audioElement.volume = this._volume();

    // Setup audio element event listeners
    this.setupAudioListeners();

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
    this.hls.on(Hls.Events.MANIFEST_PARSED, () => {
      this._status.set('ready');
      this._statusMessage.set('Ready to play');
      console.log('HLS manifest loaded successfully');
    });

    this.hls.on(Hls.Events.ERROR, (_event, data) => {
      if (data.fatal) {
        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            this._status.set('error');
            this._statusMessage.set('Network error - Retrying...');
            console.error('Network error:', data);
            this.hls!.startLoad();
            break;
          case Hls.ErrorTypes.MEDIA_ERROR:
            this._status.set('error');
            this._statusMessage.set('Media error - Recovering...');
            console.error('Media error:', data);
            this.hls!.recoverMediaError();
            break;
          default:
            this._status.set('error');
            this._statusMessage.set('Fatal error - Cannot play stream');
            this._errorMessage.set(data.details || 'Unknown error');
            console.error('Fatal error:', data);
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
      console.error('Audio error');
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
   * Fetch track metadata from the JSON endpoint
   */
  private async fetchMetadata(): Promise<void> {
    try {
      const response = await fetch(METADATA_URL, { cache: 'no-store' });
      if (!response.ok) return;
      const data: StreamMetadata = await response.json();

      this._currentTrack.set({
        title: data.title,
        artist: data.artist,
      });

      const prev: TrackInfo[] = [];
      for (let i = 1; i <= 5; i++) {
        const title = data[`prev_title_${i}` as keyof StreamMetadata] as string;
        const artist = data[`prev_artist_${i}` as keyof StreamMetadata] as string;
        if (title && artist) {
          prev.push({ title, artist });
        }
      }
      this._recentlyPlayed.set(prev);
    } catch (e) {
      console.warn('Failed to fetch track metadata:', e);
    }
  }

  /**
   * Play the audio stream
   */
  play(): void {
    if (this.audioElement) {
      this.audioElement.play().catch((error) => {
        console.error('Play error:', error);
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
    if (this.hls) {
      this.hls.destroy();
      this.hls = null;
    }
    this.audioElement = null;
  }
}
