# Docker Deployment Guide for Radio Calico

This guide covers containerized deployment of Radio Calico using Docker and Docker Compose.

## Table of Contents

- [Quick Start](#quick-start)
- [Architecture Overview](#architecture-overview)
- [Environment Variables](#environment-variables)
- [Development Workflow](#development-workflow)
- [Production Deployment](#production-deployment)
- [Database Management](#database-management)
- [Monitoring and Health Checks](#monitoring-and-health-checks)
- [Troubleshooting](#troubleshooting)
- [Cloud Deployment](#cloud-deployment)

---

## Quick Start

### Prerequisites

- Docker Engine 24.0.0+ (verify: `docker --version`)
- Docker Compose 2.20.0+ (verify: `docker compose version`)
- 2 GB free disk space
- Ports 3000, 5432 available (development) or 3000 only (production)

### Development Setup (5 minutes)

```bash
# 1. Clone and enter directory
cd /path/to/radio-calico

# 2. Start all services (Angular dev server + API + PostgreSQL)
docker compose up -d

# 3. Wait for services to be ready (~30 seconds)
docker compose logs -f app

# 4. Access application
# - App: http://localhost:3000
# - API: http://localhost:3001/api/ratings?title=test&artist=test
# - Database UI (optional): http://localhost:8080 (start with --profile tools)

# 5. Stop services
docker compose down
```

### Production Deployment (quick version)

```bash
# 1. Configure environment
cp .env.example .env
# Edit .env and set PGPASSWORD to a secure value

# 2. Build and start
docker compose -f docker-compose.prod.yml up -d

# 3. Access at http://localhost:3000
```

---

## Architecture Overview

### Development Architecture

```
┌─────────────────────────────────────────────┐
│  Host Machine                                │
│                                              │
│  ┌────────────────────────────────────────┐ │
│  │  Docker Network: radio_calico_network  │ │
│  │                                         │ │
│  │  ┌──────────────┐   ┌──────────────┐  │ │
│  │  │   Angular    │   │   Node API   │  │ │
│  │  │  Dev Server  │   │    Server    │  │ │
│  │  │   :3000      │   │   :3001      │  │ │
│  │  └──────┬───────┘   └──────┬───────┘  │ │
│  │         │  Proxies /api/*  │          │ │
│  │         └──────────────────┘          │ │
│  │                │                       │ │
│  │         ┌──────▼──────────┐           │ │
│  │         │   PostgreSQL    │           │ │
│  │         │      :5432      │           │ │
│  │         └─────────────────┘           │ │
│  │                                        │ │
│  └────────────────────────────────────────┘ │
│                                              │
│  Volumes:                                    │
│  - Source code mounted for hot-reload        │
│  - postgres_data_dev (persistent DB)         │
└──────────────────────────────────────────────┘
```

### Production Architecture

```
┌─────────────────────────────────────────────┐
│  Host Machine / Cloud Instance              │
│                                              │
│  ┌────────────────────────────────────────┐ │
│  │  Docker Network: radio_calico_network  │ │
│  │                                         │ │
│  │  ┌──────────────────────────────────┐  │ │
│  │  │   Node.js Server                 │  │ │
│  │  │   (Static files + API)           │  │ │
│  │  │          :3000                    │  │ │
│  │  └──────────────┬───────────────────┘  │ │
│  │                 │                      │ │
│  │         ┌───────▼──────────┐          │ │
│  │         │   PostgreSQL     │          │ │
│  │         │  (internal only) │          │ │
│  │         └──────────────────┘          │ │
│  │                                        │ │
│  └────────────────────────────────────────┘ │
│                                              │
│  Volumes:                                    │
│  - postgres_data_prod (persistent DB only)   │
└──────────────────────────────────────────────┘
```

### Container Stages

The `Dockerfile` uses multi-stage builds for optimization:

1. **base** — Node.js 20.11.1 + dependencies installed via `npm ci`
2. **development** — Base + source code, runs `npm run dev`
3. **builder** — Base + source, runs `npm run build:prod` to compile Angular
4. **production** — Minimal runtime with compiled assets only, runs `node server.js`

---

## Environment Variables

### Variable Schema

| Variable       | Description                                  | Required? | Default (Dev)               | Default (Prod)     | Secret? |
|----------------|----------------------------------------------|-----------|-----------------------------|---------------------|---------|
| `PGHOST`       | PostgreSQL server hostname                   | No        | `db` (Docker service name)  | `db`                | No      |
| `PGPORT`       | PostgreSQL server port                       | No        | `5432`                      | `5432`              | No      |
| `PGDATABASE`   | Database name                                | No        | `radio_calico`              | `radio_calico`      | No      |
| `PGUSER`       | Database username                            | No        | `postgres`                  | `postgres`          | No      |
| `PGPASSWORD`   | Database password                            | **Yes**   | `radiocalico_dev_password`  | (must be set)       | **Yes** |
| `PORT`         | Application server port                      | No        | `3000` (prod), `3001` (dev) | `3000`              | No      |
| `NODE_ENV`     | Node environment                             | No        | `development`               | `production`        | No      |
| `APP_PORT`     | Host port binding for docker-compose.prod.yml| No        | `3000`                      | `3000`              | No      |

### Setting Environment Variables

#### Development

Default values work out-of-the-box. No `.env` file required.

To customize:
```bash
cp .env.example .env
# Edit .env with your preferences
docker compose up -d
```

#### Production

**REQUIRED:** Set `PGPASSWORD` before deploying.

```bash
# Generate a secure password
openssl rand -base64 32

# Create .env file
cat > .env <<EOF
PGPASSWORD=your_generated_password_here
NODE_ENV=production
EOF

# Secure the file
chmod 600 .env
```

### Secrets Management Recommendations

For production deployments, use a secrets management service instead of `.env` files:

- **AWS:** AWS Secrets Manager or Systems Manager Parameter Store
- **Azure:** Azure Key Vault
- **GCP:** Secret Manager
- **Docker:** Docker Secrets (Swarm mode)
- **Kubernetes:** Kubernetes Secrets

Example with Docker Secrets (Swarm):
```bash
echo "your_secure_password" | docker secret create postgres_password -
# Update docker-compose.prod.yml to use secrets instead of environment variables
```

---

## Development Workflow

### Starting Development Environment

```bash
# Full stack (Angular dev server + API + PostgreSQL)
docker compose up -d

# View logs
docker compose logs -f

# View specific service logs
docker compose logs -f app
docker compose logs -f db
```

### Hot Reload

Source code is mounted as a volume in development mode. Changes to TypeScript, HTML, or SCSS files trigger automatic recompilation.

**Changes requiring restart:**
- `package.json` modifications
- `angular.json` configuration changes
- Environment variable changes in `docker-compose.yml`

```bash
# Restart after dependency changes
docker compose restart app
```

### Running Tests Inside Containers

```bash
# Frontend tests
docker compose exec app npm run test:headless

# Backend tests
docker compose exec app npm run test:api

# Run specific test file
docker compose exec app npx vitest run src/app/services/bookmark.service.spec.ts
```

### Database Access

```bash
# Connect to PostgreSQL via psql
docker compose exec db psql -U postgres -d radio_calico

# Export data
docker compose exec db pg_dump -U postgres radio_calico > backup.sql

# Import data
docker compose exec -T db psql -U postgres -d radio_calico < backup.sql
```

### Starting Adminer (Database UI)

```bash
# Start with tools profile
docker compose --profile tools up -d

# Access Adminer
open http://localhost:8080

# Login credentials:
# - System: PostgreSQL
# - Server: db
# - Username: postgres
# - Password: radiocalico_dev_password (or your custom password)
# - Database: radio_calico
```

### Stopping and Cleaning Up

```bash
# Stop services (preserves data)
docker compose down

# Stop and remove volumes (deletes database data)
docker compose down -v

# Stop, remove volumes, and remove images
docker compose down -v --rmi all
```

---

## Production Deployment

### Building Production Images

```bash
# Build production image
docker compose -f docker-compose.prod.yml build

# Build with no cache (clean build)
docker compose -f docker-compose.prod.yml build --no-cache

# Verify image size
docker images | grep radio-calico
# Expected: ~150-200 MB for app image
```

### Deployment Checklist

- [ ] Set `PGPASSWORD` in `.env` (minimum 32 characters, alphanumeric + symbols)
- [ ] Review and set `APP_PORT` if 3000 is already in use
- [ ] Ensure firewall allows inbound traffic on `APP_PORT`
- [ ] Configure reverse proxy (Nginx, Traefik) with HTTPS termination
- [ ] Set up log aggregation (CloudWatch, ELK, etc.)
- [ ] Configure monitoring and alerting
- [ ] Test database backups
- [ ] Review resource limits in `docker-compose.prod.yml`

### Starting Production Stack

```bash
# Create .env file with production secrets
cp .env.example .env
nano .env  # Set PGPASSWORD

# Start services in detached mode
docker compose -f docker-compose.prod.yml up -d

# Monitor startup
docker compose -f docker-compose.prod.yml logs -f

# Verify health
docker compose -f docker-compose.prod.yml ps
# Both services should show "healthy" status after ~30 seconds
```

### Production Service Management

```bash
# View logs (last 100 lines)
docker compose -f docker-compose.prod.yml logs --tail=100

# Follow logs in real-time
docker compose -f docker-compose.prod.yml logs -f app

# Restart application (e.g., after config change)
docker compose -f docker-compose.prod.yml restart app

# Update to new image version
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d

# Scale application (requires load balancer)
docker compose -f docker-compose.prod.yml up -d --scale app=3
```

### Rolling Updates (Zero Downtime)

```bash
# Build new image version
docker compose -f docker-compose.prod.yml build

# Start new container before stopping old one
docker compose -f docker-compose.prod.yml up -d --no-deps --build app

# Docker Compose will:
# 1. Start new container
# 2. Wait for health check to pass
# 3. Remove old container
```

---

## Database Management

### Initialization

The database schema (`db/init.sql`) is automatically applied on first container start. PostgreSQL's `docker-entrypoint-initdb.d` mechanism executes all `.sql` files in alphabetical order.

**Tables created:**
- `song_ratings` — aggregate thumbs up/down counts per song
- `song_votes` — per-IP vote tracking for deduplication
- `error_logs` — client-side error reports with 30-day auto-cleanup

### Backups

#### Manual Backup

```bash
# Development
docker compose exec db pg_dump -U postgres -F c radio_calico > backup-$(date +%Y%m%d-%H%M%S).dump

# Production
docker compose -f docker-compose.prod.yml exec db pg_dump -U postgres -F c radio_calico > backup-$(date +%Y%m%d-%H%M%S).dump
```

#### Automated Backups

Add a cron job on the host:

```bash
# Edit crontab
crontab -e

# Add daily backup at 2 AM
0 2 * * * cd /path/to/radio-calico && docker compose -f docker-compose.prod.yml exec -T db pg_dump -U postgres -F c radio_calico > /backups/radio-calico-$(date +\%Y\%m\%d).dump
```

#### Cloud Backup Solutions

- **AWS RDS:** Automated snapshots with point-in-time recovery
- **Azure Database for PostgreSQL:** Automated backups with 7-35 day retention
- **GCP Cloud SQL:** Automated daily backups
- **Docker Volume Plugins:** REX-Ray, Flocker for volume snapshots

### Restore

```bash
# Stop application to prevent conflicts
docker compose -f docker-compose.prod.yml stop app

# Restore from dump
docker compose -f docker-compose.prod.yml exec -T db pg_restore -U postgres -d radio_calico -c < backup.dump

# Restart application
docker compose -f docker-compose.prod.yml start app
```

### Migration Strategy

For schema changes:

1. **Development:** Modify `db/init.sql` and recreate containers
2. **Production:** Write migration scripts, apply manually

```bash
# Example: add new column
cat > migration-001.sql <<EOF
ALTER TABLE song_ratings ADD COLUMN last_voted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
EOF

# Apply migration
docker compose -f docker-compose.prod.yml exec -T db psql -U postgres -d radio_calico < migration-001.sql
```

---

## Monitoring and Health Checks

### Built-in Health Checks

Both services have health checks defined in Docker Compose:

**Database:**
- Command: `pg_isready -U postgres -d radio_calico`
- Interval: 10s (dev), 30s (prod)
- Retries: 5

**Application:**
- Command: HTTP GET to `http://localhost:3000/`
- Interval: 30s
- Retries: 3

### Checking Service Health

```bash
# View health status
docker compose ps

# Example output:
# NAME                    STATUS
# radio-calico-app-prod   Up 2 minutes (healthy)
# radio-calico-db-prod    Up 2 minutes (healthy)

# Detailed inspection
docker inspect radio-calico-app-prod | grep -A 10 Health
```

### Monitoring Recommendations

#### Application Metrics

Monitor these endpoints/metrics:
- HTTP response times (p50, p95, p99)
- API error rates (`/api/ratings`, `/api/errors`)
- Database connection pool usage
- Memory usage (Node.js heap size)

#### Log Aggregation

**Docker logging driver configuration:**

```yaml
# Add to docker-compose.prod.yml services
app:
  logging:
    driver: "json-file"
    options:
      max-size: "10m"
      max-file: "3"
```

**Centralized logging options:**
- **CloudWatch Logs** (AWS)
- **ELK Stack** (Elasticsearch, Logstash, Kibana)
- **Grafana Loki**
- **Datadog**

#### Alerting Thresholds

Set up alerts for:
- Container restart loops (> 3 restarts in 5 minutes)
- Database connection failures
- Disk usage > 80%
- Memory usage > 90%
- Response time > 2 seconds for 5 consecutive checks

---

## Troubleshooting

### Common Issues

#### Port Already in Use

**Error:** `Bind for 0.0.0.0:3000 failed: port is already allocated`

**Solution:**
```bash
# Find process using port 3000
lsof -i :3000  # macOS/Linux
netstat -ano | findstr :3000  # Windows

# Kill process or change port
# In docker-compose.yml:
APP_PORT=3001 docker compose up -d
```

#### Database Connection Refused

**Error:** `ECONNREFUSED ::1:5432` or `connection refused`

**Solution:**
```bash
# Check database is running and healthy
docker compose ps db
docker compose logs db

# Verify network connectivity
docker compose exec app ping db

# Check environment variables
docker compose exec app env | grep PG
```

#### Angular Build Fails in Production

**Error:** `ENOSPC: no space left on device` or build timeout

**Solution:**
```bash
# Increase Docker resources in Docker Desktop
# Settings → Resources → Memory: 4 GB minimum

# Or build outside container and copy
npm run build:prod
docker build --target production -t radio-calico:prod .
```

#### Hot Reload Not Working (Development)

**Symptoms:** Code changes don't trigger recompilation

**Solution:**
```bash
# Ensure volumes are mounted correctly
docker compose down
docker compose up -d

# Check volume mounts
docker inspect radio-calico-app-dev | grep Mounts -A 20

# If on Windows with WSL2, ensure code is in WSL2 filesystem
# NOT /mnt/c/... but ~/projects/...
```

### Debugging

#### Interactive Shell Access

```bash
# Access running container
docker compose exec app sh

# Navigate and inspect
cd /app
ls -la
cat .env
node -e "console.log(process.env.PGHOST)"
```

#### Check Container Logs

```bash
# Last 50 lines
docker compose logs --tail=50 app

# Follow logs in real-time
docker compose logs -f app

# Search logs
docker compose logs app | grep ERROR
```

#### Inspect Network

```bash
# List networks
docker network ls

# Inspect network details
docker network inspect radio_calico_network_prod

# Test connectivity between containers
docker compose exec app ping db
docker compose exec app nc -zv db 5432
```

---

## Cloud Deployment

### AWS Deployment Options

#### Option 1: EC2 + Docker Compose (Simple)

**Cost:** ~$10-30/month (t3.small instance)

1. Launch EC2 instance (Ubuntu 22.04 LTS)
2. Install Docker and Docker Compose
3. Clone repository
4. Configure `.env` with RDS credentials or use container database
5. Run `docker compose -f docker-compose.prod.yml up -d`
6. Configure security group to allow inbound 3000 (or use ALB)

**Pros:** Simple, familiar, full control
**Cons:** Manual scaling, no managed services

#### Option 2: ECS Fargate + RDS (Managed)

**Cost:** ~$30-100/month (Fargate tasks + RDS t3.micro)

1. Push image to ECR
2. Create RDS PostgreSQL instance
3. Create ECS task definition
4. Create ECS service with Application Load Balancer
5. Configure secrets in AWS Secrets Manager

**Pros:** Auto-scaling, managed database, high availability
**Cons:** More complex setup, higher cost

#### Option 3: Elastic Beanstalk (Easiest)

**Cost:** ~$20-50/month

```bash
# Install EB CLI
pip install awsebcli

# Initialize
eb init -p docker radio-calico

# Create environment with RDS
eb create radio-calico-prod --database --database.engine postgres

# Deploy
eb deploy
```

**Pros:** Simplest AWS deployment, auto-scaling included
**Cons:** Less control, Elastic Beanstalk abstractions

### Azure Deployment

**Azure Container Instances + Azure Database for PostgreSQL**

```bash
# Build and push to Azure Container Registry
az acr build --registry myregistry --image radio-calico:latest .

# Create container group
az container create \
  --resource-group radio-calico-rg \
  --name radio-calico-app \
  --image myregistry.azurecr.io/radio-calico:latest \
  --dns-name-label radio-calico \
  --ports 3000 \
  --environment-variables \
    PGHOST=radio-calico-db.postgres.database.azure.com \
    PGUSER=postgres \
    PGDATABASE=radio_calico \
  --secure-environment-variables \
    PGPASSWORD=$DB_PASSWORD
```

### GCP Deployment

**Cloud Run + Cloud SQL**

```bash
# Build and push to Artifact Registry
gcloud builds submit --tag gcr.io/PROJECT_ID/radio-calico

# Deploy to Cloud Run
gcloud run deploy radio-calico \
  --image gcr.io/PROJECT_ID/radio-calico \
  --platform managed \
  --region us-central1 \
  --set-env-vars PGHOST=/cloudsql/PROJECT_ID:us-central1:radio-calico-db \
  --set-secrets PGPASSWORD=radio-calico-db-password:latest \
  --add-cloudsql-instances PROJECT_ID:us-central1:radio-calico-db
```

### Kubernetes Deployment

For high-traffic scenarios (> 1000 concurrent users), consider Kubernetes:

- **Managed Kubernetes:** EKS (AWS), AKS (Azure), GKE (GCP)
- **Helm Chart:** Create for easier deployments
- **Horizontal Pod Autoscaling:** Scale based on CPU/memory
- **Database:** Use managed PostgreSQL service, not in-cluster

**Not included in this setup:** Kubernetes configurations require additional complexity not warranted for a typical Radio Calico deployment. Use Docker Compose on a single instance or managed container services first.

---

## CI/CD Integration

### GitHub Actions Example

`.github/workflows/docker-build.yml`:

```yaml
name: Build and Push Docker Image

on:
  push:
    branches: [main, master]
  pull_request:
    branches: [main, master]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to Docker Hub
        if: github.event_name == 'push'
        uses: docker/login-action@v3
        with:
          username: ${{ secrets.DOCKER_USERNAME }}
          password: ${{ secrets.DOCKER_PASSWORD }}

      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          target: production
          push: ${{ github.event_name == 'push' }}
          tags: yourusername/radio-calico:latest
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

---

## Performance Tuning

### Resource Limits

Adjust resource limits in `docker-compose.prod.yml` based on usage:

```yaml
# For higher traffic (500+ concurrent users)
deploy:
  resources:
    limits:
      cpus: '2.0'
      memory: 1G
    reservations:
      cpus: '1.0'
      memory: 512M
```

### PostgreSQL Tuning

```bash
# Connect to database
docker compose exec db psql -U postgres -d radio_calico

# Check current settings
SHOW shared_buffers;
SHOW max_connections;

# Adjust settings by mounting custom postgresql.conf
# Add to docker-compose.prod.yml:
volumes:
  - ./postgresql.conf:/etc/postgresql/postgresql.conf:ro
command: postgres -c config_file=/etc/postgresql/postgresql.conf
```

---

## Security Hardening

### Image Scanning

```bash
# Scan for vulnerabilities with Docker Scout
docker scout cves radio-calico:latest

# Or use Trivy
trivy image radio-calico:latest
```

### Network Isolation

```yaml
# Restrict database to internal network only
# In docker-compose.prod.yml, remove ports section from db service
# Application can still access via service name 'db'
```

### Read-Only Filesystem

Production containers run with read-only filesystem and tmpfs for writable directories (already configured in `docker-compose.prod.yml`).

---

## Support and Maintenance

### Version Pinning

All base images are pinned to specific versions:
- `node:20.11.1-alpine3.19`
- `postgres:16.6-alpine3.21`
- `adminer:4.8.1`

**Update procedure:**
1. Test new versions in development
2. Update Dockerfile and docker-compose.yml
3. Rebuild images
4. Deploy to staging
5. Monitor for issues
6. Deploy to production

### Maintenance Schedule

Recommended maintenance windows:
- **Weekly:** Review logs for errors
- **Monthly:** Update base images (security patches)
- **Quarterly:** Review resource usage and adjust limits
- **Annually:** Database vacuum and reindex

---

## Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Specification](https://docs.docker.com/compose/compose-file/)
- [PostgreSQL Docker Image](https://hub.docker.com/_/postgres)
- [Node.js Docker Best Practices](https://github.com/nodejs/docker-node/blob/main/docs/BestPractices.md)

---

## Contact

For issues specific to this Docker setup, file an issue in the repository with:
- Docker version (`docker --version`)
- Docker Compose version (`docker compose version`)
- Operating system
- Full error output
- Steps to reproduce
