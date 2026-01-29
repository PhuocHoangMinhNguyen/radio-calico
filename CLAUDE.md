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
