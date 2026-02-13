# Docker Deployment Guide

Containerized deployment for Radio Calico using Docker and Docker Compose.

## Quick Start

### Development
```bash
docker-compose up              # Start all services
docker-compose --profile tools up  # Include Adminer DB UI

# Access
# App: http://localhost:3000
# API: http://localhost:3001
# Adminer: http://localhost:8080
```

### Production
```bash
docker-compose -f docker-compose.prod.yml up -d

# Or use convenience scripts
make prod                      # Linux/macOS/WSL
.\radio-calico.ps1 prod       # Windows PowerShell

# Access: http://localhost:8080
```

## Architecture

### Development (`docker-compose.yml`)
- **app:** Angular dev server (3000) + API server (3001)
- **db:** PostgreSQL 16 with auto-init from `db/init.sql`
- **adminer:** Database UI (optional, `--profile tools`)

### Production (`docker-compose.prod.yml`)
- **nginx:** Static files + reverse proxy to backend
- **backend:** Node.js API only (internal port 3001)
- **db:** PostgreSQL (internal only, no exposed port)

## Environment Variables

### Development
```env
# docker-compose.yml
POSTGRES_DB=radio_calico_dev
POSTGRES_USER=postgres
POSTGRES_PASSWORD=radiocalico_dev_password
```

### Production
```env
# docker-compose.prod.yml or .env
POSTGRES_DB=radio_calico
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_secure_password  # Change this!
NODE_ENV=production
API_ONLY=true
NGINX_PORT=80  # External nginx port
```

## Management Commands

### Using Makefile (Linux/macOS/WSL/Git Bash)
```bash
make help         # Show all commands
make dev          # Start development
make prod         # Start production
make stop         # Stop all containers
make clean        # Remove containers and volumes
make logs         # View logs
make status       # Container status
make test         # Run tests
```

### Using PowerShell (Windows)
```powershell
.\radio-calico.ps1 help
.\radio-calico.ps1 prod
.\radio-calico.ps1 stop
.\radio-calico.ps1 clean
.\radio-calico.ps1 logs
```

### Manual Docker Commands
```bash
# Start/stop
docker-compose up -d
docker-compose down

# View logs
docker-compose logs -f
docker-compose logs -f app

# Execute commands
docker-compose exec app pnpm test:api
docker-compose exec db psql -U postgres -d radio_calico

# Rebuild
docker-compose build
docker-compose up -d --build
```

## Health Checks

All services include health checks:

```bash
# Check service health
docker-compose ps

# Backend health endpoint
curl http://localhost:3001/api/health  # Dev
curl http://localhost/api/health       # Prod (via nginx)

# Expected response
{"status":"healthy","database":"connected","timestamp":"..."}
```

## Database Management

### Backup
```bash
docker-compose exec db pg_dump -U postgres radio_calico > backup.sql
```

### Restore
```bash
cat backup.sql | docker-compose exec -T db psql -U postgres -d radio_calico
```

### Access Database
```bash
# Via psql
docker-compose exec db psql -U postgres -d radio_calico

# Via Adminer (development)
docker-compose --profile tools up -d
# Open http://localhost:8080
```

## Troubleshooting

**Port conflicts:**
```bash
# Check port usage
netstat -an | grep "3000\|5432\|8080"

# Change ports in docker-compose.yml
ports:
  - "3001:3000"  # Host:Container
```

**Database connection errors:**
```bash
# Check database is ready
docker-compose exec db pg_isready

# View database logs
docker-compose logs db

# Reinitialize database
docker-compose down -v  # WARNING: Deletes data!
docker-compose up -d
```

**Container won't start:**
```bash
# View build logs
docker-compose build --no-cache

# Check container logs
docker-compose logs app

# Rebuild from scratch
docker-compose down -v
docker system prune -a  # Careful: removes all unused images
docker-compose up --build
```

## Multi-Stage Build

The `Dockerfile` uses multi-stage builds:

1. **base** - Node.js + dependencies (pnpm install)
2. **development** - Full source with hot-reload
3. **builder** - Production build (ng build --configuration production)
4. **production** - Minimal runtime with built assets only

## Security

- Non-root user in production containers
- Resource limits on all services
- Security headers via nginx
- Health checks for monitoring
- No exposed database port in production

## Cloud Deployment

### AWS ECS/Fargate
```bash
# Build and push to ECR
aws ecr get-login-password | docker login --username AWS --password-stdin <account>.dkr.ecr.<region>.amazonaws.com
docker build -t radio-calico:latest --target production .
docker tag radio-calico:latest <account>.dkr.ecr.<region>.amazonaws.com/radio-calico:latest
docker push <account>.dkr.ecr.<region>.amazonaws.com/radio-calico:latest
```

### Docker Hub
```bash
docker build -t your-username/radio-calico:latest --target production .
docker push your-username/radio-calico:latest
```

### GitHub Container Registry (GHCR)
Already configured in `.github/workflows/docker-build.yml`. Images published to:
```
ghcr.io/phuochoangminhnguyen/radio-calico:latest
```

## Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose](https://docs.docker.com/compose/)
- [Dockerfile Reference](https://docs.docker.com/reference/dockerfile/)
