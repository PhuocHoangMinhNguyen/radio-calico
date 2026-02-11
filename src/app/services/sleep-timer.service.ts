import { Injectable, inject, signal, computed } from '@angular/core';
import { HlsPlayerService } from './hls-player.service';

export type SleepTimerDuration = 1 | 15 | 30 | 60 | 90;

export interface SleepTimerOption {
  minutes: SleepTimerDuration;
  label: string;
}

export const SLEEP_TIMER_OPTIONS: SleepTimerOption[] = [
  { minutes: 1, label: '1 minute' },
  { minutes: 15, label: '15 minutes' },
  { minutes: 30, label: '30 minutes' },
  { minutes: 60, label: '1 hour' },
  { minutes: 90, label: '1.5 hours' },
];

@Injectable({ providedIn: 'root' })
export class SleepTimerService {
  private readonly hlsService = inject(HlsPlayerService);

  private _remainingSeconds = signal<number>(0);
  private _isActive = signal<boolean>(false);
  private _selectedDuration = signal<SleepTimerDuration | null>(null);
  private intervalId: ReturnType<typeof setInterval> | null = null;

  // Public readonly signals
  readonly remainingSeconds = this._remainingSeconds.asReadonly();
  readonly isActive = this._isActive.asReadonly();
  readonly selectedDuration = this._selectedDuration.asReadonly();

  // Computed signals for display
  readonly remainingMinutes = computed(() => Math.ceil(this._remainingSeconds() / 60));

  readonly formattedTime = computed(() => {
    const seconds = this._remainingSeconds();
    if (seconds <= 0) return '';

    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  });

  readonly progress = computed(() => {
    const duration = this._selectedDuration();
    if (!duration || !this._isActive()) return 0;

    const totalSeconds = duration * 60;
    const remaining = this._remainingSeconds();
    return ((totalSeconds - remaining) / totalSeconds) * 100;
  });

  /**
   * Start the sleep timer with the specified duration
   */
  start(minutes: SleepTimerDuration): void {
    this.cancel();

    this._selectedDuration.set(minutes);
    this._remainingSeconds.set(minutes * 60);
    this._isActive.set(true);

    this.intervalId = setInterval(() => {
      const remaining = this._remainingSeconds();

      if (remaining <= 1) {
        this.onTimerComplete();
      } else {
        this._remainingSeconds.set(remaining - 1);
      }
    }, 1000);
  }

  /**
   * Cancel the current sleep timer
   */
  cancel(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this._isActive.set(false);
    this._remainingSeconds.set(0);
    this._selectedDuration.set(null);
  }

  /**
   * Toggle the timer - if active, cancel it; if not, start with the given duration
   */
  toggle(minutes: SleepTimerDuration): void {
    if (this._isActive() && this._selectedDuration() === minutes) {
      this.cancel();
    } else {
      this.start(minutes);
    }
  }

  /**
   * Called when the timer reaches zero
   */
  private onTimerComplete(): void {
    this.cancel();

    try {
      this.hlsService.pause();
    } catch (error) {
      // If pause fails, log the error but don't crash
      // Timer state is already cleared by cancel()
      console.error('Sleep timer failed to pause playback:', error);
    }
  }
}
