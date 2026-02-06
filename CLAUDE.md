# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Radio Calico is a lossless internet radio player built with Angular 21 and HLS.js. It streams audio from a CloudFront-hosted HLS endpoint (`https://d3d4yli4hf5bmh.cloudfront.net/hls/live.m3u8`) at 48kHz/24-bit quality. There is a backend Node.js server (`server.js`) backed by PostgreSQL for ratings and error logging.

**Prerequisites:**
- **Node.js** ≥22.12 or ≥20.19 (Node 22 recommended)
- **PostgreSQL** 16+ (or use Docker Compose)
- **Docker** (optional, recommended for development)

## Commands

### npm Commands (Local Development)
- `npm run dev` — **Primary dev workflow.** Runs both the Angular dev server (port 3000) and the API server (port 3001) concurrently via `concurrently`. The Angular proxy (`proxy.conf.json`) forwards `/api/*` requests to the Node server.
- `npm start` — Angular dev server only (port 3000, with proxy). Use if the API server is already running.
- `npm run start:api` — Node API server only (port 3001). Use if the Angular dev server is already running.
- `npm run build:prod` — Production build (outputs to `dist/radio-calico/browser/`)
- `npm run serve:prod` — Build + run production server (single server on port 3000 that serves both static files and API)
- `npm test` — Frontend unit tests via Vitest (watch mode)
- `npm run test:headless` — Frontend tests, single run (CI-friendly)
- `npm run test:api` — Backend tests only (runs server.test.js via Vitest 3.x)
- `npx vitest run src/app/services/bookmark.service.spec.ts` — Run a single test file

### Docker Commands
- `docker-compose up` — Start development environment (Angular dev server, API server, PostgreSQL)
- `docker-compose --profile tools up` — Start dev environment with Adminer database UI (http://localhost:8080)
- `docker-compose -f docker-compose.prod.yml up` — Start production environment (optimized build)
- `docker-compose down` — Stop and remove containers
- `docker-compose run --rm app npm run test:api` — Run backend tests in Docker
- `docker-compose run --rm app npm run test:headless` — Run frontend tests in Docker

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

## Testing

Two separate test configurations:
- **Frontend tests** — `npm test` or `npm run test:headless` — Angular's built-in Vitest runner for `src/**/*.spec.ts`
- **Backend tests** — `npm run test:api` — Standalone Vitest 3.x for `server.test.js`

**Important:** Backend uses Vitest 3.x (pinned in package.json) due to a Vitest 4.x Windows bug with ES modules. Frontend uses Angular's bundled Vitest (4.x). The two test runners are completely independent.

**Testing patterns:**
- Frontend tests must stub `localStorage` using `vi.stubGlobal('localStorage', inMemoryMock)` at module top level. Node 25's built-in localStorage is broken in test environments.
- Backend tests patch `pool.query` directly in `beforeAll`. Vitest's `vi.mock` does not intercept CJS `require()` calls.

## Docker Setup

The project uses multi-stage Docker builds with Alpine Linux for minimal image sizes.

### Dockerfile Stages
1. **base** — Node 22 Alpine with dependencies installed (`npm ci --legacy-peer-deps`)
2. **development** — Full source with hot-reload support, exposes ports 3000 (Angular) and 3001 (API)
3. **builder** — Production build of Angular app (`npm run build:prod`)
4. **production** — Minimal runtime with only prod dependencies, non-root user, serves everything on port 3000

### docker-compose.yml (Development)
- **app** service: Angular dev server + API server with volume mounts for hot-reload
- **db** service: PostgreSQL 16 with auto-initialization from `db/init.sql`
- **adminer** service (optional, `--profile tools`): Database management UI on port 8080
- Networking: All services on `radio_calico_network_dev` bridge network

### docker-compose.prod.yml (Production)
- **app** service: Production build with resource limits, read-only filesystem, security hardening
- **db** service: PostgreSQL with tighter resource limits, no exposed port (internal only)
- Health checks on both services
- Non-root user (`nodejs`) for security

**Important Docker notes:**
- The Dockerfile includes `--legacy-peer-deps` flag for `npm ci` to handle the intentional Vitest version mismatch
- Development volumes exclude `node_modules` and `.angular` directories to prevent host/container conflicts
- Production image uses `--omit=dev` to exclude dev dependencies

## CI/CD

GitHub Actions workflow (`.github/workflows/docker-build.yml`) runs on push/PR to `master` branch:

### Build Job
1. Checkout code
2. Set up Docker Buildx for multi-platform builds
3. Log in to GitHub Container Registry (ghcr.io)
4. Extract Docker metadata (tags, labels)
5. Build and push production image (`target: production`)
6. Build development image for verification (`target: development`, push: false)
7. Uses GitHub Actions cache for layer caching

### Test Job (depends on build)
1. Start PostgreSQL 16 service container
2. Set up Node.js 22
3. Install dependencies (`npm ci --legacy-peer-deps`)
4. Initialize test database from `db/init.sql`
5. Run backend tests (`npm run test:api`)
6. Run frontend tests (`npm run test:headless`)

**Images are published to:** `ghcr.io/phuochoangminhnguyen/radio-calico:latest`

**Other workflows:**
- `.github/workflows/claude.yml` — Claude Code integration for `@claude` mentions in issues/PRs
- `.github/workflows/claude-code-review.yml` — Automatic code review on PR creation

**Important CI/CD notes:**
- Node.js version in CI **must** be ≥22.12 or ≥20.19 to satisfy Angular 21 requirements
- `npm ci` requires `--legacy-peer-deps` flag due to Vitest version mismatch
- PostgreSQL service uses health checks to ensure database is ready before tests run

## Conventions

- **Styling:** SCSS with CSS custom properties for theming. Variables are defined in `src/styles.scss`. Primary color is `--primary-color: #1DB954` (Spotify green). Theme switching is done via `[data-theme]` attribute on `<html>`. Always use `var(--primary-color)`, not `var(--primary)`.
- **TypeScript:** Strict mode with `noImplicitOverride`, `noImplicitReturns`, strict templates and injection params.
- **Formatting:** Prettier — 100 char width, single quotes, Angular HTML parser.
- **Template syntax:** Angular 17+ control flow (`@if`, `@for`, `@defer`) rather than structural directives (`*ngIf`, `*ngFor`).
- **Icons:** Google Material Icons loaded via Google Fonts CDN. Use `<span class="material-icons">icon_name</span>`.
- **Accessibility:** All interactive controls need `aria-label`. Toggle buttons need `aria-pressed`. Animations/transitions should respect `prefers-reduced-motion`.

## Keyboard Shortcuts

Global keyboard shortcuts (disabled when typing in input fields):
- **Space** — Play/Pause
- **↑/↓** — Volume up/down (5% increments)
- **M** — Mute/Unmute
- **L** — Like current track

Implemented in `KeyboardShortcutService`, registered in `App` component.

## Blocked / Known Limitations

- **Audio Visualization** — Requires CORS headers on the CloudFront HLS stream for Web Audio API `AnalyserNode` access to frequency data. Blocked until the CDN is reconfigured.
- **Bundle size warning** — The initial bundle exceeds the 500 kB budget due to HLS.js (~660 kB). This is expected and unavoidable for an HLS streaming app. The warning in `ng build` output is not actionable.
