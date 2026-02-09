# Radio Calico

A lossless internet radio player built with Angular 21 and HLS.js. Streams high-quality audio (48kHz/24-bit) with real-time track metadata, ratings, bookmarks, and listening statistics.

![Build Status](https://github.com/PhuocHoangMinhNguyen/radio-calico/workflows/Docker%20Build%20and%20Push/badge.svg)

## Features

- 🎵 **Lossless HLS Streaming** — 48kHz/24-bit audio via HLS.js
- 📊 **Track Ratings** — Thumbs up/down system with PostgreSQL backend
- 🔖 **Bookmarks** — Save favorite tracks (up to 50)
- 📈 **Listening Stats** — Track cumulative listening time
- 🎨 **Light/Dark Theme** — Automatic theme switching with system preference support
- ⌨️ **Keyboard Shortcuts** — Space (play/pause), ↑/↓ (volume), M (mute), L (like)
- 🔔 **Browser Notifications** — Desktop notifications for track changes
- 📱 **Responsive Design** — Mobile-first UI with lazy-loaded components
- ♿ **Accessibility** — ARIA labels, keyboard navigation, screen reader support
- 🐳 **Docker Support** — Multi-stage builds for development and production

## Tech Stack

### Frontend
- **Angular 21** (standalone components, Signals-based state management)
- **HLS.js** — Adaptive bitrate streaming
- **TypeScript** (strict mode)
- **SCSS** with CSS custom properties
- **Vitest** — Unit testing

### Backend
- **Node.js 22** (plain `http.createServer`, no Express)
- **PostgreSQL 16** — Ratings and error logging
- **pg** — PostgreSQL client

### DevOps
- **Docker** — Multi-stage builds with Alpine Linux
- **nginx** — Production reverse proxy with security headers and caching
- **GitHub Actions** — CI/CD with automated testing, security scanning, and Docker image publishing
- **npm audit** — Automated vulnerability scanning with weekly scheduled scans
- **GitHub Container Registry** — Docker image hosting
- **Makefile + PowerShell** — Cross-platform management scripts

## Prerequisites

Choose **one** of the following setups:

### Option 1: Docker (Recommended)
- **Docker** 20.10+ and **Docker Compose** 2.0+

### Option 2: Local Development
- **Node.js** ≥22.12 or ≥20.19 (Node 22 recommended)
- **npm** 10+
- **PostgreSQL** 16+ (local or remote)

## Quick Start

### Docker (Recommended for Most Users)

#### Development Mode
```bash
# Start all services (Angular dev server, API server, PostgreSQL)
docker-compose up

# With optional Adminer database UI
docker-compose --profile tools up

# Run in background
docker-compose up -d
```

Access:
- **App**: http://localhost:3000
- **API**: http://localhost:3001/api/ratings
- **Adminer** (if enabled): http://localhost:8080 (Server: `db`, User: `postgres`, Password: `radiocalico_dev_password`)

The development container includes hot-reload for both Angular and Node.js code.

#### Production Mode
```bash
# Build and start production containers (nginx + backend + db)
docker-compose -f docker-compose.prod.yml up -d

# Or using convenience commands
make prod                    # Linux/macOS/WSL/Git Bash
.\radio-calico.ps1 prod      # Windows PowerShell

# View logs
docker-compose -f docker-compose.prod.yml logs -f
make logs                    # Or use Makefile
```

Access: http://localhost:8080 (nginx serves static files, proxies `/api/*` to backend)

### Local Development (Without Docker)

#### 1. Install Dependencies
```bash
npm ci --legacy-peer-deps
```

> **Note**: The `--legacy-peer-deps` flag is required due to an intentional Vitest version mismatch (backend uses 3.x, Angular expects 4.x). This is safe and expected.

#### 2. Set Up PostgreSQL Database

Create a `.env` file in the project root:
```env
PGHOST=localhost
PGPORT=5432
PGDATABASE=radio_calico
PGUSER=postgres
PGPASSWORD=your_password
```

Initialize the database schema:
```bash
# Create database (if not exists)
createdb radio_calico

# Apply schema
PGPASSWORD=your_password psql -U postgres -d radio_calico -f db/init.sql
```

#### 3. Start Development Servers

**Primary workflow** (runs both Angular dev server and API server):
```bash
npm run dev
```

Access:
- **App**: http://localhost:3000
- **API**: http://localhost:3001/api/ratings

**Alternative** (run servers separately in different terminals):
```bash
# Terminal 1: Angular dev server
npm start

# Terminal 2: API server
npm run start:api
```

## Available Commands

### Management Scripts (Recommended)

**Cross-platform scripts for easier workflow:**

```bash
# Linux/macOS/WSL/Git Bash
make help           # Show all available targets
make prod           # Start production (port 8080)
make dev            # Start development servers
make test           # Run all tests
make status         # Show container status
make logs           # View container logs

# Windows PowerShell
.\radio-calico.ps1 help         # Show all commands
.\radio-calico.ps1 prod         # Start production (port 8080)
.\radio-calico.ps1 dev          # Start development
.\radio-calico.ps1 test         # Run all tests
.\radio-calico.ps1 status       # Show container status
.\radio-calico.ps1 logs         # View logs
```

See `make help` or `.\radio-calico.ps1 help` for the full command list.

### Development
- `npm run dev` — **Primary workflow**: Concurrent Angular dev server (port 3000) + API server (port 3001)
- `npm start` — Angular dev server only (port 3000, proxies `/api/*` to port 3001)
- `npm run start:api` — Node.js API server only (port 3001)

### Testing
- `npm test` — Frontend tests (Vitest watch mode)
- `npm run test:headless` — Frontend tests (single run, CI-friendly)
- `npm run test:api` — Backend tests (Vitest 3.x)
- `npx vitest run src/app/services/bookmark.service.spec.ts` — Run single test file

### Production Build
- `npm run build:prod` — Build Angular app (outputs to `dist/radio-calico/browser/`)
- `npm run serve:prod` — Build + run production server (port 3000, serves static files + API)

### Docker
- `docker-compose up` — Start development environment
- `docker-compose -f docker-compose.prod.yml up` — Start production environment
- `docker-compose down` — Stop and remove containers
- `docker-compose logs -f app` — View application logs

## Project Structure

```
radio-calico/
├── src/
│   ├── app/
│   │   ├── components/         # UI components (all standalone)
│   │   │   ├── player-bar/     # Audio player controls
│   │   │   ├── sidebar/        # Lazy-loaded sidebar (@defer on idle)
│   │   │   ├── now-playing-hero/
│   │   │   └── recently-played/ # Lazy-loaded (@defer on viewport)
│   │   ├── services/           # Business logic & state management
│   │   │   ├── hls-player.service.ts  # HLS playback & state hub
│   │   │   ├── bookmark.service.ts
│   │   │   ├── rating.service.ts
│   │   │   ├── preferences.service.ts
│   │   │   └── stats.service.ts
│   │   └── models/             # TypeScript interfaces
│   ├── styles.scss             # Global styles & CSS variables
│   └── index.html
├── server.js                   # Node.js API server (CJS, plain http.createServer)
├── server.test.js              # Backend tests (28 tests)
├── db/
│   └── init.sql                # PostgreSQL schema
├── Dockerfile                  # Multi-stage Docker build
├── Dockerfile.nginx            # nginx frontend web server (production only)
├── nginx.conf                  # nginx configuration (reverse proxy, caching, security headers)
├── docker-compose.yml          # Development environment
├── docker-compose.prod.yml     # Production environment (nginx + backend + db)
├── Makefile                    # Cross-platform management scripts
├── radio-calico.ps1            # PowerShell management script (Windows)
├── .github/
│   └── workflows/
│       ├── docker-build.yml    # CI/CD pipeline with security scanning
│       ├── security-scan.yml   # Scheduled weekly vulnerability scanning
│       ├── claude.yml          # Claude Code integration
│       └── claude-code-review.yml
├── CLAUDE.md                   # Claude Code guidance
└── SECURITY.md                 # Security documentation and vulnerability response

```

## Architecture

### Frontend — Angular 21
All components are standalone (no NgModules). State is managed via Angular Signals — no external state library.

**HlsPlayerService** is the central hub for:
- HLS player lifecycle management
- Playback state (isPlaying, volume, status)
- Track metadata (currentTrack, coverUrl, recentlyPlayed)
- Stream quality metrics (bufferHealth, bitrate, fragmentLatency)
- Side effects: Media Session API, notifications, SEO meta tags, error tracking

**Lazy loading**: Sidebar and RecentlyPlayed use `@defer` for code-splitting (~12 kB total).

### Backend — Node.js + PostgreSQL
`server.js` is a plain `http.createServer` server (not Express):
1. **API endpoints**: `GET /api/ratings`, `POST /api/ratings`, `POST /api/errors`
2. **Static file serving** (when `API_ONLY` is not set): from `dist/radio-calico/browser/`
3. **SPA fallback** (when `API_ONLY` is not set): any unmatched route serves `index.html`

**Database**: Three tables (`song_ratings`, `song_votes`, `error_logs`) managed via `pg` Pool.

**Server modes**:
- **Dev**: API only on port 3001 (Angular dev server handles static files on port 3000)
- **Prod with Docker**: nginx on port 80 serves static files, Node backend on internal port 3001 (API only, `API_ONLY=true`)
- **Prod without Docker**: Single Node server on port 3000 (serves both static files and API)

### Production Architecture (Docker)
```
Client → nginx:80 → backend:3001 (Node.js API)
         ↓
    Static files from /usr/share/nginx/html
```

**nginx features**:
- Serves pre-built Angular static files
- Reverse proxies `/api/*` requests to backend
- Security headers (X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, Referrer-Policy)
- Optimized caching (1 year for assets, no-cache for index.html)
- gzip compression for all text-based content
- Health check endpoint (`/health`)

## Testing

Two independent test configurations:
- **Frontend**: Angular's built-in Vitest 4.x runner (`src/**/*.spec.ts`)
- **Backend**: Standalone Vitest 3.x (`server.test.js`)

> **Note**: Backend uses Vitest 3.x due to a Windows bug with Vitest 4.x and ES modules. This does not affect functionality.

### Running Tests in Docker
```bash
# Backend tests with PostgreSQL service
docker-compose run --rm app npm run test:api

# Frontend tests
docker-compose run --rm app npm run test:headless
```

## Security

Radio Calico includes comprehensive security scanning using `npm audit`:

### Quick Commands
```bash
# Run security checks
npm audit                           # Check all dependencies
npm audit --omit=dev                # Production dependencies only

# Fix vulnerabilities automatically
npm audit fix                       # Fix all fixable vulnerabilities
```

### Automated Security Scanning
- **Every push/PR**: Security job runs npm audit (fails on critical vulnerabilities)
- **Weekly scans**: Every Monday at 9:00 AM UTC via `.github/workflows/security-scan.yml`
- **Automatic alerts**: GitHub issues created for critical/high severity vulnerabilities
- **Security reports**: Uploaded as artifacts with 90-day retention

The workflow uses `npm audit --audit-level=moderate` for scanning and `npm audit --audit-level=critical` as a gate for critical vulnerabilities.

## CI/CD

GitHub Actions workflows run on push/PR:

### Build & Test (`.github/workflows/docker-build.yml`)
1. **Build Job**: Multi-stage Docker builds (development + production)
2. **Security Job** (runs in parallel):
   - npm audit on all dependencies and production-only
   - Generates JSON security report
   - Uploads artifact (30-day retention)
   - **Fails build on critical vulnerabilities**
3. **Test Job**:
   - Spins up PostgreSQL service
   - Runs backend tests (`npm run test:api`)
   - Runs frontend tests (`npm run test:headless`)
4. **Publish**: Pushes images to GitHub Container Registry

### Security Scanning (`.github/workflows/security-scan.yml`)
- **Scheduled**: Every Monday at 9:00 AM UTC
- **Trigger**: Changes to `package.json` or `package-lock.json`
- **Actions**:
  - Comprehensive vulnerability scanning
  - Uploads detailed reports (90-day retention)
  - **Automatically creates GitHub issues** for critical/high vulnerabilities
  - Includes quick fix commands in issue description

Docker images: `ghcr.io/phuochoangminhnguyen/radio-calico:latest`

See [SECURITY.md](SECURITY.md) for vulnerability response procedures.

## Environment Variables

### Required (Production)
```env
PGHOST=localhost           # PostgreSQL host
PGPORT=5432                # PostgreSQL port
PGDATABASE=radio_calico    # Database name
PGUSER=postgres            # Database user
PGPASSWORD=changeme        # Database password (change this!)
```

### Optional
```env
PORT=3000                  # Server port (default: 3000 in prod, 3001 in dev)
NODE_ENV=production        # Node environment
APP_PORT=3000              # Mapped port in docker-compose.prod.yml
```

## Keyboard Shortcuts

Global keyboard shortcuts (disabled when typing in input fields):
- **Space** — Play/Pause
- **↑/↓** — Volume up/down (5% increments)
- **M** — Mute/Unmute
- **L** — Like current track

## Known Limitations

- **Audio Visualization**: Blocked until CloudFront HLS stream is configured with CORS headers for Web Audio API `AnalyserNode` access
- **Bundle Size Warning**: Initial bundle exceeds 500 kB due to HLS.js (~660 kB). This is expected and unavoidable for HLS streaming.

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Opera 76+

Requires browsers with native HLS support or Media Source Extensions (MSE) API.

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Run tests: `npm test` and `npm run test:api`
4. Commit changes (`git commit -m 'Add amazing feature'`)
5. Push to branch (`git push origin feature/amazing-feature`)
6. Open a Pull Request

## License

This project is licensed under the MIT License.

## Acknowledgments

- Built with [Angular CLI](https://angular.dev/tools/cli) 21.1.1
- HLS streaming powered by [HLS.js](https://github.com/video-dev/hls.js/)
- Icons from [Google Material Icons](https://fonts.google.com/icons)
