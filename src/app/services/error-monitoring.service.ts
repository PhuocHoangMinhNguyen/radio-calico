import { Injectable, signal, ErrorHandler, inject, isDevMode } from '@angular/core';

export type ErrorSeverity = 'info' | 'warning' | 'error' | 'fatal';
export type ErrorSource = 'hls' | 'network' | 'media' | 'app' | 'unknown';

export interface TrackedError {
  id: string;
  timestamp: Date;
  source: ErrorSource;
  severity: ErrorSeverity;
  message: string;
  details?: string;
  recovered: boolean;
  metadata?: Record<string, unknown>;
}

const MAX_ERROR_HISTORY = 50;
const API_BASE_URL = '/api';

@Injectable({
  providedIn: 'root',
})
export class ErrorMonitoringService {
  private _errors = signal<TrackedError[]>([]);
  private _recoveryAttempts = signal<number>(0);
  private _successfulRecoveries = signal<number>(0);

  // Session ID persists for the lifetime of the page
  private readonly sessionId = this.generateSessionId();

  // Circuit breaker for backend logging
  private backendFailureCount = 0;
  private readonly MAX_BACKEND_FAILURES = 3;
  private backendCircuitOpen = false;
  private backendCircuitResetTimeout: ReturnType<typeof setTimeout> | null = null;

  readonly errors = this._errors.asReadonly();
  readonly recoveryAttempts = this._recoveryAttempts.asReadonly();
  readonly successfulRecoveries = this._successfulRecoveries.asReadonly();

  readonly recentErrors = () => this._errors().slice(0, 10);

  /**
   * Track an error with full context
   */
  trackError(
    source: ErrorSource,
    severity: ErrorSeverity,
    message: string,
    details?: string,
    metadata?: Record<string, unknown>
  ): string {
    const error: TrackedError = {
      id: this.generateErrorId(),
      timestamp: new Date(),
      source,
      severity,
      message,
      details,
      recovered: false,
      metadata,
    };

    this._errors.update((errors) => [error, ...errors].slice(0, MAX_ERROR_HISTORY));

    // Log to console with appropriate level
    this.logToConsole(error);

    // Hook for external services (Sentry, etc.)
    this.sendToExternalService(error);

    return error.id;
  }

  /**
   * Track an HLS-specific error
   */
  trackHlsError(
    type: string,
    fatal: boolean,
    details: string,
    metadata?: Record<string, unknown>
  ): string {
    return this.trackError(
      'hls',
      fatal ? 'fatal' : 'error',
      `HLS ${type} error`,
      details,
      { hlsType: type, fatal, ...metadata }
    );
  }

  /**
   * Track a network error
   */
  trackNetworkError(message: string, url?: string, statusCode?: number): string {
    return this.trackError('network', 'error', message, undefined, { url, statusCode });
  }

  /**
   * Track a media error
   */
  trackMediaError(message: string, mediaError?: MediaError | null): string {
    return this.trackError('media', 'error', message, mediaError?.message, {
      code: mediaError?.code,
    });
  }

  /**
   * Record a recovery attempt
   */
  recordRecoveryAttempt(errorId?: string): void {
    this._recoveryAttempts.update((count) => count + 1);

    if (errorId) {
      this._errors.update((errors) =>
        errors.map((e) => (e.id === errorId ? { ...e, recovered: false } : e))
      );
    }

    if (isDevMode()) {
      console.log(`[ErrorMonitor] Recovery attempt #${this._recoveryAttempts()}`);
    }
  }

  /**
   * Record a successful recovery
   */
  recordSuccessfulRecovery(errorId?: string): void {
    this._successfulRecoveries.update((count) => count + 1);

    if (errorId) {
      this._errors.update((errors) =>
        errors.map((e) => (e.id === errorId ? { ...e, recovered: true } : e))
      );
    }

    if (isDevMode()) {
      console.log(
        `[ErrorMonitor] Recovery successful (${this._successfulRecoveries()}/${this._recoveryAttempts()})`
      );
    }
  }

  /**
   * Get error statistics
   */
  getStats(): {
    totalErrors: number;
    recoveryAttempts: number;
    successfulRecoveries: number;
    recoveryRate: number;
    errorsBySource: Record<ErrorSource, number>;
    errorsBySeverity: Record<ErrorSeverity, number>;
  } {
    const errors = this._errors();
    const errorsBySource: Record<ErrorSource, number> = {
      hls: 0,
      network: 0,
      media: 0,
      app: 0,
      unknown: 0,
    };
    const errorsBySeverity: Record<ErrorSeverity, number> = {
      info: 0,
      warning: 0,
      error: 0,
      fatal: 0,
    };

    for (const error of errors) {
      errorsBySource[error.source]++;
      errorsBySeverity[error.severity]++;
    }

    const attempts = this._recoveryAttempts();
    const successes = this._successfulRecoveries();

    return {
      totalErrors: errors.length,
      recoveryAttempts: attempts,
      successfulRecoveries: successes,
      recoveryRate: attempts > 0 ? successes / attempts : 0,
      errorsBySource,
      errorsBySeverity,
    };
  }

  /**
   * Clear error history
   */
  clearErrors(): void {
    this._errors.set([]);
    this._recoveryAttempts.set(0);
    this._successfulRecoveries.set(0);
  }

  private generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private generateSessionId(): string {
    return `sess_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  private logToConsole(error: TrackedError): void {
    const prefix = `[${error.source.toUpperCase()}]`;
    const message = `${prefix} ${error.message}${error.details ? `: ${error.details}` : ''}`;

    switch (error.severity) {
      case 'info':
        console.info(message, error.metadata);
        break;
      case 'warning':
        console.warn(message, error.metadata);
        break;
      case 'error':
      case 'fatal':
        console.error(message, error.metadata);
        break;
    }
  }

  /**
   * Send error to backend PostgreSQL database with circuit breaker
   */
  private sendToExternalService(error: TrackedError): void {
    // Circuit breaker: Don't send if circuit is open (backend is down)
    if (this.backendCircuitOpen) {
      // Queue to localStorage as fallback (optional - could implement later)
      return;
    }

    const payload = {
      session_id: this.sessionId,
      source: error.source,
      severity: error.severity,
      message: error.message,
      details: error.details,
      metadata: error.metadata,
    };

    fetch(`${API_BASE_URL}/errors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then((response) => {
        if (response.ok) {
          // Success - reset failure count
          this.backendFailureCount = 0;
        } else {
          // Non-2xx response counts as failure
          this.handleBackendFailure();
        }
      })
      .catch((err) => {
        // Network error or other failure
        console.warn('[ErrorMonitor] Failed to send error to backend:', err.message);
        this.handleBackendFailure();
      });
  }

  /**
   * Handle backend logging failure with circuit breaker
   */
  private handleBackendFailure(): void {
    this.backendFailureCount++;

    if (this.backendFailureCount >= this.MAX_BACKEND_FAILURES) {
      // Open circuit - stop sending errors to backend
      this.backendCircuitOpen = true;
      console.warn(
        `[ErrorMonitor] Circuit breaker opened after ${this.MAX_BACKEND_FAILURES} failures. Backend logging paused for 60 seconds.`
      );

      // Clear any existing reset timeout
      if (this.backendCircuitResetTimeout) {
        clearTimeout(this.backendCircuitResetTimeout);
      }

      // Reset circuit after 60 seconds
      this.backendCircuitResetTimeout = setTimeout(() => {
        this.backendCircuitOpen = false;
        this.backendFailureCount = 0;
        console.info('[ErrorMonitor] Circuit breaker closed. Backend logging resumed.');
      }, 60000);
    }
  }
}

/**
 * Custom Angular ErrorHandler that integrates with ErrorMonitoringService
 */
@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  private readonly errorMonitoring = inject(ErrorMonitoringService);

  handleError(error: Error): void {
    this.errorMonitoring.trackError(
      'app',
      'error',
      error.message || 'Unknown error',
      error.stack,
      { name: error.name }
    );

    // Re-throw in development for debugging
    console.error('Unhandled error:', error);
  }
}
