/**
 * Application-wide constants
 * Centralized configuration for timing, limits, and thresholds
 */

// ============================================================================
// HLS Streaming & Playback
// ============================================================================

/** HLS stream URL (CloudFront CDN) */
export const HLS_STREAM_URL = 'https://d3d4yli4hf5bmh.cloudfront.net/hls/live.m3u8';

/** Metadata polling interval (10 seconds) */
export const METADATA_POLL_INTERVAL_MS = 10_000;

/** Metadata fetch timeout (5 seconds) */
export const METADATA_FETCH_TIMEOUT_MS = 5_000;

/** HLS recovery delay after fatal error (5 seconds) */
export const HLS_RECOVERY_DELAY_MS = 5_000;

/** Max consecutive metadata fetch failures before exponential backoff */
export const MAX_METADATA_FAILURES = 5;

/** Initial backoff delay for metadata fetch failures (10 seconds) */
export const METADATA_BACKOFF_INITIAL_MS = 10_000;

/** Maximum backoff delay for metadata fetch failures (5 minutes) */
export const METADATA_BACKOFF_MAX_MS = 300_000;

/** Buffer health check interval (1 second) */
export const BUFFER_HEALTH_CHECK_INTERVAL_MS = 1_000;

// ============================================================================
// Error Monitoring
// ============================================================================

/** Maximum error history to keep in memory */
export const MAX_ERROR_HISTORY = 50;

/** Max backend logging failures before circuit breaker opens */
export const MAX_BACKEND_FAILURES = 3;

/** Initial circuit breaker reset delay (60 seconds) */
export const CIRCUIT_BREAKER_INITIAL_DELAY_MS = 60_000;

/** Maximum circuit breaker reset delay (10 minutes) */
export const CIRCUIT_BREAKER_MAX_DELAY_MS = 600_000;

// ============================================================================
// Statistics & Storage
// ============================================================================

/** Listening stats save interval (30 seconds) */
export const STATS_SAVE_INTERVAL_SECONDS = 30;

/** Maximum number of bookmarks (localStorage limit consideration) */
export const MAX_BOOKMARKS = 50;

/** Maximum number of recently played tracks to display */
export const MAX_RECENTLY_PLAYED = 5;

// ============================================================================
// User Preferences
// ============================================================================

/** Default volume level (0-1 scale) */
export const DEFAULT_VOLUME = 0.7;

/** Volume adjustment step for keyboard shortcuts (5%) */
export const VOLUME_STEP = 0.05;

/** Theme options */
export const THEMES = {
  LIGHT: 'light',
  DARK: 'dark',
  SYSTEM: 'system',
} as const;

/** Default theme */
export const DEFAULT_THEME = THEMES.SYSTEM;

// ============================================================================
// Sleep Timer
// ============================================================================

/** Available sleep timer durations (in minutes) */
export const SLEEP_TIMER_OPTIONS = [5, 10, 15, 30, 45, 60, 90, 120] as const;

/** Sleep timer countdown interval (1 second) */
export const SLEEP_TIMER_TICK_INTERVAL_MS = 1_000;

// ============================================================================
// API & Network
// ============================================================================

/** API base URL (relative to current origin) */
export const API_BASE_URL = '/api';

/** Request timeout for API calls (10 seconds) */
export const API_REQUEST_TIMEOUT_MS = 10_000;

/** Rate limit: requests per minute per IP (backend config) */
export const RATE_LIMIT_MAX_REQUESTS = 100;

/** Rate limit window (1 minute) */
export const RATE_LIMIT_WINDOW_MS = 60_000;

// ============================================================================
// LocalStorage Keys
// ============================================================================

/** LocalStorage key for user preferences */
export const STORAGE_KEY_PREFERENCES = 'radio-calico-preferences';

/** LocalStorage key for listening statistics */
export const STORAGE_KEY_STATS = 'radio-calico-stats';

/** LocalStorage key for bookmarked tracks */
export const STORAGE_KEY_BOOKMARKS = 'radio-calico-bookmarks';

/** LocalStorage key for error monitoring session ID */
export const STORAGE_KEY_SESSION = 'radio-calico-session';

// ============================================================================
// Metadata URLs
// ============================================================================

/** Metadata JSON endpoint (CloudFront) */
export const METADATA_URL = 'https://d3d4yli4hf5bmh.cloudfront.net/metadata/metadatav2.json';

/** Album cover art base URL (CloudFront) */
export const COVER_ART_BASE_URL = 'https://d3d4yli4hf5bmh.cloudfront.net/metadata';

// ============================================================================
// UI & Accessibility
// ============================================================================

/** Debounce delay for resize events (300ms) */
export const RESIZE_DEBOUNCE_MS = 300;

/** Toast/notification display duration (5 seconds) */
export const NOTIFICATION_DURATION_MS = 5_000;

/** Fade animation duration (300ms) */
export const FADE_ANIMATION_MS = 300;

/** Mobile breakpoint (768px) */
export const MOBILE_BREAKPOINT_PX = 768;

/** Tablet breakpoint (1024px) */
export const TABLET_BREAKPOINT_PX = 1024;

// ============================================================================
// Feature Flags (for gradual rollouts)
// ============================================================================

/** Enable browser notifications (can be toggled per environment) */
export const FEATURE_NOTIFICATIONS_ENABLED = true;

/** Enable service worker / PWA features */
export const FEATURE_PWA_ENABLED = true;

/** Enable error reporting to backend */
export const FEATURE_ERROR_REPORTING_ENABLED = true;

/** Enable external monitoring (Sentry, etc.) */
export const FEATURE_EXTERNAL_MONITORING_ENABLED = true;

// ============================================================================
// Development & Debugging
// ============================================================================

/** Enable verbose console logging in development */
export const DEBUG_VERBOSE_LOGGING = false;

/** Enable HLS.js debug mode */
export const DEBUG_HLS_LOGGING = false;

// ============================================================================
// Type exports for const enums
// ============================================================================

export type Theme = (typeof THEMES)[keyof typeof THEMES];
export type SleepTimerDuration = (typeof SLEEP_TIMER_OPTIONS)[number];
