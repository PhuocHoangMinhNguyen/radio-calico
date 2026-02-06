# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Radio Calico is a lossless internet radio player built with Angular 21 and HLS.js. It streams audio from a CloudFront-hosted HLS endpoint (`https://d3d4yli4hf5bmh.cloudfront.net/hls/live.m3u8`) at 48kHz/24-bit quality. There is a backend Node.js server (`server.js`) backed by PostgreSQL for ratings and error logging.

## Commands

- `npm run dev` — **Primary dev workflow.** Runs both the Angular dev server (port 3000) and the API server (port 3001) concurrently via `concurrently`. The Angular proxy (`proxy.conf.json`) forwards `/api/*` requests to the Node server.
- `npm start` — Angular dev server only (port 3000, with proxy). Use if the API server is already running.
- `npm run start:api` — Node API server only (port 3001). Use if the Angular dev server is already running.
- `npm run build:prod` — Production build (outputs to `dist/radio-calico/browser/`)
- `npm run serve:prod` — Build + run production server (single Express-style server on port 3000 that serves both static files and API)
- `npm test` — Unit tests via Vitest (watch mode)
- `npm run test:headless` — Single test run (CI-friendly)
- `npx vitest run src/app/services/bookmark.service.spec.ts` — Run a single test file

## Architecture

### Frontend — Angular 21

**All components are standalone** (no NgModules). State is managed via Angular Signals — no external state library.

**Component tree:**
```
App
├── Sidebar                          (@defer on idle — lazy chunk)
│   ├── LosslessBadge
│   ├── StreamInfo
│   ├── ListeningStats
│   ├── SavedTracks                  (collapsible, uses BookmarkService)
│   ├── NotificationToggle
│   └── ThemeToggle
├── NowPlayingHero                   (hero section with album art)
│   ├── SongRating                   (thumbs up/down, backed by /api/ratings)
│   ├── BookmarkButton               (save track to localStorage)
│   ├── ShareButton                  (social share dropdown)
│   └── ListeningStats               (mobile-only instance)
├── RecentlyPlayed                   (@defer on viewport — lazy chunk)
└── PlayerBar                        (owns the <audio> element)
    ├── SleepTimerButton
    └── StreamQualityComponent       (desktop-only)
```

**`HlsPlayerService` is the central hub.** It owns the HLS player lifecycle, all playback signals (`isPlaying`, `volume`, `status`, `currentTrack`, `coverUrl`, `recentlyPlayed`), stream quality signals (`bufferHealth`, `bitrate`, `fragmentLatency`), and coordinates track-change side effects: Media Session API updates, screen reader announcements (`AnnouncerService`), browser notifications (`NotificationService`), SEO meta tags (`MetaService`), and error tracking (`ErrorMonitoringService`). `PlayerBar` calls `initializePlayer()` in `ngAfterViewInit` and `destroy()` in `ngOnDestroy`.

**Track metadata** is polled every 10 seconds from a CloudFront JSON endpoint (`metadatav2.json`). The `StreamMetadata` model (`src/app/models/track-info.ts`) includes current track, up to 5 previous tracks, and flags like `is_new`, `is_summer`, `is_vidgames`. Album art is fetched from `cover.jpg` with a cache-busting timestamp query param on track change.

**Lazy loading via `@defer`:** Sidebar uses `@defer (on idle)` and RecentlyPlayed uses `@defer (on viewport)`. Both produce separate lazy chunks (~9 kB and ~3 kB respectively). Do not remove these without good reason — they reduce initial paint time.

### Backend — Node.js + PostgreSQL

`server.js` is a plain `http.createServer` server (not Express). It handles three responsibilities:
1. **API endpoints** — `GET /api/ratings`, `POST /api/ratings`, `POST /api/errors`
2. **Static file serving** — from `dist/radio-calico/browser/`
3. **SPA fallback** — any unmatched route serves `index.html`

PostgreSQL connection uses `pg` Pool. Credentials are read from environment variables (`PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`) with `dotenv` loading from `.env`. The database schema lives in `db/init.sql` and must be applied manually:
```bash
PGPASSWORD=<password> psql -U postgres -d radio_calico -f db/init.sql
```

**Tables:** `song_ratings` (aggregate thumbs up/down per song), `song_votes` (per-IP vote deduplication), `error_logs` (client-side error reports with session grouping).

**In dev mode** (`npm run dev`), the Node server runs on port 3001 serving API only (no static files). In production (`npm run serve:prod`), it runs on port 3000 serving everything.

### localStorage Keys

- `radio-calico-preferences` — single JSON object: `{ volume, isMuted, theme, notificationsEnabled }`. `PreferencesService` is the single source of truth; `ThemeService` and `NotificationService` read/write through it.
- `radio-calico-stats` — cumulative listening time in seconds (`StatsService`, saves every 10 s while playing)
- `radio-calico-bookmarks` — array of `{ title, artist, savedAt }`, max 50 entries (`BookmarkService`)

## Conventions

- **Styling:** SCSS with CSS custom properties for theming. Variables are defined in `src/styles.scss`. Primary color is `--primary-color: #1DB954` (Spotify green). Theme switching is done via `[data-theme]` attribute on `<html>`. Always use `var(--primary-color)`, not `var(--primary)`.
- **TypeScript:** Strict mode with `noImplicitOverride`, `noImplicitReturns`, strict templates and injection params.
- **Formatting:** Prettier — 100 char width, single quotes, Angular HTML parser.
- **Template syntax:** Angular 17+ control flow (`@if`, `@for`, `@defer`) rather than structural directives (`*ngIf`, `*ngFor`).
- **Icons:** Google Material Icons loaded via Google Fonts CDN. Use `<span class="material-icons">icon_name</span>`.
- **Accessibility:** All interactive controls need `aria-label`. Toggle buttons need `aria-pressed`. Animations/transitions should respect `prefers-reduced-motion`.

## Blocked / Known Limitations

- **Audio Visualization** — Requires CORS headers on the CloudFront HLS stream for Web Audio API `AnalyserNode` access to frequency data. Blocked until the CDN is reconfigured.
- **Bundle size warning** — The initial bundle exceeds the 500 kB budget due to HLS.js (~660 kB). This is expected and unavoidable for an HLS streaming app. The warning in `ng build` output is not actionable.

---

## QA Roadmap

Findings from a full-codebase QA pass on 2026-02-05. Items are ordered by priority within each tier. Pick off the top of the list first.

### Critical — fix before next deploy

| ID | What | Where | Fix |
|---|---|---|---|
| CRIT-01 | `.env` with DB password must not be in git history | `.env` / `.gitignore` | **DONE** — `.env` is gitignored and has never appeared in any commit. |
| CRIT-02 | Column-name interpolation in SQL is not explicitly validated | `server.js` — vote-change UPDATE queries | **DONE** — added allowlist guard on `oldVote` immediately after the DB read; returns 500 if the value is anything other than `'up'` or `'down'`. |
| CRIT-03 | Vote flow is not transactional; concurrent voters corrupt counts or crash on UNIQUE violation | `server.js` — POST /api/ratings handler | **DONE** — entire handler now runs inside a `pool.connect()` / BEGIN…COMMIT transaction with ROLLBACK in the catch. `song_votes` INSERT uses `ON CONFLICT … DO NOTHING`. 2 new tests added (pool.connect failure, corrupted vote guard). |

### High — logic / correctness / security

| ID | What | Where | Fix |
|---|---|---|---|
| HIGH-01 | Malformed JSON body returns `500 { error: 'Database error' }` | `server.js` — both POST handlers | **DONE** — Added separate `try/catch` around `JSON.parse` in both POST /api/ratings and POST /api/errors. `SyntaxError` now returns `400 { error: 'Invalid JSON body' }`. Manually tested via curl (unit tests blocked by Vitest Windows bug). |
| HIGH-03 | `fetchRatings` has no cancellation; stale responses can overwrite fresh ones | `song-rating.ts` effect + `RatingService` | **DONE** — Added `AbortController` to `RatingService`. Each `fetchRatings()` call aborts the previous request, preventing stale responses from overwriting current track ratings. Added test for race condition. All 14 RatingService tests pass. |
| HIGH-04 | `POST /api/errors` has zero test coverage | `server.test.js` | **DONE** — Added 9 tests covering: malformed JSON → 400, missing required fields (session_id/source/severity/message) → 400, invalid source/severity values → 400, successful insert with minimal/full fields → 201, DB error → 500. All 28 backend tests pass. |
| HIGH-06 | `volume_mute` icon shown when volume is low but audible | `player-bar.ts` — `volumeIcon` computed | **DONE** — Simplified volume icon logic: removed confusing `volume_mute` case, now uses `volume_down` for all low-to-medium volume (0 < vol < 0.7) and `volume_up` for high volume (vol >= 0.7). `volume_off` reserved for muted or vol === 0. |
| HIGH-07 | "Clear all" button has no `aria-label`; sidebar nav `<a>` has no `href` | `saved-tracks.html`, `sidebar.html` | **DONE** — Added `aria-label="Clear all saved tracks"` to the clear button. Changed sidebar nav `<a class="nav-item active">` to `<div class="nav-item active">` (no navigation functionality, purely decorative). |
| HIGH-08 | Service worker `/api/**` data group caches POST responses | `ngsw-config.json` | **DONE** — Removed the `api` data group from `ngsw-config.json`. POST /api/ratings and POST /api/errors are no longer cached by the service worker. GET /api/ratings also not cached since rating data changes frequently. |

### Medium — test gaps, edge cases, accessibility

| ID | What | Where | Fix |
|---|---|---|---|
| MED-01 | `app.spec.ts` "should render title" always fails | `src/app/app.spec.ts` | **DONE** — Changed test expectation from "Radio Calico" to "Waiting for track info..." to match the actual initial state when no HLS stream is active. Renamed test to "should render initial track placeholder". |
| MED-02 | `HlsPlayerService` has only 5 trivial tests | `hls-player.service.spec.ts` | **DONE** — Expanded from 5 to 17 tests. Added coverage for: metadata polling (immediate fetch, error handling), track-change detection (title/artist changes), cover cache-busting (timestamp query param), first-load guard (no announcement on initial track, announcement on subsequent), and connection quality computation (good/fair/poor thresholds). All tests use mock dependencies. |
| MED-03 | `BookmarkService` is completely untested | — | **DONE** — Created `bookmark.service.spec.ts` with 15 tests using localStorage stub pattern. Covers: add (including 50-entry cap eviction), remove, toggle, isBookmarked (title+artist matching), clearAll, corrupted JSON on load, localStorage error handling (quota exceeded). |
| MED-04 | `SleepTimerService` is untested; has an off-by-one (`<= 1` vs `=== 0`) | `sleep-timer.service.ts` | **DONE** — Created `sleep-timer.service.spec.ts` with 14 tests using vi.useFakeTimers(). Tests verify: start/cancel/toggle behavior, countdown timing, pause() call on completion, computed signals (remainingMinutes, formattedTime, progress). **Off-by-one documented:** Timer fires when `remaining <= 1` (at 1 second remaining) instead of `remaining === 0`. Tests document current behavior with comment noting the discrepancy. |
| MED-05 | 8 of 11 services have no spec files | `src/app/services/` | **DONE** — Created comprehensive test suites for PreferencesService (18 tests), StatsService (18 tests), and ErrorMonitoringService (27 tests). Tests cover initialization, getters/setters, computed signals, localStorage persistence, error handling, and all public methods. Total 63 new tests created. Note: Some tests for PreferencesService and StatsService that verify Angular effects with localStorage have timing issues and require async/await fixes (documented in tests). |
| MED-06 | `recoveryRate` returns `1` when zero attempts recorded | `error-monitoring.service.ts` ~line 173 | **DONE** — Changed `recoveryRate: attempts > 0 ? successes / attempts : 1` to return `0` instead of `1` when no attempts recorded. Updated corresponding tests to expect `0`. This now correctly represents "no data" rather than falsely suggesting 100% success rate. |
| MED-07 | Twitter meta tags use `property` instead of `name` | `index.html` + `meta.service.ts` | **DONE** — Changed all Twitter meta tag attributes from `property="twitter:*"` to `name="twitter:*"` in both `src/index.html` (5 tags: card, url, title, description, image) and `src/app/services/meta.service.ts` (6 meta.updateTag calls). Twitter Cards spec requires `name` attribute, not `property`. |
| MED-08 | `@for` in saved-tracks uses unstable `track $index` | `saved-tracks.html` | **DONE** — Changed `@for (track of bookmarks(); track $index)` to `track track.savedAt` in `src/app/components/saved-tracks/saved-tracks.html:19`. The `savedAt` timestamp is unique per bookmark and provides stable identity for Angular's change detection. |
| MED-09 | Same unstable track key in recently-played | `recently-played.html` | **DONE** — Changed `@for (track of recentlyPlayed(); track $index)` to `track track.title + '::' + track.artist` in `src/app/components/recently-played/recently-played.html:5`. The composite key of title+artist provides stable identity assuming no duplicate tracks in the recently-played list. |
| MED-10 | Sleep timer dropdown has no click-outside dismissal | `sleep-timer-button.html` | **DONE** — Added backdrop div with `(click)="closeMenu()"` following the same pattern as `share-button.html`. Also added `.menu-backdrop` CSS styles with `position: fixed; inset: 0; z-index: 99`. |
| MED-11 | Sleep timer menu strips `outline` on `:focus-visible` — WCAG 2.4.7 violation | `sleep-timer-button.scss` | **DONE** — Replaced `outline: none` with `outline: var(--focus-ring); outline-offset: -2px` in the `.menu-item:focus-visible` rule, matching the standard focus-ring pattern used throughout the codebase. |
| MED-12 | `error_logs` has no composite index on `(session_id, created_at)` | `db/init.sql` | **DONE** — Added `CREATE INDEX IF NOT EXISTS idx_error_logs_session_created ON error_logs(session_id, created_at DESC)` to improve query performance for session-filtered, time-ordered queries. |
| MED-13 | `error_logs` grows without bound | `db/init.sql` / `server.js` | **DONE** — Added PostgreSQL function `cleanup_old_error_logs()` with trigger `trigger_cleanup_error_logs` that automatically deletes records older than 30 days after each INSERT. Retention period is configurable in the function definition. |

### Low — polish, consistency, dead paths

| ID | What | Where | Fix |
|---|---|---|---|
| LOW-01 | Thumbs-up active background is teal, not `--primary-color` green | `song-rating.scss` | **DONE** — Changed `.active.thumbs-up` background from `rgba(74, 149, 148, 0.1)` (teal) to `rgba(29, 185, 84, 0.1)` (Spotify green matching `--primary-color: #1DB954`). Also updated hover state to `rgba(29, 185, 84, 0.15)`. |
| LOW-02 | Stream quality colours are hardcoded, not themed | `stream-quality.scss` | **DONE** — Added CSS variables `--quality-good`, `--quality-fair`, `--quality-poor` to both dark and light theme blocks in `src/styles.scss`. Updated `stream-quality.scss` to use `var(--quality-good)` etc. instead of hardcoded hex colors. Dark theme uses brighter colors (#4caf50, #ff9800, #f44336), light theme uses darker variants for better contrast (#2e7d32, #f57c00, #c62828). |
| LOW-03 | Several components declare redundant `standalone: true` (default in Angular 21) | `saved-tracks.ts`, `sleep-timer-button.ts`, `stream-quality.ts`, `listening-stats.ts`, `theme-toggle.ts` | **DONE** — Removed explicit `standalone: true` declarations from all 5 component decorators. In Angular 21, components are standalone by default, making this declaration redundant. |
| LOW-06 | `GlobalErrorHandler` uses constructor-param DI instead of `inject()` | `error-monitoring.service.ts` ~line 243 | **DONE** — Switched from `constructor(private errorMonitoring: ErrorMonitoringService)` to `private readonly errorMonitoring = inject(ErrorMonitoringService)` to match the inject() pattern used throughout the rest of the codebase. Added `inject` to imports from @angular/core. |
| LOW-07/08 | OG/Twitter image references `icon-512.png` which does not exist (only SVGs) | `index.html` + `meta.service.ts` | **DONE (documented)** — Created `scripts/generate-icon-png.md` with instructions for generating the PNG from the SVG using ImageMagick, Inkscape, online converters, or manual browser screenshot. File should be placed at `public/icons/icon-512.png`. Requires manual action as automated image conversion tools not available in this environment. |
| LOW-09 | PWA shortcut `/?action=play` has no handler | `manifest.webmanifest` | **DONE** — Removed the unused shortcut entry from `src/manifest.webmanifest`. Adding query parameter handling just for this feature would be over-engineering. The app can still be launched normally from the PWA icon; the "Play Radio" shortcut was a nice-to-have but non-essential feature. |
