# Radio Calico - PowerShell Management Script
# Provides convenient shortcuts for development, production, and testing

param(
    [Parameter(Position=0)]
    [string]$Command = "help"
)

function Show-Help {
    Write-Host "Radio Calico - Available Commands" -ForegroundColor Cyan
    Write-Host "======================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Development:" -ForegroundColor Yellow
    Write-Host "  .\radio-calico.ps1 dev          - Start development servers (Angular + API)"
    Write-Host "  .\radio-calico.ps1 dev-up       - Start Docker development environment"
    Write-Host "  .\radio-calico.ps1 dev-down     - Stop Docker development environment"
    Write-Host "  .\radio-calico.ps1 dev-tools    - Start dev environment with Adminer UI"
    Write-Host ""
    Write-Host "Production:" -ForegroundColor Yellow
    Write-Host "  .\radio-calico.ps1 prod         - Start production Docker environment (port 8080)"
    Write-Host "  .\radio-calico.ps1 prod-up      - Alias for 'prod'"
    Write-Host "  .\radio-calico.ps1 prod-down    - Stop production Docker environment"
    Write-Host "  .\radio-calico.ps1 prod-rebuild - Rebuild and restart production environment"
    Write-Host ""
    Write-Host "Testing:" -ForegroundColor Yellow
    Write-Host "  .\radio-calico.ps1 test         - Run all tests (frontend + backend)"
    Write-Host "  .\radio-calico.ps1 test-frontend - Run frontend tests only"
    Write-Host "  .\radio-calico.ps1 test-backend  - Run backend tests only"
    Write-Host "  .\radio-calico.ps1 test-watch   - Run frontend tests in watch mode"
    Write-Host ""
    Write-Host "Database:" -ForegroundColor Yellow
    Write-Host "  .\radio-calico.ps1 db-init      - Initialize database schema"
    Write-Host ""
    Write-Host "Utilities:" -ForegroundColor Yellow
    Write-Host "  .\radio-calico.ps1 install      - Install npm dependencies"
    Write-Host "  .\radio-calico.ps1 build        - Build production Angular app"
    Write-Host "  .\radio-calico.ps1 logs         - Show all container logs"
    Write-Host "  .\radio-calico.ps1 logs-backend - Show backend container logs"
    Write-Host "  .\radio-calico.ps1 logs-nginx   - Show nginx container logs"
    Write-Host "  .\radio-calico.ps1 logs-db      - Show database container logs"
    Write-Host "  .\radio-calico.ps1 status       - Show container status"
    Write-Host "  .\radio-calico.ps1 clean        - Stop all containers and clean up volumes"
    Write-Host ""
    Write-Host "Verification:" -ForegroundColor Yellow
    Write-Host "  .\radio-calico.ps1 verify-all   - Test all endpoints (health, frontend, API, SPA)"
    Write-Host ""
}

function Start-Dev {
    Write-Host "Starting development servers..." -ForegroundColor Green
    npm run dev
}

function Start-DevDocker {
    Write-Host "Starting Docker development environment..." -ForegroundColor Green
    docker-compose up -d
    Write-Host ""
    Write-Host "Development environment started!" -ForegroundColor Green
    Write-Host "  Angular dev server: http://localhost:3000"
    Write-Host "  API server: http://localhost:3001"
}

function Stop-DevDocker {
    Write-Host "Stopping Docker development environment..." -ForegroundColor Yellow
    docker-compose down
}

function Start-DevTools {
    Write-Host "Starting development environment with Adminer..." -ForegroundColor Green
    docker-compose --profile tools up -d
    Write-Host ""
    Write-Host "Development environment started!" -ForegroundColor Green
    Write-Host "  Angular dev server: http://localhost:3000"
    Write-Host "  API server: http://localhost:3001"
    Write-Host "  Adminer UI: http://localhost:8080"
}

function Start-Prod {
    Write-Host "Starting production Docker environment..." -ForegroundColor Green
    $env:NGINX_PORT = "8080"
    docker-compose -f docker-compose.prod.yml up -d
    Write-Host ""
    Write-Host "Production environment started!" -ForegroundColor Green
    Write-Host "  Application: http://localhost:8080"
    Write-Host ""
    Write-Host "Run '.\radio-calico.ps1 logs' to view logs"
    Write-Host "Run '.\radio-calico.ps1 status' to check container health"
}

function Stop-Prod {
    Write-Host "Stopping production Docker environment..." -ForegroundColor Yellow
    docker-compose -f docker-compose.prod.yml down
}

function Rebuild-Prod {
    Write-Host "Rebuilding and restarting production environment..." -ForegroundColor Green
    docker-compose -f docker-compose.prod.yml down
    $env:NGINX_PORT = "8080"
    docker-compose -f docker-compose.prod.yml up --build -d
    Write-Host ""
    Write-Host "Production environment rebuilt and started!" -ForegroundColor Green
    Write-Host "  Application: http://localhost:8080"
}

function Run-Tests {
    Write-Host "Running all tests..." -ForegroundColor Green
    Run-TestFrontend
    Run-TestBackend
}

function Run-TestFrontend {
    Write-Host "Running frontend tests..." -ForegroundColor Green
    npm run test:headless
}

function Run-TestBackend {
    Write-Host "Running backend tests..." -ForegroundColor Green
    npm run test:api
}

function Run-TestWatch {
    Write-Host "Running frontend tests in watch mode..." -ForegroundColor Green
    npm test
}

function Initialize-Database {
    Write-Host "Initializing database schema..." -ForegroundColor Green
    if (-not $env:PGPASSWORD) {
        Write-Host "Error: PGPASSWORD environment variable not set" -ForegroundColor Red
        Write-Host "Usage: `$env:PGPASSWORD='yourpassword'; .\radio-calico.ps1 db-init"
        exit 1
    }
    psql -U postgres -d radio_calico -f db/init.sql
    Write-Host "Database schema initialized!" -ForegroundColor Green
}

function Install-Dependencies {
    Write-Host "Installing npm dependencies..." -ForegroundColor Green
    npm ci --legacy-peer-deps
}

function Build-App {
    Write-Host "Building production Angular app..." -ForegroundColor Green
    npm run build:prod
}

function Show-Logs {
    Write-Host "Showing all container logs (Ctrl+C to exit)..." -ForegroundColor Green
    docker-compose -f docker-compose.prod.yml logs -f
}

function Show-LogsBackend {
    Write-Host "Showing backend logs (Ctrl+C to exit)..." -ForegroundColor Green
    docker-compose -f docker-compose.prod.yml logs -f backend
}

function Show-LogsNginx {
    Write-Host "Showing nginx logs (Ctrl+C to exit)..." -ForegroundColor Green
    docker-compose -f docker-compose.prod.yml logs -f nginx
}

function Show-LogsDb {
    Write-Host "Showing database logs (Ctrl+C to exit)..." -ForegroundColor Green
    docker-compose -f docker-compose.prod.yml logs -f db
}

function Show-Status {
    Write-Host "Production environment status:" -ForegroundColor Cyan
    docker-compose -f docker-compose.prod.yml ps
    Write-Host ""
    Write-Host "Development environment status:" -ForegroundColor Cyan
    docker-compose ps
}

function Clean-All {
    Write-Host "Stopping all containers and cleaning up..." -ForegroundColor Yellow
    docker-compose down -v
    docker-compose -f docker-compose.prod.yml down -v
    Write-Host "Cleanup complete!" -ForegroundColor Green
}

function Verify-All {
    Write-Host "Testing health endpoint..." -ForegroundColor Cyan
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:8080/health" -UseBasicParsing
        Write-Host "  Success: Health endpoint returned $($response.Content)" -ForegroundColor Green
    }
    catch {
        Write-Host "  Failed: Health check error" -ForegroundColor Red
    }

    Write-Host "Testing frontend serving..." -ForegroundColor Cyan
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:8080/" -UseBasicParsing
        if ($response.Content -match "Radio Calico") {
            Write-Host "  Success: Frontend serving correctly" -ForegroundColor Green
        }
    }
    catch {
        Write-Host "  Failed: Frontend check error" -ForegroundColor Red
    }

    Write-Host "Testing API proxy..." -ForegroundColor Cyan
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:8080/api/ratings?title=test&artist=test" -UseBasicParsing
        $json = $response.Content | ConvertFrom-Json
        Write-Host "  Success: API returned thumbs_up=$($json.thumbs_up), thumbs_down=$($json.thumbs_down)" -ForegroundColor Green
    }
    catch {
        Write-Host "  Failed: API check error" -ForegroundColor Red
    }

    Write-Host "Testing SPA routing..." -ForegroundColor Cyan
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:8080/some-random-route" -UseBasicParsing
        if ($response.Content -match "Radio Calico") {
            Write-Host "  Success: SPA routing works (fallback to index.html)" -ForegroundColor Green
        }
    }
    catch {
        Write-Host "  Failed: SPA routing check error" -ForegroundColor Red
    }

    Write-Host ""
    Write-Host "All verification tests completed!" -ForegroundColor Green
}

# Main command router
switch ($Command.ToLower()) {
    "help" { Show-Help }
    "dev" { Start-Dev }
    "dev-up" { Start-DevDocker }
    "dev-down" { Stop-DevDocker }
    "dev-tools" { Start-DevTools }
    "prod" { Start-Prod }
    "prod-up" { Start-Prod }
    "prod-down" { Stop-Prod }
    "prod-rebuild" { Rebuild-Prod }
    "test" { Run-Tests }
    "test-frontend" { Run-TestFrontend }
    "test-backend" { Run-TestBackend }
    "test-watch" { Run-TestWatch }
    "db-init" { Initialize-Database }
    "install" { Install-Dependencies }
    "build" { Build-App }
    "logs" { Show-Logs }
    "logs-backend" { Show-LogsBackend }
    "logs-nginx" { Show-LogsNginx }
    "logs-db" { Show-LogsDb }
    "status" { Show-Status }
    "clean" { Clean-All }
    "verify-all" { Verify-All }
    default {
        Write-Host "Unknown command: $Command" -ForegroundColor Red
        Write-Host ""
        Show-Help
        exit 1
    }
}
