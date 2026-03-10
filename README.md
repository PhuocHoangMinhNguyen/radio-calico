# Radio Calico

Lossless internet radio player with Angular 21 and HLS.js. Streams 48kHz/24-bit audio with ratings, bookmarks, and stats.

**Live:** https://radio-calico.onrender.com

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

**Frontend:** Angular 21, HLS.js, TypeScript, SCSS, Vitest  
**Backend:** Node.js 22, PostgreSQL 16  
**DevOps:** Docker, nginx, GitHub Actions, pnpm

## Quick Start

### Docker (Recommended)

```bash
# Development
docker-compose up

# Production  
docker-compose -f docker-compose.prod.yml up -d
# Or: make prod (Linux/macOS) or .\radio-calico.ps1 prod (Windows)
```

Access: http://localhost:3000 (dev) or http://localhost:8080 (prod)

### Local Development

```bash
# Install
pnpm install

# Setup database
createdb radio_calico
psql -U postgres -d radio_calico -f db/init.sql

# Configure .env
cat > .env << 'ENVEOF'
PGHOST=localhost
PGPORT=5432
PGDATABASE=radio_calico
PGUSER=postgres
PGPASSWORD=your_password
ENVEOF

# Run
pnpm dev
```

## Commands

### Development
```bash
pnpm dev              # Angular + API server
pnpm start            # Angular only
pnpm start:api        # API only
```

### Testing
```bash
pnpm test             # Frontend tests (watch)
pnpm test:headless    # Frontend tests (CI)
pnpm test:api         # Backend tests
pnpm test:e2e         # E2E tests (Playwright)
pnpm test:load        # Load tests (k6)
```

### Production
```bash
pnpm build:prod       # Build for production
pnpm serve:prod       # Build + serve
```

### Docker
```bash
make help             # Show all commands (Linux/macOS)
.\radio-calico.ps1    # Show all commands (Windows)
```

## Architecture

**Frontend:** Angular 21 standalone components with Signals. HlsPlayerService manages playback, metadata polling, and stream quality.

**Backend:** Plain Node.js `http.createServer` (no Express). PostgreSQL for ratings (atomic transactions, IP-based deduplication) and error logging (30-day retention).

**Production:** nginx reverse proxy → Node.js API + static files. Multi-stage Docker builds with Alpine Linux.

## Project Structure

```
radio-calico/
├── src/app/
│   ├── components/       # Standalone Angular components
│   ├── services/         # Business logic (Signals-based)
│   └── models/          # TypeScript interfaces
├── server.js            # Backend API (ratings, errors, health)
├── db/                  # PostgreSQL schema and migrations
├── e2e/                 # Playwright E2E tests (27 tests)
├── tests/               # k6 load tests
└── docs/                # Security and deployment guides
```

## Security

- ✅ Rate limiting (100 req/min per IP)
- ✅ Input validation & size limits
- ✅ SQL injection prevention (parameterized queries)
- ✅ Security headers (CSP, X-Frame-Options, etc.)
- ✅ Weekly vulnerability scanning (pnpm audit, Trivy)
- ✅ CodeQL SAST analysis

**Security Guides:** See [docs/](docs/) for SIEM integration, WAF deployment, penetration testing, incident response.

## CI/CD

**GitHub Actions:**
- Build & test on push/PR
- Publish to ghcr.io/phuochoangminhnguyen/radio-calico
- Security scanning (Trivy, pnpm audit, CodeQL)
- E2E and load testing

## Environment Variables

**Required (Production):**
```env
PGHOST=localhost
PGPORT=5432
PGDATABASE=radio_calico
PGUSER=postgres
PGPASSWORD=your_secure_password
NODE_ENV=production
API_ONLY=true  # For Docker backend container
```

**Optional:**
```env
PORT=3000                # Server port
SENTRY_DSN=https://...   # Error monitoring
```

## Keyboard Shortcuts

- **Space** — Play/Pause
- **↑/↓** — Volume ±5%
- **M** — Mute/Unmute
- **L** — Like track

## Browser Support

Chrome 90+, Firefox 88+, Safari 14+, Edge 90+

## Known Limitations

- Audio visualization blocked (CDN CORS headers needed)
- Bundle size warning (HLS.js ~660 KB, expected)

## Contributing

See [CLAUDE.md](CLAUDE.md) for project architecture and conventions.

## License

[Your License]

## Acknowledgments

Built with Angular, HLS.js, PostgreSQL, Docker, and ❤️
