# Docker Testing Guide — Radio Calico

Comprehensive testing guide for validating the Docker setup.

## Prerequisites

Before testing, ensure you have:
- Docker Desktop installed (Windows/Mac) or Docker Engine (Linux)
- Docker Compose v2 or later
- At least 2 GB free disk space
- Ports 3000, 3001, 5432 available

## Quick Test (Automated)

### Linux/Mac
```bash
chmod +x test-docker-setup.sh
./test-docker-setup.sh
```

### Windows
```cmd
test-docker-setup.bat
```

The automated test script will:
1. ✓ Verify Docker installation
2. ✓ Build development image
3. ✓ Build production image
4. ✓ Start development stack
5. ✓ Check service health
6. ✓ Validate configuration files
7. ✓ Clean up test environment

## Manual Testing (Step-by-Step)

### Test 1: Verify Docker Installation

```bash
# Check Docker
docker --version
# Expected: Docker version 24.0.0 or later

# Check Docker Compose
docker compose version
# Expected: Docker Compose version v2.20.0 or later

# Check Docker daemon
docker info
# Expected: Server information displayed
```

✅ **Pass Criteria:** All commands return version information without errors.

---

### Test 2: Build Development Image

```bash
# Build the development target
docker build --target development -t radio-calico:dev .

# Verify image was created
docker images radio-calico:dev
```

**Expected Output:**
```
REPOSITORY       TAG       IMAGE ID       CREATED          SIZE
radio-calico     dev       <image-id>     <timestamp>      ~800MB-1GB
```

✅ **Pass Criteria:**
- Build completes without errors
- Image appears in `docker images` output
- Size is reasonable (~800MB-1GB including Node.js + dependencies)

**Common Issues:**
- ❌ `npm ci` fails → Check package-lock.json is committed
- ❌ Build hangs → Increase Docker memory allocation (Docker Desktop → Settings → Resources)

---

### Test 3: Build Production Image

```bash
# Build the production target
docker build --target production -t radio-calico:prod .

# Verify image was created
docker images radio-calico:prod
```

**Expected Output:**
```
REPOSITORY       TAG       IMAGE ID       CREATED          SIZE
radio-calico     prod      <image-id>     <timestamp>      ~150-250MB
```

✅ **Pass Criteria:**
- Build completes without errors
- Production image is significantly smaller than dev (~150-250MB)
- Angular production build succeeds

**Common Issues:**
- ❌ `ng build` fails → Check angular.json configuration
- ❌ Out of memory → Increase Docker memory to 4GB+

---

### Test 4: Validate Compose Files

```bash
# Validate development compose file
docker compose -f docker-compose.yml config

# Validate production compose file
docker compose -f docker-compose.prod.yml config
```

✅ **Pass Criteria:** Both commands output merged configuration without errors.

---

### Test 5: Start Development Stack

```bash
# Start all services
docker compose up -d

# Check service status
docker compose ps
```

**Expected Output:**
```
NAME                      STATUS         PORTS
radio-calico-app-dev      Up (healthy)   0.0.0.0:3000-3001->3000-3001/tcp
radio-calico-db-dev       Up (healthy)   0.0.0.0:5432->5432/tcp
```

✅ **Pass Criteria:**
- Both services show `Up` status
- Health checks eventually pass (may take 30-60 seconds)
- No restart loops

**Wait for initialization:**
```bash
# Watch logs in real-time
docker compose logs -f

# Look for:
# - "webpack compiled successfully" (Angular)
# - "Server listening on port 3001" (API)
# - "database system is ready to accept connections" (PostgreSQL)
```

---

### Test 6: Test PostgreSQL Database

```bash
# Check database health
docker compose exec db pg_isready -U postgres -d radio_calico
# Expected: radio_calico:5432 - accepting connections

# Connect to database
docker compose exec db psql -U postgres -d radio_calico

# Verify schema was initialized
\dt
# Expected: Tables: song_ratings, song_votes, error_logs

# Exit psql
\q
```

✅ **Pass Criteria:**
- Database accepts connections
- All tables exist (song_ratings, song_votes, error_logs)
- No initialization errors in logs

---

### Test 7: Test Angular Dev Server

```bash
# Check if Angular is serving
curl -I http://localhost:3000
# Expected: HTTP/1.1 200 OK

# Or open in browser
# Windows: start http://localhost:3000
# Mac: open http://localhost:3000
# Linux: xdg-open http://localhost:3000
```

**Expected Result:**
- Browser displays Radio Calico interface
- No console errors (check browser DevTools)
- "Waiting for track info..." or current track displayed

✅ **Pass Criteria:**
- HTTP 200 response
- HTML content returned
- Application loads in browser

---

### Test 8: Test API Server

```bash
# Test ratings endpoint
curl "http://localhost:3001/api/ratings?title=TestSong&artist=TestArtist"
# Expected: {"thumbsUp": 0, "thumbsDown": 0}

# Test POST endpoint (submit rating)
curl -X POST "http://localhost:3001/api/ratings" \
  -H "Content-Type: application/json" \
  -d '{"title": "TestSong", "artist": "TestArtist", "rating": "up"}'
# Expected: {"success": true, "thumbsUp": 1, "thumbsDown": 0}

# Verify rating was stored
curl "http://localhost:3001/api/ratings?title=TestSong&artist=TestArtist"
# Expected: {"thumbsUp": 1, "thumbsDown": 0}
```

✅ **Pass Criteria:**
- GET returns rating data
- POST successfully stores ratings
- Database persists data

---

### Test 9: Test Hot-Reload (Development Only)

```bash
# Make a visible change to a component
echo "// Test change" >> src/app/app.ts

# Watch logs for recompilation
docker compose logs -f app
# Expected: "webpack compiled successfully"

# Refresh browser - change should be visible
```

✅ **Pass Criteria:**
- File changes trigger recompilation
- Browser reflects changes after refresh
- No need to rebuild container

---

### Test 10: Test Production Build

```bash
# Stop development stack
docker compose down

# Create production environment file
cp .env.example .env

# Edit .env and set a secure password
# PGPASSWORD=<generate-with: openssl rand -base64 32>

# Start production stack
docker compose -f docker-compose.prod.yml up -d

# Wait for initialization (30 seconds)
sleep 30

# Check status
docker compose -f docker-compose.prod.yml ps
```

**Expected Output:**
```
NAME                       STATUS         PORTS
radio-calico-app-prod      Up (healthy)   0.0.0.0:3000->3000/tcp
radio-calico-db-prod       Up (healthy)   5432/tcp (internal only)
```

✅ **Pass Criteria:**
- Both services start successfully
- App is accessible at http://localhost:3000
- Static Angular files are served
- API endpoints work at http://localhost:3000/api/*

---

### Test 11: Test Production API

```bash
# Test through the production server (port 3000)
curl "http://localhost:3000/api/ratings?title=ProdTest&artist=ProdArtist"
# Expected: {"thumbsUp": 0, "thumbsDown": 0}

# Submit rating
curl -X POST "http://localhost:3000/api/ratings" \
  -H "Content-Type: application/json" \
  -d '{"title": "ProdTest", "artist": "ProdArtist", "rating": "up"}'
# Expected: {"success": true, ...}
```

✅ **Pass Criteria:**
- API endpoints accessible at port 3000 (not 3001)
- Static files and API served by same server

---

### Test 12: Test Database Persistence

```bash
# Stop production stack
docker compose -f docker-compose.prod.yml down

# Restart (data should persist)
docker compose -f docker-compose.prod.yml up -d
sleep 30

# Verify data is still there
curl "http://localhost:3000/api/ratings?title=ProdTest&artist=ProdArtist"
# Expected: {"thumbsUp": 1, "thumbsDown": 0} (same as before)
```

✅ **Pass Criteria:**
- Data survives container restarts
- No "relation does not exist" errors

---

### Test 13: Test Health Checks

```bash
# Check health check status
docker compose -f docker-compose.prod.yml ps

# Inspect health check details
docker inspect radio-calico-app-prod | grep -A 10 Health
docker inspect radio-calico-db-prod | grep -A 10 Health
```

✅ **Pass Criteria:**
- Health status shows "healthy" (not "starting" or "unhealthy")
- Health checks run at correct intervals
- Failed health checks trigger container restart

---

### Test 14: Test Resource Limits (Production)

```bash
# Check resource usage
docker stats --no-stream

# Expected output should show:
# radio-calico-app-prod: < 512 MB memory, < 1 CPU
# radio-calico-db-prod: < 512 MB memory, < 1 CPU
```

✅ **Pass Criteria:**
- Containers respect memory limits
- CPU usage is reasonable (<50% under no load)

---

### Test 15: Test Database Backup

```bash
# Create a backup
docker compose -f docker-compose.prod.yml exec db \
  pg_dump -U postgres -F c radio_calico > test-backup.dump

# Verify backup file was created
ls -lh test-backup.dump
# Expected: File exists with size > 0

# Test restore (optional - creates a temporary test DB)
docker compose -f docker-compose.prod.yml exec db \
  psql -U postgres -c "CREATE DATABASE test_restore;"

docker compose -f docker-compose.prod.yml exec -T db \
  pg_restore -U postgres -d test_restore < test-backup.dump

# Clean up test database
docker compose -f docker-compose.prod.yml exec db \
  psql -U postgres -c "DROP DATABASE test_restore;"
```

✅ **Pass Criteria:**
- Backup file created successfully
- Restore completes without errors

---

### Test 16: Test Container Logs

```bash
# View all logs
docker compose -f docker-compose.prod.yml logs

# View app logs only
docker compose -f docker-compose.prod.yml logs app

# Follow logs in real-time
docker compose -f docker-compose.prod.yml logs -f

# Check for errors
docker compose -f docker-compose.prod.yml logs | grep -i error
# Expected: No critical errors (0 errors from webpack is fine)
```

✅ **Pass Criteria:**
- Logs are accessible and readable
- No unexpected errors or crashes
- JSON format (for production logging)

---

## Cleanup After Testing

```bash
# Stop and remove all containers, networks, volumes
docker compose down -v
docker compose -f docker-compose.prod.yml down -v

# Remove test images (optional)
docker rmi radio-calico:dev radio-calico:prod

# Remove backup file
rm -f test-backup.dump

# Remove test log files
rm -f docker-build-dev.log docker-build-prod.log docker-compose-up.log
```

---

## Test Results Checklist

Use this checklist to track your test results:

- [ ] Docker installation verified
- [ ] Development image builds successfully
- [ ] Production image builds successfully
- [ ] Compose files validate without errors
- [ ] Development stack starts successfully
- [ ] PostgreSQL database initializes with schema
- [ ] Angular dev server responds on port 3000
- [ ] API server responds on port 3001 (dev mode)
- [ ] Hot-reload works in development mode
- [ ] Production stack starts successfully
- [ ] Production serves static files on port 3000
- [ ] Production API endpoints work on port 3000
- [ ] Database data persists across restarts
- [ ] Health checks pass for all services
- [ ] Resource limits are enforced
- [ ] Database backup/restore works
- [ ] Container logs are accessible

**All tests passing?** ✅ Your Docker setup is production-ready!

---

## Troubleshooting

### Issue: Port Already in Use

**Symptom:** `Error starting userland proxy: listen tcp4 0.0.0.0:3000: bind: address already in use`

**Solution:**
```bash
# Find process using the port
# Windows: netstat -ano | findstr :3000
# Linux/Mac: lsof -i :3000

# Stop the conflicting process or use different ports
```

### Issue: Out of Memory During Build

**Symptom:** Build hangs or fails with "JavaScript heap out of memory"

**Solution:**
- Docker Desktop → Settings → Resources → Memory: Increase to 4GB+
- Add `NODE_OPTIONS=--max_old_space_size=4096` to .env

### Issue: Database Schema Not Initialized

**Symptom:** `relation "song_ratings" does not exist`

**Solution:**
```bash
# Remove volume and restart
docker compose down -v
docker compose up -d
```

### Issue: Angular Dev Server Not Responding

**Symptom:** `curl http://localhost:3000` times out

**Solution:**
```bash
# Check if compilation is still in progress
docker compose logs app | grep webpack

# Wait for "webpack compiled successfully"
# First compilation can take 2-3 minutes
```

### Issue: Permission Denied on Linux

**Symptom:** `Permission denied` errors during build

**Solution:**
```bash
# Ensure user is in docker group
sudo usermod -aG docker $USER
newgrp docker

# Or run with sudo
sudo docker compose up -d
```

---

## Performance Benchmarks

Expected performance metrics:

| Metric | Target | Notes |
|--------|--------|-------|
| Build time (dev) | < 5 minutes | First build, without cache |
| Build time (prod) | < 4 minutes | Includes Angular compilation |
| Container startup | < 30 seconds | Until healthy status |
| Angular compile | < 60 seconds | Hot-reload recompilation |
| Memory usage (dev) | < 1 GB | App container |
| Memory usage (prod) | < 300 MB | App container |
| Database memory | < 100 MB | Light usage |
| Image size (dev) | ~800-1000 MB | Includes dev dependencies |
| Image size (prod) | ~150-250 MB | Minimal runtime only |

---

## Next Steps

After successful testing:

1. **Commit the Docker setup:**
   ```bash
   git add Dockerfile docker-compose*.yml .dockerignore .env.example
   git commit -m "Add Docker containerization for dev and prod"
   ```

2. **Update main documentation:**
   - Add Docker instructions to README.md
   - Link to DOCKER.md for detailed setup

3. **Configure CI/CD:**
   - GitHub Actions workflow already included
   - Review `.github/workflows/docker-build.yml`
   - Add Docker Hub or GitHub Container Registry credentials

4. **Plan cloud deployment:**
   - See DOCKER.md for AWS/Azure/GCP guides
   - Choose deployment strategy based on scale

5. **Set up monitoring:**
   - Integrate with CloudWatch, Datadog, or Prometheus
   - Configure log aggregation
   - Set up alerting for container failures

---

## Support

For issues or questions:
- Check [DOCKER.md](DOCKER.md) for comprehensive documentation
- Review [DOCKER_QUICK_REFERENCE.md](DOCKER_QUICK_REFERENCE.md) for common commands
- See Docker logs: `docker compose logs`
- Validate setup: `./validate-docker-setup.sh`
