# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Radio Calico is a lossless internet radio player built with Angular 21 and HLS.js. It streams audio from a CloudFront-hosted HLS endpoint (`https://d3d4yli4hf5bmh.cloudfront.net/hls/live.m3u8`) at 48kHz/24-bit quality.

## Commands

- `npm start` — Dev server on port 3000 with auto-reload
- `npm run build:prod` — Optimized production build
- `npm test` — Run unit tests with Vitest (watch mode)
- `npm run test:headless` — Single test run (CI-friendly)
- `npm run serve:prod` — Build and run production server (Express, port 3000, serves from `dist/radio-calico/browser/`)

Individual test files can be targeted via Vitest's CLI filter: `npx vitest run src/app/components/player/player.spec.ts`

## Architecture

**Standalone components (no NgModules)** — all components use the Angular standalone API.

**State management via Angular Signals** — `HlsPlayerService` holds all player state as writable signals (`_isPlaying`, `_volume`, `_status`, `_statusMessage`, `_errorMessage`) with public readonly accessors and computed signals (e.g., `statusClass`). No external state library is used.

**Component hierarchy:**
```
App → Header
    → Player
        → LosslessBadge
        → AudioControls (play/pause via HlsPlayerService)
        → VolumeControl (slider bound to HlsPlayerService.setVolume)
        → StatusDisplay (reactive status message + CSS class)
        → StreamInfo (static format info)
        → NowPlaying (current track title/artist + album art)
        → RecentlyPlayed (last 5 tracks from metadata)
```

**HLS streaming** is managed entirely in `HlsPlayerService` using HLS.js with automatic fallback to native HLS (Safari). Error recovery handles both network and media errors.

**Track metadata** is polled every 10 seconds from a CloudFront JSON endpoint (`metadatav2.json`). The `StreamMetadata` model (in `src/app/models/track-info.ts`) includes current track info, up to 5 previous tracks, and flags like `is_new`, `is_summer`, `is_vidgames`. Album art is fetched from a separate `cover.jpg` endpoint with cache-busting on track changes.

**Production server** (`server.js`) is a plain Express server with SPA fallback routing to `index.html`.

## Conventions

- **Styling**: SCSS with CSS custom properties defined in `src/styles.scss` (dark theme, teal primary `#4a9594`)
- **TypeScript**: Strict mode enabled with `noImplicitOverride`, `noImplicitReturns`, strict templates and injection params
- **Formatting**: Prettier — 100 char width, single quotes, Angular HTML parser
- **Template syntax**: Modern Angular control flow (`@if`, `@for`) rather than structural directives

## Feature Roadmap

Features planned to make Radio Calico more modern and production-ready, organized by priority.

### High Priority - Production Essentials

- [x] **1. Media Session API Integration** (COMPLETED)
  - Lock screen controls on mobile devices
  - Hardware media keys support (keyboard play/pause/volume)
  - OS notification center showing track info and album art
  - Bluetooth headset button support
  - Location: `HlsPlayerService.setupMediaSession()` and `updateMediaSessionMetadata()`

- [x] **2. Keyboard Shortcuts** (COMPLETED)
  - `Space` — Play/Pause
  - `↑/↓` — Volume up/down (5% increments)
  - `M` — Mute toggle
  - `L` — Like/unlike current track
  - Location: `KeyboardShortcutService` + `@HostListener` in `App` component

- [x] **3. PWA (Progressive Web App)** (COMPLETED)
  - Web App Manifest (`manifest.webmanifest`) for installability
  - Angular Service Worker for caching static assets
  - iOS PWA meta tags for home screen support
  - App icons (192x192, 512x512 + maskable)
  - CDN preconnect for faster streaming
  - Location: `src/manifest.webmanifest`, `ngsw-config.json`, `src/app/app.config.ts`

- [x] **4. Accessibility (WCAG 2.2 Compliance)** (COMPLETED)
  - ARIA labels on all interactive controls (play/pause, mute, volume slider, rating buttons)
  - Visible focus indicators (`:focus-visible` with 3px primary color outline)
  - Screen reader announcements for track changes via live regions
  - `prefers-reduced-motion` support (disables all transitions/animations)
  - Color contrast compliance (4.5:1 minimum, `--text-subdued` updated to #787878)
  - Skip link for keyboard users
  - No auto-play without user interaction
  - Location: `styles.scss`, `AnnouncerService`, component templates

### Medium Priority - User Engagement

- [ ] **5. Audio Visualization** (BLOCKED - CORS)
  - Spectrum analyzer/equalizer bars reacting to music
  - Use Web Audio API `AnalyserNode`
  - Canvas-based rendering for performance
  - Note: Requires CORS headers on CloudFront HLS stream for Web Audio API to access frequency data
  - Location: New `AudioVisualizerComponent`

- [x] **6. Social Sharing** (COMPLETED)
  - Share current track to Twitter/X, Facebook
  - Copy shareable link to clipboard
  - Native Web Share API on mobile devices
  - Open Graph meta tags for rich previews
  - Location: `ShareService`, `ShareButton` component, `index.html` meta tags

- [x] **7. User Preferences Persistence** (COMPLETED)
  - Remember volume level across sessions
  - Mute state persistence
  - Store in `localStorage`
  - Location: `PreferencesService`, integrations in `HlsPlayerService` and `KeyboardShortcutService`

- [x] **8. Track Change Notifications** (COMPLETED)
  - Browser Notification API for track changes when app is backgrounded
  - Request permission UI in sidebar
  - Toggle to enable/disable notifications
  - Notification click returns focus to app
  - Preference persisted in localStorage
  - Location: `NotificationService`, `NotificationToggle` component, `Sidebar`

### Lower Priority - Polish & Extras

- [x] **9. Sleep Timer** (COMPLETED)
  - Auto-stop after 15/30/60/90 minutes
  - Visual countdown indicator in player bar
  - Dropdown menu to select duration
  - Cancel option when timer is active
  - Available on both desktop and mobile
  - Location: `SleepTimerService`, `SleepTimerButton` component, integrated in `PlayerBar`

- [x] **10. Listening Statistics** (COMPLETED)
  - Track total listening time while playing
  - Display "You've listened for X hours/minutes"
  - Persisted to `localStorage` (saves every 10 seconds)
  - Automatic tracking starts/stops with playback
  - Location: `StatsService`, `ListeningStats` component in sidebar

- [x] **11. Theme Customization** (COMPLETED)
  - Dark/light mode toggle with persisted preference
  - CSS custom properties switching via `data-theme` attribute
  - Light theme with proper contrast ratios
  - Theme toggle in sidebar (desktop) and now-playing-hero (mobile)
  - Location: `ThemeService`, `ThemeToggle` component, `styles.scss`

- [x] **12. Stream Quality Indicator** (COMPLETED)
  - Show buffer health status
  - Display current bitrate
  - Connection quality badge (good/fair/poor)
  - Desktop-only display (hidden on mobile for space)
  - Location: `HlsPlayerService` (buffer, bitrate, latency signals), `StreamQualityComponent` in `PlayerBar`

### Technical/Production Readiness

- [x] **13. Error Monitoring** (COMPLETED)
  - Centralized error tracking with severity levels (info/warning/error/fatal)
  - HLS error tracking with recovery attempt monitoring
  - Media and network error tracking
  - Global Angular ErrorHandler for unhandled exceptions
  - **PostgreSQL persistence** via `POST /api/errors` endpoint
  - Session ID tracking to group errors from same user session
  - Database table: `error_logs` with indexes on created_at, session_id, severity
  - Location: `ErrorMonitoringService`, `GlobalErrorHandler` in `app.config.ts`, `server.js`, `db/init.sql`

- [ ] **14. Performance Optimizations**
  - Lazy load non-critical components
  - Image optimization (WebP with fallback)
  - Preconnect to CDN endpoints
  - Location: `angular.json`, component lazy loading

- [ ] **15. SEO & Open Graph**
  - Dynamic meta tags for current track
  - Structured data (JSON-LD) for rich search results
  - Location: `index.html`, dynamic updates in `AppComponent`
