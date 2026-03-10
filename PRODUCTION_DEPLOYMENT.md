# Production Deployment Guide

Deploy Radio Calico for free using Render.com (hosting) and Neon (PostgreSQL). No credit card required.

## Table of Contents
- [Overview](#overview)
- [How It Works](#how-it-works)
- [Step 1: Set Up Neon PostgreSQL](#step-1-set-up-neon-postgresql)
- [Step 2: Initialize the Database Schema](#step-2-initialize-the-database-schema)
- [Step 3: Deploy to Render.com](#step-3-deploy-to-rendercom)
- [Step 4: Configure Environment Variables](#step-4-configure-environment-variables)
- [Step 5: Post-Deployment Verification](#step-5-post-deployment-verification)
- [Updating the App](#updating-the-app)
- [Monitoring](#monitoring)
- [Troubleshooting](#troubleshooting)
- [Free Tier Limitations](#free-tier-limitations)

## Overview

**Stack:**
- **Render.com** — Hosts the Node.js server (serves both the Angular SPA and API)
- **Neon** — Managed PostgreSQL database (free tier, no expiry)
- **CloudFront** — HLS audio stream (already hosted, no setup needed)

**Cost:** $0/month

**Your URL:** `https://your-app-name.onrender.com` (free subdomain, HTTPS included)

**Estimated Setup Time:** 20–30 minutes

## How It Works

The production Docker image bundles both the Angular frontend and the Node.js API into a single container. Render runs it as a persistent process on a free web service. Neon provides the PostgreSQL database over a secure external connection.

```
Browser → https://your-app.onrender.com
             ↓
         Render (Node.js server)
         ├── GET /          → serves Angular SPA (static files)
         ├── GET /api/*     → handles API requests
         └── POST /api/*    → reads/writes to Neon PostgreSQL
```

Audio streams directly from CloudFront — the Render server is not involved in audio delivery.

## Step 1: Set Up Neon PostgreSQL

1. Go to [neon.tech](https://neon.tech) and sign up (free, no credit card)
2. Click **New Project**
3. Give it a name (e.g., `radio-calico`) and select the region closest to your audience
4. Once created, go to the **Connection Details** panel and note down:
   - **Host** (e.g., `ep-cool-name-123456.us-east-2.aws.neon.tech`)
   - **Database** (e.g., `neondb`)
   - **Username**
   - **Password**
   - **Port** (`5432`)

## Step 2: Initialize the Database Schema

1. In the Neon dashboard, open the **SQL Editor** tab
2. Paste and run the following SQL:

```sql
CREATE TABLE IF NOT EXISTS song_ratings (
  id SERIAL PRIMARY KEY,
  song_title TEXT NOT NULL,
  song_artist TEXT NOT NULL,
  thumbs_up INT NOT NULL DEFAULT 0,
  thumbs_down INT NOT NULL DEFAULT 0,
  UNIQUE(song_title, song_artist)
);

CREATE TABLE IF NOT EXISTS song_votes (
  id SERIAL PRIMARY KEY,
  song_title TEXT NOT NULL,
  song_artist TEXT NOT NULL,
  ip_address TEXT NOT NULL,
  vote TEXT NOT NULL CHECK (vote IN ('up', 'down')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(song_title, song_artist, ip_address)
);

CREATE TABLE IF NOT EXISTS error_logs (
  id SERIAL PRIMARY KEY,
  session_id TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('hls', 'network', 'media', 'app', 'unknown')),
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'error', 'fatal')),
  message TEXT NOT NULL,
  details TEXT,
  metadata JSONB,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_error_logs_created_at ON error_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_session_id ON error_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_error_logs_severity ON error_logs(severity);
CREATE INDEX IF NOT EXISTS idx_error_logs_session_created ON error_logs(session_id, created_at DESC);
```

3. Click **Run** — you should see `Success` for each statement

## Step 3: Deploy to Render.com

1. Go to [render.com](https://render.com) and sign up (free, use GitHub login)
2. Click **New → Web Service**
3. Connect your GitHub repository (`radio-calico`)
4. Configure the service:

| Setting | Value |
|---|---|
| **Name** | `radio-calico` (or any name you like) |
| **Region** | Choose closest to your audience |
| **Branch** | `master` |
| **Runtime** | **Docker** |
| **Dockerfile Path** | `./Dockerfile` |
| **Docker Build Target** | `production` |
| **Instance Type** | **Free** |

5. Click **Create Web Service** (environment variables come next)

## Step 4: Configure Environment Variables

In the Render dashboard for your service, go to **Environment** and add the following variables:

| Key | Value |
|---|---|
| `PGHOST` | Your Neon host (e.g., `ep-cool-name-123456.us-east-2.aws.neon.tech`) |
| `PGPORT` | `5432` |
| `PGDATABASE` | Your Neon database name (e.g., `neondb`) |
| `PGUSER` | Your Neon username |
| `PGPASSWORD` | Your Neon password |
| `PGSSLMODE` | `require` |
| `NODE_ENV` | `production` |
| `API_ONLY` | `false` |

> **`PORT` is not needed** — Render injects it automatically, and `server.js` already reads it from the environment.

> **`PGSSLMODE=require`** is required because Neon enforces SSL on all connections.

After saving, Render will trigger a new deploy. Watch the build logs — it takes 3–5 minutes the first time.

## Step 5: Post-Deployment Verification

Once the deploy shows **Live**, open your `https://your-app.onrender.com` URL and check:

- [ ] Site loads without errors
- [ ] HLS stream plays audio
- [ ] Track metadata and album art display
- [ ] Volume controls and keyboard shortcuts work (Space, ↑/↓, M, L)
- [ ] Theme toggle works (light/dark)
- [ ] Rating system works (thumbs up/down)
- [ ] Bookmark feature works
- [ ] Mobile responsive design works
- [ ] PWA installation prompt appears

**Verify the API and database:**

```bash
# Replace with your actual Render URL
curl https://your-app.onrender.com/api/health
# Expected: {"status":"healthy","database":"connected","timestamp":"..."}
```

## Updating the App

Render auto-deploys on every push to `master`. To update:

```bash
git add .
git commit -m "your changes"
git push origin master
```

Render will detect the push, rebuild the Docker image, and deploy — typically 3–5 minutes. Zero downtime during deploy.

## Monitoring

**Uptime monitoring (free):**

1. Sign up at [uptimerobot.com](https://uptimerobot.com) (free, 50 monitors)
2. Add two monitors:
   - `https://your-app.onrender.com` — main site
   - `https://your-app.onrender.com/api/health` — API + database

UptimeRobot pings every 5 minutes and emails you if the service is down.

> **Tip:** UptimeRobot pings also serve as a keep-alive, reducing cold starts on the free tier.

## Troubleshooting

### Site won't load / build failed

Check the **Logs** tab in the Render dashboard.

Common causes:
- Docker build timeout — retry the deploy (Render dashboard → **Manual Deploy**)
- Missing environment variable — verify all 7 variables are set in **Environment**

### API returns database error

```bash
curl https://your-app.onrender.com/api/health
# If "database":"disconnected", check your PG* env vars in Render
```

Verify in Render **Environment** tab:
- `PGHOST` matches exactly what Neon shows (no trailing spaces)
- `PGSSLMODE` is set to `require`
- `PGPASSWORD` is correct (passwords are hidden — re-enter if unsure)

### HLS stream not playing

The stream comes from CloudFront, not from Render. Check in browser DevTools → Console for CORS or network errors. The Render server is not involved in audio delivery.

### Rating / bookmark not persisting after page refresh

- Bookmarks are stored in `localStorage` — they persist per-browser, per-device. This is by design.
- Ratings are stored in Neon — if ratings aren't saving, check the API health endpoint and Render logs.

### Cold start delay (~50 seconds)

On the free tier, Render spins down the service after 15 minutes of inactivity. The first request after spin-down triggers a cold start. Since audio streams from CloudFront, playback is unaffected — only the initial page load and API calls are delayed. See [Free Tier Limitations](#free-tier-limitations).

## Free Tier Limitations

| Limitation | Impact |
|---|---|
| Render spins down after 15 min inactivity | ~50s cold start on first visit |
| 750 free hours/month on Render | Enough for one always-on service |
| Neon free tier: 0.5 GB storage | More than enough for ratings + error logs |
| Rate limiting is per-instance | Works correctly (single Render instance) |

**Radio playback is unaffected by spin-down** — audio comes from CloudFront directly. Only the page load and ratings API experience the cold start delay.

To minimise cold starts, set up UptimeRobot as described in [Monitoring](#monitoring). Its 5-minute pings keep the service warm.

---

**Last Updated:** February 2026
