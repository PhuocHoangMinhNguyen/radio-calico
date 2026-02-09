# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Radio Calico is a lossless internet radio player built with Angular 21 and HLS.js. It streams audio from a CloudFront-hosted HLS endpoint (`https://d3d4yli4hf5bmh.cloudfront.net/hls/live.m3u8`) at 48kHz/24-bit quality. There is a backend Node.js server (`server.js`) backed by PostgreSQL for ratings and error logging.

**Prerequisites:**
- **Node.js** ≥22.12 or ≥20.19 (Node 22 recommended)
- **PostgreSQL** 16+ (or use Docker Compose)
- **Docker** (optional, recommended for development)

## Commands

### Management Scripts (Recommended)

**For ease of use, management scripts are provided:**

**PowerShell (Windows):**
```powershell
.\radio-calico.ps1 help         # Show all available commands
.\radio-calico.ps1 prod         # Start production (port 8080)
.\radio-calico.ps1 dev          # Start development
.\radio-calico.ps1 test         # Run all tests
.\radio-calico.ps1 status       # Show container status
.\radio-calico.ps1 verify-all   # Verify all endpoints work
```

**Makefile (Linux/macOS/WSL/Git Bash):**
```bash
make help           # Show all available targets
make prod           # Start production (port 8080)
make dev            # Start development
make test           # Run all tests
make status         # Show container status
make verify-all     # Verify all endpoints work
```

**Common commands:**
- **Production**: `.\radio-calico.ps1 prod` or `make prod` — Start nginx production environment on port 8080
- **Development**: `.\radio-calico.ps1 dev` or `make dev` — Start Angular dev server + API server
- **Testing**: `.\radio-calico.ps1 test` or `make test` — Run frontend and backend tests
- **Logs**: `.\radio-calico.ps1 logs` or `make logs` — View all container logs
- **Clean**: `.\radio-calico.ps1 clean` or `make clean` — Stop and remove all containers

See `.\radio-calico.ps1 help` or `make help` for full command list.

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

**Core Services:**
- `HlsPlayerService` — HLS lifecycle, playback state, stream quality
- `PreferencesService` — Single source of truth for localStorage preferences
- `BookmarkService` — Saved tracks (max 50 entries)
- `RatingService` — Track ratings with backend sync
- `StatsService` — Cumulative listening time tracking
- `KeyboardShortcutService` — Global keyboard shortcuts
- `ThemeService` — Dark/light theme switching (reads through PreferencesService)
- `NotificationService` — Browser notifications (reads through PreferencesService)
- `SleepTimerService` — Auto-pause timer functionality
- `ShareService` — Social sharing with Web Share API fallback
- `MetaService` — SEO meta tags for current track
- `AnnouncerService` — Screen reader announcements for accessibility
- `ErrorMonitoringService` — Client-side error tracking to backend

**Track metadata** is polled every 10 seconds from a CloudFront JSON endpoint (`metadatav2.json`). The `StreamMetadata` model (`src/app/models/track-info.ts`) includes current track, up to 5 previous tracks, and flags like `is_new`, `is_summer`, `is_vidgames`. Album art is fetched from `cover.jpg` with a cache-busting timestamp query param on track change.

**Lazy loading via `@defer`:** Sidebar uses `@defer (on idle)` and RecentlyPlayed uses `@defer (on viewport)`. Both produce separate lazy chunks (~9 kB and ~3 kB respectively). Do not remove these without good reason — they reduce initial paint time.

### Backend — Node.js + PostgreSQL

`server.js` is a plain `http.createServer` server (not Express). It handles:
1. **API endpoints** — `GET /api/ratings`, `POST /api/ratings`, `POST /api/errors`
2. **Static file serving** (when `API_ONLY` is not set) — from `dist/radio-calico/browser/`
3. **SPA fallback** (when `API_ONLY` is not set) — any unmatched route serves `index.html`

PostgreSQL connection uses `pg` Pool. Credentials are read from environment variables (`PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`) with `dotenv` loading from `.env`. The database schema lives in `db/init.sql` and must be applied manually:
```bash
PGPASSWORD=<password> psql -U postgres -d radio_calico -f db/init.sql
```

**Tables:**
- `song_ratings` — Aggregate thumbs up/down per song (UNIQUE constraint on song_title + song_artist)
- `song_votes` — Per-IP vote deduplication (UNIQUE constraint on song_title + song_artist + ip_address)
- `error_logs` — Client-side error reports with session grouping
  - **Retention policy:** Automatic 30-day deletion via PostgreSQL trigger (`cleanup_old_error_logs`)
  - **Indexes:** `created_at DESC`, `session_id`, `severity`, composite `(session_id, created_at DESC)`
  - **Constraints:** `source` CHECK (hls, network, media, app, unknown), `severity` CHECK (info, warning, error, fatal)
  - **Metadata:** `metadata` column stores JSONB for flexible error context

**Server modes:**
- **Dev mode** (`npm run dev`) — Node server on port 3001, API only (Angular dev server handles static files on port 3000)
- **Production with Docker** (`docker-compose -f docker-compose.prod.yml up`) — nginx on port 80 serving static files, Node backend on internal port 3001 (API only, `API_ONLY=true`)
- **Production without Docker** (`npm run serve:prod`) — Single Node server on port 3000 serving both static files and API

## Progressive Web App (PWA)

The app is installable as a PWA with offline support via Angular Service Worker (production builds only).

**Service Worker caching strategies:**
- **App shell** — Prefetched on install (index.html, CSS, JS, favicon, manifest)
- **Assets** — Lazy-loaded icons and SVGs
- **Metadata** — `metadatav2.json` cached with freshness strategy (10s max age, 5s timeout)
- **Cover art** — `cover.jpg` cached with freshness strategy (1h max age, 3s timeout, stores up to 5 recent covers)

**Configuration files:**
- `ngsw-config.json` — Service Worker configuration
- `src/manifest.webmanifest` — PWA manifest (theme colors, icons, display mode)

**Important:** Service Worker is only enabled in production builds (`npm run build:prod`). Development builds do not include the service worker.

## nginx Configuration (Production Docker Only)

In Docker production deployments, nginx acts as the frontend web server and reverse proxy.

**Architecture:**
```
Client → nginx:80 → backend:3001 (Node.js API)
         ↓
    Static files from /usr/share/nginx/html
```

**Key features (`nginx.conf`):**
- **Static file serving** — Serves Angular SPA from `/usr/share/nginx/html`
- **API reverse proxy** — `/api/*` requests proxied to `http://backend:3001`
- **SPA routing** — `try_files $uri $uri/ /index.html` for client-side routing
- **Caching strategy:**
  - Static assets (JS, CSS, images): 1 year with immutable cache
  - `index.html`: no caching (`no-store`)
  - Service Worker files: no caching
  - `manifest.webmanifest`: 1 hour cache
- **Security headers:**
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `X-XSS-Protection: 1; mode=block`
  - `Referrer-Policy: strict-origin-when-cross-origin`
- **Compression:** gzip enabled for text/JS/CSS/JSON/SVG (level 6)
- **IP forwarding:** Sets `X-Forwarded-For` header for backend IP tracking (used by rating system)

**Health check endpoint:** `GET /health` returns `200 OK` for container health monitoring.

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

### Dockerfile Stages (Dockerfile)
1. **base** — Node 22 Alpine with dependencies installed (`npm ci --legacy-peer-deps`)
2. **development** — Full source with hot-reload support, exposes ports 3000 (Angular) and 3001 (API)
3. **builder** — Production build of Angular app (`npm run build:prod`)
4. **production** — Minimal runtime with only prod dependencies, non-root user, API server on port 3001

### nginx Dockerfile (Dockerfile.nginx)
- Uses official nginx:alpine image
- Copies built Angular files from `builder` stage
- Copies custom `nginx.conf` for SPA routing and API proxying
- Runs as non-root user
- Exposes port 80

### docker-compose.yml (Development)
- **app** service: Angular dev server + API server with volume mounts for hot-reload
- **db** service: PostgreSQL 16 with auto-initialization from `db/init.sql`
- **adminer** service (optional, `--profile tools`): Database management UI on port 8080
- Networking: All services on `radio_calico_network_dev` bridge network

### docker-compose.prod.yml (Production)
- **nginx** service: Serves Angular static files and reverse proxies `/api/*` to backend
  - Built from `Dockerfile.nginx`
  - Exposes port 80 (configurable via `NGINX_PORT` env var)
  - Resource limits: 128M memory, 0.5 CPU
  - Health check on `/health` endpoint
- **backend** service: Node.js API server (internal only, no exposed ports)
  - Built from `Dockerfile` (production target)
  - Runs on internal port 3001 with `API_ONLY=true`
  - Resource limits: 512M memory, 1.0 CPU
  - Health check on API endpoint
- **db** service: PostgreSQL with tighter resource limits, no exposed port (internal only)
- All services run as non-root users with security hardening

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
  - **Bundle budgets** (configured in `angular.json`):
    - Initial bundle: 500 kB warning threshold, 1 MB error threshold
    - Component styles: 4 kB warning, 8 kB error
