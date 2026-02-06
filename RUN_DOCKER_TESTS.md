# How to Run Docker Tests for Radio Calico

Docker is installed on your system but needs to be started before running tests.

## Step 1: Start Docker Desktop

### Windows
1. Press `Windows key`
2. Type "Docker Desktop"
3. Click on "Docker Desktop" to launch it
4. Wait for Docker Desktop to fully start (whale icon in system tray should be steady)

**Or via command line:**
```cmd
start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
```

Wait 30-60 seconds for Docker to start completely.

---

## Step 2: Verify Docker is Running

Open a new terminal and run:

```bash
docker info
```

If you see server information, Docker is ready!

---

## Step 3: Run Automated Tests

### Option A: Automated Test Script (Recommended)

**Windows Command Prompt or PowerShell:**
```cmd
cd C:\Users\nphmi\Programming\radio-calico
test-docker-setup.bat
```

**Git Bash / WSL:**
```bash
cd /c/Users/nphmi/Programming/radio-calico
./test-docker-setup.sh
```

This will automatically:
- ✅ Build development image (~3-5 minutes first time)
- ✅ Build production image (~2-4 minutes)
- ✅ Start containers
- ✅ Test all services
- ✅ Verify health checks
- ✅ Clean up

**Expected runtime:** 5-8 minutes (first run)

---

### Option B: Manual Testing

If you prefer to run tests step-by-step:

```bash
# 1. Build images
docker build --target development -t radio-calico:dev .
docker build --target production -t radio-calico:prod .

# 2. Start development stack
docker compose up -d

# 3. Wait for initialization
# Give it 30-60 seconds for Angular to compile

# 4. Test endpoints
curl http://localhost:3000
curl "http://localhost:3001/api/ratings?title=test&artist=test"

# 5. Check logs
docker compose logs -f

# 6. Stop when done
docker compose down
```

---

## Step 4: Check Test Results

### Success Indicators ✅

You should see:
```
✓ Docker is installed: Docker version 29.2.0
✓ Development image built successfully
   Image size: ~800-900 MB
✓ Production image built successfully
   Image size: ~150-250 MB
✓ PostgreSQL is healthy
✓ Angular dev server is responding
✓ API server is responding
✓ All tests passed!
```

### Container Status
```cmd
docker compose ps
```

Should show:
```
NAME                      STATUS         PORTS
radio-calico-app-dev      Up (healthy)   0.0.0.0:3000-3001->3000-3001/tcp
radio-calico-db-dev       Up (healthy)   0.0.0.0:5432->5432/tcp
```

---

## Troubleshooting

### Issue: "Docker daemon not running"

**Solution:** Start Docker Desktop and wait for it to fully initialize (30-60 seconds)

### Issue: "Port already in use"

**Solution:**
```bash
# Stop any conflicting services
docker compose down
# Or find what's using the port:
netstat -ano | findstr :3000
```

### Issue: "Out of memory"

**Solution:**
1. Docker Desktop → Settings icon (top right)
2. Resources → Memory
3. Increase to at least 4 GB
4. Click "Apply & Restart"

### Issue: "Angular not compiling"

**Solution:**
- This is normal on first run
- Check logs: `docker compose logs -f app`
- Wait for: "webpack compiled successfully" (takes 1-3 minutes)
- Then try accessing http://localhost:3000 again

### Issue: "Cannot connect to Docker daemon"

**Solution:**
- Restart Docker Desktop
- Or run: `wsl --shutdown` then restart Docker Desktop

---

## Quick Commands Reference

```bash
# After Docker Desktop is running:

# Run all tests
test-docker-setup.bat

# Build only
docker build --target development -t radio-calico:dev .

# Start development
docker compose up -d

# View logs
docker compose logs -f

# Stop everything
docker compose down

# Remove everything (including data)
docker compose down -v
```

---

## What Happens During Testing

The automated test will:

1. **Verify Docker** (2 seconds)
   - Check Docker version
   - Check Docker Compose version
   - Verify daemon is running

2. **Build Development Image** (3-5 minutes first time, ~30s cached)
   - Install Node.js dependencies
   - Setup development environment
   - Result: ~800-900 MB image

3. **Build Production Image** (2-4 minutes first time, ~1min cached)
   - Install dependencies
   - Compile Angular production build
   - Result: ~150-250 MB optimized image

4. **Start Services** (30 seconds)
   - PostgreSQL database
   - Application containers
   - Wait for health checks

5. **Test Endpoints** (10 seconds)
   - Angular dev server (http://localhost:3000)
   - API server (http://localhost:3001/api/ratings)
   - Database connectivity

6. **Verify Health** (5 seconds)
   - Check container health status
   - Verify no errors in logs

7. **Cleanup** (10 seconds)
   - Stop containers
   - Remove test resources

**Total Time:** ~5-8 minutes (first run), ~2-3 minutes (subsequent runs with cache)

---

## After Tests Pass

Once tests pass successfully:

1. **Start development environment:**
   ```bash
   docker compose up -d
   ```
   Access at: http://localhost:3000

2. **View comprehensive docs:**
   - [DOCKER.md](DOCKER.md) - Full Docker guide
   - [DOCKER_QUICK_REFERENCE.md](DOCKER_QUICK_REFERENCE.md) - Command cheat sheet
   - [DOCKER_TESTING_GUIDE.md](DOCKER_TESTING_GUIDE.md) - Manual testing procedures

3. **For production deployment:**
   ```bash
   cp .env.example .env
   # Edit .env and set PGPASSWORD
   docker compose -f docker-compose.prod.yml up -d
   ```

---

## Need Help?

- Full testing guide: [DOCKER_TESTING_GUIDE.md](DOCKER_TESTING_GUIDE.md)
- Quick reference: [DOCKER_QUICK_REFERENCE.md](DOCKER_QUICK_REFERENCE.md)
- Comprehensive docs: [DOCKER.md](DOCKER.md)
- Check logs: `docker compose logs`
- Container status: `docker compose ps`
