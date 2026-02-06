@echo off
REM test-docker-setup.bat
REM Windows batch script for testing Radio Calico Docker setup

echo ======================================
echo Radio Calico Docker Setup Test
echo ======================================
echo.

set PASSED=0
set FAILED=0

REM Test 1: Check Docker is installed
echo 1. Checking Docker installation...
docker --version >nul 2>&1
if %errorlevel% equ 0 (
    echo [32m✓[0m Docker is installed
    set /a PASSED+=1
    docker --version
) else (
    echo [31m✗[0m Docker is not installed
    echo    Install from: https://docs.docker.com/desktop/install/windows-install/
    set /a FAILED+=1
    exit /b 1
)

REM Test 2: Check Docker Compose
echo.
echo 2. Checking Docker Compose...
docker compose version >nul 2>&1
if %errorlevel% equ 0 (
    echo [32m✓[0m Docker Compose is installed
    set /a PASSED+=1
    docker compose version
) else (
    echo [31m✗[0m Docker Compose is not installed
    set /a FAILED+=1
    exit /b 1
)

REM Test 3: Check Docker daemon
echo.
echo 3. Checking Docker daemon...
docker info >nul 2>&1
if %errorlevel% equ 0 (
    echo [32m✓[0m Docker daemon is running
    set /a PASSED+=1
) else (
    echo [31m✗[0m Docker daemon is not running
    echo    Start Docker Desktop
    set /a FAILED+=1
    exit /b 1
)

REM Test 4: Build development image
echo.
echo 4. Building development Docker image...
echo    This may take 3-5 minutes on first run...
docker build --target development -t radio-calico:dev . >docker-build-dev.log 2>&1
if %errorlevel% equ 0 (
    echo [32m✓[0m Development image built successfully
    set /a PASSED+=1
    for /f "tokens=*" %%i in ('docker images radio-calico:dev --format "{{.Size}}"') do echo    Image size: %%i
) else (
    echo [31m✗[0m Development image build failed
    echo    Check logs: docker-build-dev.log
    set /a FAILED+=1
)

REM Test 5: Build production image
echo.
echo 5. Building production Docker image...
echo    This includes Angular production build ^(may take 2-4 minutes^)...
docker build --target production -t radio-calico:prod . >docker-build-prod.log 2>&1
if %errorlevel% equ 0 (
    echo [32m✓[0m Production image built successfully
    set /a PASSED+=1
    for /f "tokens=*" %%i in ('docker images radio-calico:prod --format "{{.Size}}"') do echo    Image size: %%i
) else (
    echo [31m✗[0m Production image build failed
    echo    Check logs: docker-build-prod.log
    set /a FAILED+=1
)

REM Test 6: Check .env.example
echo.
echo 6. Checking environment configuration...
if exist .env.example (
    echo [32m✓[0m .env.example exists
    set /a PASSED+=1
) else (
    echo [31m✗[0m .env.example not found
    set /a FAILED+=1
)

REM Test 7: Validate docker-compose.yml
echo.
echo 7. Validating docker-compose.yml...
docker compose -f docker-compose.yml config >nul 2>&1
if %errorlevel% equ 0 (
    echo [32m✓[0m docker-compose.yml is valid
    set /a PASSED+=1
) else (
    echo [31m✗[0m docker-compose.yml has errors
    set /a FAILED+=1
)

REM Test 8: Validate docker-compose.prod.yml
echo.
echo 8. Validating docker-compose.prod.yml...
docker compose -f docker-compose.prod.yml config >nul 2>&1
if %errorlevel% equ 0 (
    echo [32m✓[0m docker-compose.prod.yml is valid
    set /a PASSED+=1
) else (
    echo [31m✗[0m docker-compose.prod.yml has errors
    set /a FAILED+=1
)

REM Test 9: Start development stack
echo.
echo 9. Starting development stack...
echo    This will start PostgreSQL and the application...
docker compose up -d >docker-compose-up.log 2>&1
if %errorlevel% equ 0 (
    echo [32m✓[0m Development stack started
    set /a PASSED+=1

    echo    Waiting 30 seconds for services to initialize...
    timeout /t 30 /nobreak >nul

    REM Test 10: Check database health
    echo.
    echo 10. Checking PostgreSQL health...
    docker compose exec -T db pg_isready -U postgres -d radio_calico >nul 2>&1
    if %errorlevel% equ 0 (
        echo [32m✓[0m PostgreSQL is healthy
        set /a PASSED+=1
    ) else (
        echo [31m✗[0m PostgreSQL health check failed
        set /a FAILED+=1
    )

    REM Test 11: Check Angular dev server
    echo.
    echo 11. Checking Angular dev server ^(port 3000^)...
    curl -f -s http://localhost:3000 >nul 2>&1
    if %errorlevel% equ 0 (
        echo [32m✓[0m Angular dev server is responding
        set /a PASSED+=1
    ) else (
        echo [33m⚠[0m Angular dev server not responding yet ^(may still be compiling^)
        echo    Try: curl http://localhost:3000 ^(after a minute^)
    )

    REM Test 12: Check API server
    echo.
    echo 12. Checking API server ^(port 3001^)...
    curl -f -s "http://localhost:3001/api/ratings?title=test&artist=test" >nul 2>&1
    if %errorlevel% equ 0 (
        echo [32m✓[0m API server is responding
        set /a PASSED+=1
    ) else (
        echo [33m⚠[0m API server not responding yet
        echo    Try: curl http://localhost:3001/api/ratings?title=test^&artist=test
    )

    REM Show container status
    echo.
    echo 13. Container status:
    docker compose ps

    REM Cleanup
    echo.
    echo 14. Cleaning up test environment...
    docker compose down >nul 2>&1
    echo [32m✓[0m Development stack stopped
    set /a PASSED+=1

) else (
    echo [31m✗[0m Failed to start development stack
    set /a FAILED+=1
    type docker-compose-up.log
)

REM Check documentation
echo.
echo 15. Checking documentation files...
if exist DOCKER.md (
    echo [32m✓[0m DOCKER.md exists
    set /a PASSED+=1
) else (
    echo [31m✗[0m DOCKER.md not found
    set /a FAILED+=1
)

if exist DOCKER_QUICK_REFERENCE.md (
    echo [32m✓[0m DOCKER_QUICK_REFERENCE.md exists
    set /a PASSED+=1
) else (
    echo [31m✗[0m DOCKER_QUICK_REFERENCE.md not found
    set /a FAILED+=1
)

if exist DEPLOYMENT_SUMMARY.md (
    echo [32m✓[0m DEPLOYMENT_SUMMARY.md exists
    set /a PASSED+=1
) else (
    echo [31m✗[0m DEPLOYMENT_SUMMARY.md not found
    set /a FAILED+=1
)

REM Final summary
echo.
echo ======================================
echo Test Summary
echo ======================================
echo [32mPassed: %PASSED%[0m
if %FAILED% gtr 0 (
    echo [31mFailed: %FAILED%[0m
)
echo.

if %FAILED% equ 0 (
    echo [32m✓ All tests passed![0m
    echo.
    echo Next steps:
    echo   1. Start development: docker compose up -d
    echo   2. Access app: http://localhost:3000
    echo   3. Access API: http://localhost:3001/api/ratings?title=test^&artist=test
    echo   4. View logs: docker compose logs -f
    echo   5. Stop: docker compose down
    echo.
    echo For production deployment, see: DOCKER.md
    exit /b 0
) else (
    echo [31m✗ Some tests failed[0m
    echo.
    echo Common issues:
    echo   - Ports 3000, 3001, 5432 already in use
    echo   - Insufficient disk space for Docker builds
    echo   - Docker daemon not running
    echo.
    exit /b 1
)
