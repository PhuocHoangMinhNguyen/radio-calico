# Makefile for Radio Calico
# Provides convenient shortcuts for development, production, and testing

.PHONY: help dev dev-up dev-down prod prod-up prod-down prod-rebuild test test-frontend test-backend test-all clean logs logs-backend logs-nginx logs-db status db-init install

# Default target - show help
help:
	@echo "Radio Calico - Available Make Targets"
	@echo "======================================"
	@echo ""
	@echo "Development:"
	@echo "  make dev          - Start development servers (Angular + API)"
	@echo "  make dev-up       - Start Docker development environment"
	@echo "  make dev-down     - Stop Docker development environment"
	@echo "  make dev-tools    - Start dev environment with Adminer UI"
	@echo ""
	@echo "Production:"
	@echo "  make prod         - Start production Docker environment (port 8080)"
	@echo "  make prod-up      - Alias for 'make prod'"
	@echo "  make prod-down    - Stop production Docker environment"
	@echo "  make prod-rebuild - Rebuild and restart production environment"
	@echo ""
	@echo "Testing:"
	@echo "  make test         - Run all tests (frontend + backend)"
	@echo "  make test-frontend - Run frontend tests only"
	@echo "  make test-backend  - Run backend tests only"
	@echo "  make test-watch   - Run frontend tests in watch mode"
	@echo ""
	@echo "Database:"
	@echo "  make db-init      - Initialize database schema"
	@echo ""
	@echo "Utilities:"
	@echo "  make install      - Install npm dependencies"
	@echo "  make build        - Build production Angular app"
	@echo "  make logs         - Show all container logs"
	@echo "  make logs-backend - Show backend container logs"
	@echo "  make logs-nginx   - Show nginx container logs"
	@echo "  make logs-db      - Show database container logs"
	@echo "  make status       - Show container status"
	@echo "  make clean        - Stop all containers and clean up volumes"
	@echo ""

# Development targets
dev:
	@echo "Starting development servers..."
	npm run dev

dev-up:
	@echo "Starting Docker development environment..."
	docker-compose up -d
	@echo "Development environment started!"
	@echo "  Angular dev server: http://localhost:3000"
	@echo "  API server: http://localhost:3001"

dev-down:
	@echo "Stopping Docker development environment..."
	docker-compose down

dev-tools:
	@echo "Starting development environment with Adminer..."
	docker-compose --profile tools up -d
	@echo "Development environment started!"
	@echo "  Angular dev server: http://localhost:3000"
	@echo "  API server: http://localhost:3001"
	@echo "  Adminer UI: http://localhost:8080"

# Production targets
prod:
	@echo "Starting production Docker environment..."
	NGINX_PORT=8080 docker-compose -f docker-compose.prod.yml up -d
	@echo "Production environment started!"
	@echo "  Application: http://localhost:8080"
	@echo ""
	@echo "Run 'make logs' to view logs"
	@echo "Run 'make status' to check container health"

prod-up: prod

prod-down:
	@echo "Stopping production Docker environment..."
	docker-compose -f docker-compose.prod.yml down

prod-rebuild:
	@echo "Rebuilding and restarting production environment..."
	docker-compose -f docker-compose.prod.yml down
	NGINX_PORT=8080 docker-compose -f docker-compose.prod.yml up --build -d
	@echo "Production environment rebuilt and started!"
	@echo "  Application: http://localhost:8080"

# Testing targets
test: test-frontend test-backend

test-frontend:
	@echo "Running frontend tests..."
	npm run test:headless

test-backend:
	@echo "Running backend tests..."
	npm run test:api

test-all: test

test-watch:
	@echo "Running frontend tests in watch mode..."
	npm test

# Database targets
db-init:
	@echo "Initializing database schema..."
	@if [ -z "$$PGPASSWORD" ]; then \
		echo "Error: PGPASSWORD environment variable not set"; \
		echo "Usage: PGPASSWORD=yourpassword make db-init"; \
		exit 1; \
	fi
	PGPASSWORD=$$PGPASSWORD psql -U postgres -d radio_calico -f db/init.sql
	@echo "Database schema initialized!"

# Utility targets
install:
	@echo "Installing npm dependencies..."
	npm ci --legacy-peer-deps

build:
	@echo "Building production Angular app..."
	npm run build:prod

logs:
	@echo "Showing all container logs (Ctrl+C to exit)..."
	docker-compose -f docker-compose.prod.yml logs -f

logs-backend:
	@echo "Showing backend logs (Ctrl+C to exit)..."
	docker-compose -f docker-compose.prod.yml logs -f backend

logs-nginx:
	@echo "Showing nginx logs (Ctrl+C to exit)..."
	docker-compose -f docker-compose.prod.yml logs -f nginx

logs-db:
	@echo "Showing database logs (Ctrl+C to exit)..."
	docker-compose -f docker-compose.prod.yml logs -f db

status:
	@echo "Production environment status:"
	@docker-compose -f docker-compose.prod.yml ps
	@echo ""
	@echo "Development environment status:"
	@docker-compose ps

clean:
	@echo "Stopping all containers and cleaning up..."
	docker-compose down -v
	docker-compose -f docker-compose.prod.yml down -v
	@echo "Cleanup complete!"

# Verification targets (for testing the nginx setup)
verify-health:
	@echo "Testing health endpoint..."
	@curl -s http://localhost:8080/health || echo "Failed to connect to health endpoint"

verify-frontend:
	@echo "Testing frontend serving..."
	@curl -s http://localhost:8080/ | head -5 || echo "Failed to connect to frontend"

verify-api:
	@echo "Testing API proxy..."
	@curl -s "http://localhost:8080/api/ratings?title=test&artist=test" || echo "Failed to connect to API"

verify-spa:
	@echo "Testing SPA routing..."
	@curl -s http://localhost:8080/some-random-route | head -5 || echo "Failed to test SPA routing"

verify-all: verify-health verify-frontend verify-api verify-spa
	@echo ""
	@echo "All verification tests completed!"
