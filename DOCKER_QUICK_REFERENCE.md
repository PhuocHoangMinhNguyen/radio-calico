# Docker Quick Reference — Radio Calico

Essential commands for day-to-day Docker operations.

## Development

```bash
# Start development stack
docker compose up -d

# View logs
docker compose logs -f

# Stop everything
docker compose down

# Rebuild after dependency changes
docker compose build
docker compose up -d

# Run tests
docker compose exec app npm run test:headless
docker compose exec app npm run test:api

# Database access
docker compose exec db psql -U postgres -d radio_calico

# Start with database UI
docker compose --profile tools up -d
# Access Adminer at http://localhost:8080
```

## Production

```bash
# Initial setup
cp .env.example .env
nano .env  # Set PGPASSWORD

# Start production stack
docker compose -f docker-compose.prod.yml up -d

# View logs
docker compose -f docker-compose.prod.yml logs -f

# Restart after changes
docker compose -f docker-compose.prod.yml restart app

# Update to new version
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d

# Backup database
docker compose -f docker-compose.prod.yml exec db pg_dump -U postgres -F c radio_calico > backup.dump

# Stop everything
docker compose -f docker-compose.prod.yml down
```

## Troubleshooting

```bash
# Check service health
docker compose ps

# View detailed logs
docker compose logs --tail=100 app

# Access container shell
docker compose exec app sh

# Restart specific service
docker compose restart app

# Clean rebuild
docker compose down -v --rmi all
docker compose build --no-cache
docker compose up -d

# Check disk usage
docker system df

# Clean up unused resources
docker system prune -a
```

## URLs

| Environment | Service | URL |
|-------------|---------|-----|
| Development | App | http://localhost:3000 |
| Development | API | http://localhost:3001/api/ratings?title=test&artist=test |
| Development | Database UI | http://localhost:8080 (with --profile tools) |
| Production | App + API | http://localhost:3000 |

## Environment Variables

| Variable | Dev Default | Production |
|----------|-------------|------------|
| PGPASSWORD | `radiocalico_dev_password` | **Must set in .env** |
| PORT | 3000/3001 | 3000 |
| NODE_ENV | development | production |

See `.env.example` for full list.

## Health Checks

```bash
# App health
curl http://localhost:3000/

# API health
curl http://localhost:3000/api/ratings?title=test&artist=test
# or (dev only)
curl http://localhost:3001/api/ratings?title=test&artist=test

# Database health
docker compose exec db pg_isready -U postgres -d radio_calico
```

## Common Patterns

```bash
# Full stack restart
docker compose restart

# Rebuild single service
docker compose up -d --no-deps --build app

# View container resource usage
docker stats

# Execute command in running container
docker compose exec app npm run build

# Copy files from container
docker compose cp app:/app/dist ./dist-backup

# Database backup and restore
docker compose exec db pg_dump -U postgres -F c radio_calico > backup.dump
docker compose exec -T db pg_restore -U postgres -d radio_calico -c < backup.dump
```

## Ports Reference

| Port | Service | Mode |
|------|---------|------|
| 3000 | Angular dev server | Development only |
| 3000 | Node.js server (static + API) | Production |
| 3001 | Node.js API server | Development only |
| 5432 | PostgreSQL | Development (exposed), Production (internal) |
| 8080 | Adminer UI | Development with --profile tools |

## Security Notes

- Never commit `.env` files
- Production PostgreSQL is NOT exposed to host (internal network only)
- Set strong `PGPASSWORD` (min 32 characters)
- Production containers run as non-root user
- Production containers use read-only filesystems
