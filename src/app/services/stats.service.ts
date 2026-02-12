import { Injectable, inject, signal, computed, effect, OnDestroy } from '@angular/core';
import { HlsPlayerService } from './hls-player.service';

const STORAGE_KEY = 'radio-calico-stats';

interface ListeningStats {
  totalSeconds: number;
  lastUpdated: string;
}

const DEFAULT_STATS: ListeningStats = {
  totalSeconds: 0,
  lastUpdated: new Date().toISOString(),
};

@Injectable({ providedIn: 'root' })
export class StatsService implements OnDestroy {
  private readonly hlsService = inject(HlsPlayerService);

  private _totalSeconds = signal<number>(0);
  private intervalId: ReturnType<typeof setInterval> | null = null;

  // Public readonly signals
  readonly totalSeconds = this._totalSeconds.asReadonly();

  readonly totalMinutes = computed(() => Math.floor(this._totalSeconds() / 60));
  readonly totalHours = computed(() => Math.floor(this._totalSeconds() / 3600));

  readonly formattedTime = computed(() => {
    const seconds = this._totalSeconds();

    if (seconds < 60) {
      return `${seconds} second${seconds !== 1 ? 's' : ''}`;
    }

    if (seconds < 3600) {
      const mins = Math.floor(seconds / 60);
      return `${mins} minute${mins !== 1 ? 's' : ''}`;
    }

    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);

    if (mins === 0) {
      return `${hours} hour${hours !== 1 ? 's' : ''}`;
    }

    return `${hours} hour${hours !== 1 ? 's' : ''} ${mins} min`;
  });

  readonly displayMessage = computed(() => {
    const seconds = this._totalSeconds();

    if (seconds === 0) {
      return 'Start listening to track your time';
    }

    return `You've listened for ${this.formattedTime()}`;
  });

  constructor() {
    this.loadStats();

    // Watch for play state changes to start/stop tracking
    effect(() => {
      const isPlaying = this.hlsService.isPlaying();

      if (isPlaying) {
        this.startTracking();
      } else {
        this.stopTracking();
      }
    });
  }

  private loadStats(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const stats: ListeningStats = JSON.parse(stored);
        this._totalSeconds.set(stats.totalSeconds);
      }
    } catch (error) {
      console.warn('Failed to load listening stats:', error);
    }
  }

  private saveStats(): void {
    try {
      const stats: ListeningStats = {
        totalSeconds: this._totalSeconds(),
        lastUpdated: new Date().toISOString(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
    } catch (error) {
      console.warn('Failed to save listening stats:', error);
    }
  }

  private startTracking(): void {
    // Defensive: Clear any existing interval before starting new one
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.intervalId = setInterval(() => {
      this._totalSeconds.update((s) => s + 1);

      // Save every 30 seconds to reduce writes
      if (this._totalSeconds() % 30 === 0) {
        this.saveStats();
      }
    }, 1000);
  }

  private stopTracking(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.saveStats();
    }
  }

  /**
   * Reset all listening statistics
   */
  reset(): void {
    this.stopTracking();
    this._totalSeconds.set(0);
    this.saveStats();

    // Restart tracking if currently playing
    if (this.hlsService.isPlaying()) {
      this.startTracking();
    }
  }

  /**
   * Cleanup resources on service destruction
   * Defensive: Ensures interval is cleared and stats are saved
   * even if service is destroyed in an unexpected state
   */
  ngOnDestroy(): void {
    // Always clear interval, regardless of current state
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    // Save final state
    this.saveStats();
  }
}
