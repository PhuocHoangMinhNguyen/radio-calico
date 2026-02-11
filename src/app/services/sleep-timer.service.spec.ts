import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SleepTimerService } from './sleep-timer.service';
import { HlsPlayerService } from './hls-player.service';

const mockHlsService = {
  pause: vi.fn(),
  play: vi.fn(),
  isPlaying: vi.fn(() => false),
};

describe('SleepTimerService', () => {
  let service: SleepTimerService;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();

    TestBed.configureTestingModule({
      providers: [
        SleepTimerService,
        { provide: HlsPlayerService, useValue: mockHlsService },
      ],
    });
    service = TestBed.inject(SleepTimerService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should have initial inactive state', () => {
    expect(service.isActive()).toBe(false);
    expect(service.remainingSeconds()).toBe(0);
    expect(service.selectedDuration()).toBeNull();
  });

  // -------------------------------------------------------------------------
  // start()
  // -------------------------------------------------------------------------
  describe('start', () => {
    it('starts a timer with the specified duration', () => {
      service.start(15);

      expect(service.isActive()).toBe(true);
      expect(service.selectedDuration()).toBe(15);
      expect(service.remainingSeconds()).toBe(15 * 60);
      expect(service.remainingMinutes()).toBe(15);
    });

    it('counts down every second', () => {
      service.start(1);

      expect(service.remainingSeconds()).toBe(60);

      vi.advanceTimersByTime(1000);
      expect(service.remainingSeconds()).toBe(59);

      vi.advanceTimersByTime(5000);
      expect(service.remainingSeconds()).toBe(54);
    });

    it('cancels any existing timer before starting a new one', () => {
      service.start(15);
      expect(service.remainingSeconds()).toBe(15 * 60);

      service.start(30);
      expect(service.selectedDuration()).toBe(30);
      expect(service.remainingSeconds()).toBe(30 * 60);
    });
  });

  // -------------------------------------------------------------------------
  // cancel()
  // -------------------------------------------------------------------------
  describe('cancel', () => {
    it('stops the timer and resets state', () => {
      service.start(15);
      vi.advanceTimersByTime(10_000);

      service.cancel();

      expect(service.isActive()).toBe(false);
      expect(service.remainingSeconds()).toBe(0);
      expect(service.selectedDuration()).toBeNull();
    });

    it('does not throw when called with no active timer', () => {
      expect(() => service.cancel()).not.toThrow();
    });

    it('stops the interval so countdown no longer occurs', () => {
      service.start(1);
      vi.advanceTimersByTime(10_000);
      const beforeCancel = service.remainingSeconds();

      service.cancel();

      vi.advanceTimersByTime(10_000);
      expect(service.remainingSeconds()).toBe(0); // Should not have changed
      expect(service.remainingSeconds()).not.toBe(beforeCancel - 10);
    });
  });

  // -------------------------------------------------------------------------
  // toggle()
  // -------------------------------------------------------------------------
  describe('toggle', () => {
    it('starts the timer when inactive', () => {
      service.toggle(15);

      expect(service.isActive()).toBe(true);
      expect(service.selectedDuration()).toBe(15);
    });

    it('cancels the timer when toggling the same duration while active', () => {
      service.start(15);

      service.toggle(15);

      expect(service.isActive()).toBe(false);
    });

    it('starts a new timer when toggling a different duration', () => {
      service.start(15);

      service.toggle(30);

      expect(service.isActive()).toBe(true);
      expect(service.selectedDuration()).toBe(30);
      expect(service.remainingSeconds()).toBe(30 * 60);
    });
  });

  // -------------------------------------------------------------------------
  // Timer completion (pauses the player)
  // -------------------------------------------------------------------------
  describe('timer completion', () => {
    // NOTE: There is an off-by-one discrepancy in the implementation.
    // The condition is `if (remaining <= 1)` instead of `if (remaining === 0)`.
    // This means the timer fires when 1 second remains, not when it reaches 0.
    // The tests below document the CURRENT behavior, not necessarily the intended behavior.

    it('pauses the player when timer reaches 1 second (current behavior)', () => {
      service.start(1); // 1 minute = 60 seconds

      // Advance to 2 seconds remaining
      vi.advanceTimersByTime(58_000);
      expect(service.remainingSeconds()).toBe(2);
      expect(mockHlsService.pause).not.toHaveBeenCalled();

      // Advance 1 more second — remaining becomes 1
      vi.advanceTimersByTime(1_000);
      expect(service.remainingSeconds()).toBe(1);
      expect(mockHlsService.pause).not.toHaveBeenCalled();

      // Advance 1 more second — timer fires when checking remaining <= 1
      vi.advanceTimersByTime(1_000);
      expect(service.remainingSeconds()).toBe(0); // Timer cancelled and reset
      expect(mockHlsService.pause).toHaveBeenCalledOnce();
      expect(service.isActive()).toBe(false);
    });

    it('resets timer state after completion', () => {
      service.start(1);

      // Advance past completion (60 seconds = full duration)
      vi.advanceTimersByTime(60_000);

      expect(service.isActive()).toBe(false);
      expect(service.remainingSeconds()).toBe(0);
      expect(service.selectedDuration()).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Computed signals
  // -------------------------------------------------------------------------
  describe('computed signals', () => {
    it('computes remainingMinutes as ceiling of remainingSeconds / 60', () => {
      service.start(1);

      expect(service.remainingMinutes()).toBe(1);

      vi.advanceTimersByTime(30_000);
      expect(service.remainingSeconds()).toBe(30);
      expect(service.remainingMinutes()).toBe(1); // ceil(30/60) = 1
    });

    it('computes formattedTime as MM:SS', () => {
      service.start(1);

      expect(service.formattedTime()).toBe('1:00');

      vi.advanceTimersByTime(15_000);
      expect(service.formattedTime()).toBe('0:45');

      vi.advanceTimersByTime(40_000);
      expect(service.formattedTime()).toBe('0:05');
    });

    it('returns empty string for formattedTime when timer is inactive', () => {
      expect(service.formattedTime()).toBe('');
    });

    it('computes progress as percentage of elapsed time', () => {
      service.start(1); // 60 seconds

      expect(service.progress()).toBe(0);

      vi.advanceTimersByTime(30_000);
      expect(service.progress()).toBe(50);

      vi.advanceTimersByTime(15_000);
      expect(service.progress()).toBe(75);
    });

    it('returns 0 progress when timer is inactive', () => {
      expect(service.progress()).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // Edge cases
  // -------------------------------------------------------------------------
  describe('edge cases', () => {
    it('handles 0 seconds scenario when starting with 0 minutes (if somehow passed)', () => {
      // TypeScript prevents this at compile time, but test runtime behavior
      // @ts-expect-error Testing invalid input
      service.start(0);

      // Should set remaining to 0 (0 * 60)
      expect(service.remainingSeconds()).toBe(0);
      expect(service.isActive()).toBe(true);

      // Timer should complete immediately on first tick
      vi.advanceTimersByTime(1000);
      expect(service.isActive()).toBe(false);
      expect(mockHlsService.pause).toHaveBeenCalledOnce();
    });

    it('handles rapid start/cancel sequences', () => {
      service.start(15);
      expect(service.isActive()).toBe(true);

      service.cancel();
      expect(service.isActive()).toBe(false);

      service.start(30);
      expect(service.isActive()).toBe(true);
      expect(service.selectedDuration()).toBe(30);

      service.cancel();
      expect(service.isActive()).toBe(false);

      service.start(60);
      expect(service.isActive()).toBe(true);
      expect(service.selectedDuration()).toBe(60);

      // No errors, state is consistent
      expect(mockHlsService.pause).not.toHaveBeenCalled();
    });

    it('handles canceling immediately after starting', () => {
      service.start(15);
      service.cancel();

      expect(service.isActive()).toBe(false);
      expect(service.remainingSeconds()).toBe(0);
      expect(service.selectedDuration()).toBeNull();

      // Should not pause or throw
      expect(mockHlsService.pause).not.toHaveBeenCalled();
      expect(() => vi.advanceTimersByTime(10_000)).not.toThrow();
    });

    it('handles multiple rapid starts without explicit cancel', () => {
      service.start(15);
      const firstRemaining = service.remainingSeconds();

      // Start again immediately (should auto-cancel previous)
      service.start(30);
      expect(service.selectedDuration()).toBe(30);
      expect(service.remainingSeconds()).toBe(30 * 60);
      expect(service.remainingSeconds()).not.toBe(firstRemaining);

      // And again
      service.start(60);
      expect(service.selectedDuration()).toBe(60);
      expect(service.remainingSeconds()).toBe(60 * 60);

      // Only one timer should be running
      vi.advanceTimersByTime(5000);
      expect(service.remainingSeconds()).toBe(60 * 60 - 5);
    });

    it('handles starting when already active with same duration', () => {
      service.start(15);
      vi.advanceTimersByTime(30_000); // 30 seconds elapsed
      expect(service.remainingSeconds()).toBe(15 * 60 - 30);

      // Restart with same duration - should reset to full duration
      service.start(15);
      expect(service.remainingSeconds()).toBe(15 * 60);
      expect(service.isActive()).toBe(true);
    });

    it('handles rapid toggle calls', () => {
      service.toggle(15); // Start
      expect(service.isActive()).toBe(true);

      service.toggle(15); // Cancel
      expect(service.isActive()).toBe(false);

      service.toggle(15); // Start again
      expect(service.isActive()).toBe(true);

      service.toggle(15); // Cancel again
      expect(service.isActive()).toBe(false);

      // Should be stable
      expect(service.remainingSeconds()).toBe(0);
      expect(service.selectedDuration()).toBeNull();
    });

    it('handles pause error gracefully on timer completion', () => {
      // Make pause throw an error
      mockHlsService.pause.mockImplementationOnce(() => {
        throw new Error('Player not initialized');
      });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      service.start(1);
      vi.advanceTimersByTime(60_000);

      // Should not throw, timer should be cancelled
      expect(service.isActive()).toBe(false);
      expect(service.remainingSeconds()).toBe(0);
      expect(consoleSpy).toHaveBeenCalledWith(
        'Sleep timer failed to pause playback:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('handles timer completion with multiple intervals queued', () => {
      service.start(1);

      // Advance past completion in one big jump
      vi.advanceTimersByTime(100_000); // Way past 60 seconds

      // Should only pause once, not multiple times
      expect(mockHlsService.pause).toHaveBeenCalledOnce();
      expect(service.isActive()).toBe(false);
    });

    it('maintains state consistency after cancel during countdown', () => {
      service.start(15);
      vi.advanceTimersByTime(5000); // 5 seconds elapsed

      const beforeCancel = service.remainingSeconds();
      expect(beforeCancel).toBe(15 * 60 - 5);

      service.cancel();

      // State should be fully reset
      expect(service.isActive()).toBe(false);
      expect(service.remainingSeconds()).toBe(0);
      expect(service.selectedDuration()).toBeNull();
      expect(service.formattedTime()).toBe('');
      expect(service.progress()).toBe(0);
    });

    it('handles negative minutes input (if somehow passed)', () => {
      // TypeScript prevents this, but test runtime behavior
      // @ts-expect-error Testing invalid input
      service.start(-5);

      // Should set to negative seconds (-300)
      expect(service.remainingSeconds()).toBe(-300);
      expect(service.isActive()).toBe(true);

      // Timer should complete on first tick (remaining <= 1)
      vi.advanceTimersByTime(1000);
      expect(service.isActive()).toBe(false);
      expect(mockHlsService.pause).toHaveBeenCalledOnce();
    });
  });
});
