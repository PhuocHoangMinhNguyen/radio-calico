import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ErrorMonitoringService } from './error-monitoring.service';

describe('ErrorMonitoringService', () => {
  let service: ErrorMonitoringService;
  let fetchSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    } as Response);

    TestBed.configureTestingModule({ providers: [ErrorMonitoringService] });
    service = TestBed.inject(ErrorMonitoringService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should start with empty error history', () => {
    expect(service.errors()).toEqual([]);
    expect(service.recoveryAttempts()).toBe(0);
    expect(service.successfulRecoveries()).toBe(0);
  });

  // -------------------------------------------------------------------------
  // trackError()
  // -------------------------------------------------------------------------
  describe('trackError', () => {
    it('tracks an error and returns an error ID', () => {
      const errorId = service.trackError('app', 'error', 'Test error', 'Details');

      expect(errorId).toMatch(/^err_\d+_[a-z0-9]+$/);
      expect(service.errors().length).toBe(1);

      const error = service.errors()[0];
      expect(error.id).toBe(errorId);
      expect(error.source).toBe('app');
      expect(error.severity).toBe('error');
      expect(error.message).toBe('Test error');
      expect(error.details).toBe('Details');
      expect(error.recovered).toBe(false);
    });

    it('adds error to the beginning of the list', () => {
      const id1 = service.trackError('app', 'error', 'First');
      const id2 = service.trackError('network', 'warning', 'Second');

      expect(service.errors()[0].id).toBe(id2);
      expect(service.errors()[1].id).toBe(id1);
    });

    it('enforces MAX_ERROR_HISTORY of 50 errors', () => {
      // Add 51 errors
      for (let i = 1; i <= 51; i++) {
        service.trackError('app', 'error', `Error ${i}`);
      }

      expect(service.errors().length).toBe(50);
      expect(service.errors()[0].message).toBe('Error 51'); // Most recent
      expect(service.errors()[49].message).toBe('Error 2'); // Oldest (Error 1 was evicted)
    });

    it('logs to console with appropriate level', () => {
      const consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      service.trackError('app', 'info', 'Info message');
      expect(consoleInfoSpy).toHaveBeenCalledWith('[APP] Info message', undefined);

      service.trackError('network', 'warning', 'Warning message');
      expect(consoleWarnSpy).toHaveBeenCalledWith('[NETWORK] Warning message', undefined);

      service.trackError('hls', 'error', 'Error message');
      expect(consoleErrorSpy).toHaveBeenCalledWith('[HLS] Error message', undefined);

      service.trackError('media', 'fatal', 'Fatal message');
      expect(consoleErrorSpy).toHaveBeenCalledWith('[MEDIA] Fatal message', undefined);

      consoleInfoSpy.mockRestore();
      consoleWarnSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    it('sends error to external service via POST /api/errors', () => {
      service.trackError('app', 'error', 'Test error', 'Details', { foo: 'bar' });

      expect(fetchSpy).toHaveBeenCalledWith('/api/errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: expect.stringContaining('"message":"Test error"'),
      });

      const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(body.source).toBe('app');
      expect(body.severity).toBe('error');
      expect(body.message).toBe('Test error');
      expect(body.details).toBe('Details');
      expect(body.metadata).toEqual({ foo: 'bar' });
      expect(body.session_id).toMatch(/^sess_\d+_[a-z0-9]+$/);
    });

    it('silently fails when external service POST fails', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      fetchSpy.mockRejectedValueOnce(new Error('Network failure'));

      service.trackError('app', 'error', 'Test error');

      // Wait for async fetch to complete
      await vi.waitFor(() => {
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          '[ErrorMonitor] Failed to send error to backend:',
          'Network failure'
        );
      });

      consoleWarnSpy.mockRestore();
    });
  });

  // -------------------------------------------------------------------------
  // Specialized tracking methods
  // -------------------------------------------------------------------------
  describe('specialized tracking methods', () => {
    it('trackHlsError wraps HLS errors correctly', () => {
      const errorId = service.trackHlsError('NETWORK_ERROR', true, 'Connection lost', {
        url: 'https://example.com/stream.m3u8',
      });

      expect(service.errors().length).toBe(1);

      const error = service.errors()[0];
      expect(error.id).toBe(errorId);
      expect(error.source).toBe('hls');
      expect(error.severity).toBe('fatal'); // fatal=true
      expect(error.message).toBe('HLS NETWORK_ERROR error');
      expect(error.details).toBe('Connection lost');
      expect(error.metadata).toEqual({
        hlsType: 'NETWORK_ERROR',
        fatal: true,
        url: 'https://example.com/stream.m3u8',
      });
    });

    it('trackHlsError uses "error" severity when fatal=false', () => {
      service.trackHlsError('BUFFER_STALLED_ERROR', false, 'Buffering');

      expect(service.errors()[0].severity).toBe('error');
    });

    it('trackNetworkError tracks network errors', () => {
      const errorId = service.trackNetworkError('Failed to fetch', 'https://api.example.com', 404);

      const error = service.errors()[0];
      expect(error.id).toBe(errorId);
      expect(error.source).toBe('network');
      expect(error.severity).toBe('error');
      expect(error.message).toBe('Failed to fetch');
      expect(error.metadata).toEqual({ url: 'https://api.example.com', statusCode: 404 });
    });

    it('trackMediaError tracks media errors', () => {
      const mockMediaError = {
        code: 3,
        message: 'MEDIA_ERR_DECODE',
      } as MediaError;

      const errorId = service.trackMediaError('Decoding failed', mockMediaError);

      const error = service.errors()[0];
      expect(error.id).toBe(errorId);
      expect(error.source).toBe('media');
      expect(error.severity).toBe('error');
      expect(error.message).toBe('Decoding failed');
      expect(error.details).toBe('MEDIA_ERR_DECODE');
      expect(error.metadata).toEqual({ code: 3 });
    });
  });

  // -------------------------------------------------------------------------
  // Recovery tracking
  // -------------------------------------------------------------------------
  describe('recovery tracking', () => {
    it('recordRecoveryAttempt increments attempt counter', () => {
      service.recordRecoveryAttempt();

      expect(service.recoveryAttempts()).toBe(1);

      service.recordRecoveryAttempt();

      expect(service.recoveryAttempts()).toBe(2);
    });

    it('recordRecoveryAttempt marks error as not recovered', () => {
      const errorId = service.trackError('hls', 'error', 'Stream error');

      service.recordRecoveryAttempt(errorId);

      const error = service.errors().find((e) => e.id === errorId);
      expect(error?.recovered).toBe(false);
    });

    it('recordSuccessfulRecovery increments success counter', () => {
      service.recordSuccessfulRecovery();

      expect(service.successfulRecoveries()).toBe(1);

      service.recordSuccessfulRecovery();

      expect(service.successfulRecoveries()).toBe(2);
    });

    it('recordSuccessfulRecovery marks error as recovered', () => {
      const errorId = service.trackError('hls', 'error', 'Stream error');

      service.recordSuccessfulRecovery(errorId);

      const error = service.errors().find((e) => e.id === errorId);
      expect(error?.recovered).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // getStats()
  // -------------------------------------------------------------------------
  describe('getStats', () => {
    it('returns zero counts when no errors tracked', () => {
      const stats = service.getStats();

      expect(stats.totalErrors).toBe(0);
      expect(stats.recoveryAttempts).toBe(0);
      expect(stats.successfulRecoveries).toBe(0);
      expect(stats.recoveryRate).toBe(0); // FIXED: returns 0 when attempts = 0
      expect(stats.errorsBySource).toEqual({
        hls: 0,
        network: 0,
        media: 0,
        app: 0,
        unknown: 0,
      });
      expect(stats.errorsBySeverity).toEqual({
        info: 0,
        warning: 0,
        error: 0,
        fatal: 0,
      });
    });

    it('counts errors by source correctly', () => {
      service.trackError('hls', 'error', 'HLS error 1');
      service.trackError('hls', 'error', 'HLS error 2');
      service.trackError('network', 'error', 'Network error');
      service.trackError('app', 'warning', 'App warning');

      const stats = service.getStats();

      expect(stats.errorsBySource.hls).toBe(2);
      expect(stats.errorsBySource.network).toBe(1);
      expect(stats.errorsBySource.app).toBe(1);
      expect(stats.errorsBySource.media).toBe(0);
      expect(stats.errorsBySource.unknown).toBe(0);
    });

    it('counts errors by severity correctly', () => {
      service.trackError('app', 'info', 'Info');
      service.trackError('app', 'warning', 'Warning 1');
      service.trackError('app', 'warning', 'Warning 2');
      service.trackError('app', 'error', 'Error 1');
      service.trackError('app', 'error', 'Error 2');
      service.trackError('app', 'error', 'Error 3');
      service.trackError('app', 'fatal', 'Fatal');

      const stats = service.getStats();

      expect(stats.errorsBySeverity.info).toBe(1);
      expect(stats.errorsBySeverity.warning).toBe(2);
      expect(stats.errorsBySeverity.error).toBe(3);
      expect(stats.errorsBySeverity.fatal).toBe(1);
    });

    it('computes recoveryRate when attempts > 0', () => {
      service.recordRecoveryAttempt();
      service.recordRecoveryAttempt();
      service.recordRecoveryAttempt();
      service.recordSuccessfulRecovery();
      service.recordSuccessfulRecovery();

      const stats = service.getStats();

      expect(stats.recoveryAttempts).toBe(3);
      expect(stats.successfulRecoveries).toBe(2);
      expect(stats.recoveryRate).toBeCloseTo(2 / 3);
    });

    it('returns recoveryRate = 0 when attempts = 0', () => {
      const stats = service.getStats();

      expect(stats.recoveryAttempts).toBe(0);
      expect(stats.successfulRecoveries).toBe(0);
      expect(stats.recoveryRate).toBe(0); // FIXED: returns 0 when attempts = 0
    });
  });

  // -------------------------------------------------------------------------
  // clearErrors()
  // -------------------------------------------------------------------------
  describe('clearErrors', () => {
    it('clears all errors and resets counters', () => {
      service.trackError('app', 'error', 'Error 1');
      service.trackError('app', 'error', 'Error 2');
      service.recordRecoveryAttempt();
      service.recordSuccessfulRecovery();

      service.clearErrors();

      expect(service.errors()).toEqual([]);
      expect(service.recoveryAttempts()).toBe(0);
      expect(service.successfulRecoveries()).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // recentErrors()
  // -------------------------------------------------------------------------
  describe('recentErrors', () => {
    it('returns up to 10 most recent errors', () => {
      for (let i = 1; i <= 15; i++) {
        service.trackError('app', 'error', `Error ${i}`);
      }

      const recent = service.recentErrors();

      expect(recent.length).toBe(10);
      expect(recent[0].message).toBe('Error 15'); // Most recent
      expect(recent[9].message).toBe('Error 6');
    });

    it('returns all errors when < 10 errors tracked', () => {
      service.trackError('app', 'error', 'Error 1');
      service.trackError('app', 'error', 'Error 2');

      const recent = service.recentErrors();

      expect(recent.length).toBe(2);
    });
  });
});
