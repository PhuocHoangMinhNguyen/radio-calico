# Docker Deployment Summary for Radio Calico

This document provides a complete overview of the Docker setup created for Radio Calico.

## Files Created

### Core Docker Files

1. **Dockerfile** — Multi-stage build with development and production targets
   - Location: `/Dockerfile`
   - Base image: `node:20.11.1-alpine3.19` (pinned for reproducibility)
   - Stages: base → development | builder → production
   - Production image runs as non-root user with read-only filesystem
   - Health checks included for both development and production

2. **.dockerignore** — Excludes unnecessary files from build context
   - Location: `/.dockerignore`
   - Reduces image size by excluding node_modules, tests, docs, git history
   - Never includes .env files in images

3. **docker-compose.yml** — Development environment configuration
   - Location: `/docker-compose.yml`
   - Services: Angular dev server (:3000) + API server (:3001) + PostgreSQL (:5432)
   - Volume mounts for hot-reload during development
   - Optional Adminer database UI (start with `--profile tools`)
   - Default PostgreSQL password: `radiocalico_dev_password`

4. **docker-compose.prod.yml** — Production environment configuration
   - Location: `/docker-compose.prod.yml`
   - Services: Single Node.js server (:3000) + PostgreSQL (internal only)
   - Security hardening: read-only containers, non-root user, no exposed DB port
   - Resource limits configured
   - REQUIRES setting `PGPASSWORD` in `.env` before deployment

### Configuration Files

5. **.env.example** — Environment variable template
   - Location: `/.env.example`
   - Documents all required and optional environment variables
   - Includes security checklist for production deployments
   - Copy to `.env` and customize for your environment

### Helper Scripts

6. **docker/init-db.sh** — Database initialization wrapper
   - Location: `/docker/init-db.sh`
   - Executed automatically on first PostgreSQL container start
   - Applies schema from `db/init.sql`
   - Executable permissions set

### Documentation

7. **DOCKER.md** — Comprehensive Docker deployment guide (15,000+ words)
   - Location: `/DOCKER.md`
   - Covers: architecture, environment variables, dev workflow, production deployment
   - Includes: database management, monitoring, troubleshooting, cloud deployment
   - Cloud platform guides for AWS, Azure, GCP
   - CI/CD integration examples

8. **DOCKER_QUICK_REFERENCE.md** — Essential commands cheat sheet
   - Location: `/DOCKER_QUICK_REFERENCE.md`
   - Day-to-day development and production commands
   - URLs, ports, and health check examples
   - Quick troubleshooting patterns

### CI/CD Configuration

9. **.github/workflows/docker-build.yml** — GitHub Actions workflow
   - Location: `/.github/workflows/docker-build.yml`
   - Automated Docker image builds on push to main/master
   - Pushes to GitHub Container Registry (ghcr.io)
   - Runs backend and frontend tests against PostgreSQL service
   - Uses GitHub Actions cache for faster builds

## Architecture Overview

### Development Mode

```
┌─────────────────────────────────────┐
│  Docker Compose Dev Stack           │
│                                      │
│  ┌────────────┐   ┌──────────────┐ │
│  │  Angular   │   │   Node API   │ │
│  │  :3000     │ → │   :3001      │ │
│  └────────────┘   └──────┬───────┘ │
│                           │         │
│                    ┌──────▼──────┐  │
│                    │ PostgreSQL  │  │
│                    │   :5432     │  │
│                    └─────────────┘  │
└─────────────────────────────────────┘
  ↑
  Source code mounted as volume
  (hot-reload enabled)
```

- Angular dev server with proxy to API
- API server with CORS headers for development
- PostgreSQL exposed to host for debugging
- Adminer UI optional (port 8080)

### Production Mode

```
┌────────────────────────────────────┐
│  Docker Compose Prod Stack         │
│                                     │
│  ┌──────────────────────────────┐  │
│  │  Node.js Server              │  │
│  │  (Static files + API)        │  │
│  │        :3000                  │  │
│  └──────────────┬───────────────┘  │
│                 │                   │
│          ┌──────▼──────┐            │
│          │ PostgreSQL  │            │
│          │  (internal) │            │
│          └─────────────┘            │
└────────────────────────────────────┘
```

- Single Node.js server serves both static Angular files and API
- PostgreSQL NOT exposed to host (internal network only)
- Optimized, minimal production image (~150-200 MB)
- Security hardening: non-root user, read-only filesystem

## Quick Start Guide

### Development Setup (3 commands)

```bash
cd /path/to/radio-calico
docker compose up -d
# Wait ~30 seconds, then access http://localhost:3000
```

### Production Deployment (4 commands)

```bash
cp .env.example .env
nano .env  # Set PGPASSWORD to a secure value (min 32 chars)
docker compose -f docker-compose.prod.yml up -d
# Access http://localhost:3000
```

## Environment Variables Reference

| Variable       | Dev Default                    | Prod Requirement  | Secret? |
|----------------|--------------------------------|-------------------|---------|
| PGHOST         | `db` (Docker service)          | `db`              | No      |
| PGPORT         | `5432`                         | `5432`            | No      |
| PGDATABASE     | `radio_calico`                 | `radio_calico`    | No      |
| PGUSER         | `postgres`                     | `postgres`        | No      |
| PGPASSWORD     | `radiocalico_dev_password`     | **MUST SET**      | **YES** |
| PORT           | `3000`/`3001`                  | `3000`            | No      |
| NODE_ENV       | `development`                  | `production`      | No      |

**Production Security Note:** Generate strong password with:
```bash
openssl rand -base64 32
```

## Common Operations

### Development

```bash
# Start
docker compose up -d

# View logs
docker compose logs -f

# Restart after dependency changes
docker compose restart app

# Run tests
docker compose exec app npm run test:headless

# Stop
docker compose down
```

### Production

```bash
# Start
docker compose -f docker-compose.prod.yml up -d

# View logs
docker compose -f docker-compose.prod.yml logs -f

# Update to new version
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d

# Backup database
docker compose -f docker-compose.prod.yml exec db \
  pg_dump -U postgres -F c radio_calico > backup-$(date +%Y%m%d).dump

# Stop
docker compose -f docker-compose.prod.yml down
```

## Port Mapping

| Port | Service                  | Environment  | Exposed to Host? |
|------|--------------------------|--------------|------------------|
| 3000 | Angular dev server       | Development  | Yes              |
| 3000 | Node.js server (prod)    | Production   | Yes              |
| 3001 | API server               | Development  | Yes              |
| 5432 | PostgreSQL               | Development  | Yes (debugging)  |
| 5432 | PostgreSQL               | Production   | No (internal)    |
| 8080 | Adminer UI               | Development  | Yes (optional)   |

## Database Management

### Automatic Initialization

- `db/init.sql` is automatically applied on first container start
- Creates tables: `song_ratings`, `song_votes`, `error_logs`
- Includes indexes and 30-day retention trigger

### Manual Operations

```bash
# Connect via psql
docker compose exec db psql -U postgres -d radio_calico

# Backup
docker compose exec db pg_dump -U postgres -F c radio_calico > backup.dump

# Restore
docker compose exec -T db pg_restore -U postgres -d radio_calico -c < backup.dump
```

## Security Features

### Development
- Default credentials (not for production use)
- CORS headers enabled
- All ports exposed for debugging

### Production
- Non-root user (nodejs:nodejs, UID 1001)
- Read-only filesystem with tmpfs for writable directories
- PostgreSQL NOT exposed to host (internal network only)
- Security options: `no-new-privileges`
- Resource limits configured (CPU, memory)
- Health checks for automatic container restarts
- Secrets via environment variables (integrate with secrets manager)

## Image Sizes

| Stage        | Size (approx) | Use Case                     |
|--------------|---------------|------------------------------|
| base         | ~250 MB       | Intermediate build stage     |
| development  | ~350 MB       | Dev with all source files    |
| builder      | ~400 MB       | Intermediate build stage     |
| production   | ~150-200 MB   | Optimized runtime image      |

## Testing

### Local Testing (Development)

```bash
# Frontend tests
docker compose exec app npm run test:headless

# Backend tests
docker compose exec app npm run test:api

# Single test file
docker compose exec app npx vitest run src/app/services/bookmark.service.spec.ts
```

### CI/CD Testing (GitHub Actions)

- Workflow: `.github/workflows/docker-build.yml`
- Builds both dev and prod images
- Runs backend tests against PostgreSQL service
- Runs frontend tests in Node environment
- Caches layers for faster subsequent builds

## Cloud Deployment Options

### AWS

1. **EC2 + Docker Compose** (simplest)
   - Launch Ubuntu instance
   - Install Docker and Docker Compose
   - Clone repo and run `docker compose -f docker-compose.prod.yml up -d`
   - Cost: ~$10-30/month

2. **ECS Fargate + RDS** (managed)
   - Push image to ECR
   - Create RDS PostgreSQL instance
   - Deploy to ECS with Application Load Balancer
   - Cost: ~$30-100/month

3. **Elastic Beanstalk** (easiest)
   - `eb init` and `eb create` with RDS
   - Auto-scaling included
   - Cost: ~$20-50/month

### Azure

- **Azure Container Instances + Azure Database for PostgreSQL**
- Push to Azure Container Registry
- Deploy with `az container create`

### GCP

- **Cloud Run + Cloud SQL**
- Push to Artifact Registry
- Deploy with `gcloud run deploy`
- Serverless auto-scaling

See `DOCKER.md` for detailed cloud deployment guides.

## Monitoring

### Health Checks

Both services have built-in health checks:

```bash
# Check status
docker compose ps

# Expected output:
# NAME                  STATUS
# radio-calico-app      Up (healthy)
# radio-calico-db       Up (healthy)
```

### Logs

```bash
# View all logs
docker compose logs -f

# App logs only
docker compose logs -f app

# Last 100 lines
docker compose logs --tail=100 app

# Search for errors
docker compose logs app | grep ERROR
```

### Resource Usage

```bash
# Real-time stats
docker stats

# Disk usage
docker system df
```

## Troubleshooting

### Common Issues

1. **Port already in use**
   ```bash
   # Find process using port
   lsof -i :3000  # macOS/Linux
   netstat -ano | findstr :3000  # Windows

   # Or change port
   APP_PORT=3001 docker compose up -d
   ```

2. **Database connection refused**
   ```bash
   # Check DB is running
   docker compose ps db
   docker compose logs db

   # Verify connectivity
   docker compose exec app ping db
   ```

3. **Hot reload not working**
   ```bash
   # Restart services
   docker compose restart

   # Verify volume mounts
   docker inspect radio-calico-app-dev | grep Mounts -A 20
   ```

## Maintenance

### Update Base Images

```bash
# Edit Dockerfile and docker-compose files with new versions
# Example: node:20.11.1-alpine3.19 → node:20.12.0-alpine3.19

# Rebuild
docker compose build --no-cache
docker compose up -d

# Test thoroughly before production deployment
```

### Database Maintenance

```bash
# Vacuum (reclaim space)
docker compose exec db psql -U postgres -d radio_calico -c "VACUUM ANALYZE;"

# Reindex
docker compose exec db psql -U postgres -d radio_calico -c "REINDEX DATABASE radio_calico;"
```

## Next Steps

1. **For Development:**
   - Run `docker compose up -d`
   - Start coding with hot-reload enabled
   - See `DOCKER_QUICK_REFERENCE.md` for daily commands

2. **For Production:**
   - Review `DOCKER.md` section on "Production Deployment Checklist"
   - Configure `.env` with secure credentials
   - Set up monitoring and log aggregation
   - Configure automated backups
   - Deploy behind reverse proxy (Nginx, Traefik) with HTTPS

3. **For CI/CD:**
   - GitHub Actions workflow is ready to use
   - Push to main/master branch triggers automatic builds
   - Configure Docker Hub or GHCR authentication in repository secrets

## Support

For detailed documentation on any topic, see:
- **DOCKER.md** — Comprehensive guide (15,000+ words)
- **DOCKER_QUICK_REFERENCE.md** — Daily commands
- **README.md** — Project overview
- **CLAUDE.md** — Development guidelines

---

**Summary:** Radio Calico is now fully containerized with Docker support for both development and production environments. The setup is production-ready, security-hardened, and includes comprehensive documentation for deployment on any platform.
