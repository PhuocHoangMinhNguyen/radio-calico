#!/bin/bash
# Validation script for Docker setup
# Checks that all required files exist and have correct structure

set -e

echo "======================================"
echo "Radio Calico Docker Setup Validation"
echo "======================================"
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check function
check_file() {
    local file=$1
    local description=$2

    if [ -f "$file" ]; then
        echo -e "${GREEN}✓${NC} Found: $file ($description)"
        return 0
    else
        echo -e "${RED}✗${NC} Missing: $file ($description)"
        return 1
    fi
}

check_dir() {
    local dir=$1
    local description=$2

    if [ -d "$dir" ]; then
        echo -e "${GREEN}✓${NC} Found: $dir ($description)"
        return 0
    else
        echo -e "${RED}✗${NC} Missing: $dir ($description)"
        return 1
    fi
}

# Counter for missing files
missing=0

echo "Checking Docker configuration files..."
echo ""

# Core Docker files
check_file "Dockerfile" "Multi-stage Docker build" || ((missing++))
check_file ".dockerignore" "Build context exclusions" || ((missing++))
check_file "docker-compose.yml" "Development environment" || ((missing++))
check_file "docker-compose.prod.yml" "Production environment" || ((missing++))
check_file ".env.example" "Environment variable template" || ((missing++))

echo ""
echo "Checking documentation..."
echo ""

check_file "DOCKER.md" "Comprehensive Docker guide" || ((missing++))
check_file "DOCKER_QUICK_REFERENCE.md" "Quick reference card" || ((missing++))
check_file "DEPLOYMENT_SUMMARY.md" "Deployment summary" || ((missing++))

echo ""
echo "Checking helper scripts..."
echo ""

check_dir "docker" "Docker helper scripts directory" || ((missing++))
check_file "docker/init-db.sh" "Database initialization script" || ((missing++))

echo ""
echo "Checking CI/CD configuration..."
echo ""

check_file ".github/workflows/docker-build.yml" "GitHub Actions workflow" || ((missing++))

echo ""
echo "Checking existing project files..."
echo ""

check_file "server.js" "Backend server" || ((missing++))
check_file "package.json" "Node.js dependencies" || ((missing++))
check_file "db/init.sql" "Database schema" || ((missing++))
check_file "angular.json" "Angular configuration" || ((missing++))
check_file "proxy.conf.json" "Development proxy config" || ((missing++))

echo ""
echo "Checking .gitignore..."
echo ""

if grep -q "^\.env" .gitignore 2>/dev/null; then
    echo -e "${GREEN}✓${NC} .env is in .gitignore (security check)"
else
    echo -e "${YELLOW}⚠${NC} Warning: .env should be in .gitignore"
    # Don't increment missing counter for this warning
fi

echo ""
echo "======================================"

if [ $missing -eq 0 ]; then
    echo -e "${GREEN}✓ All checks passed!${NC}"
    echo ""
    echo "Next steps:"
    echo "  Development: docker compose up -d"
    echo "  Production:  cp .env.example .env && docker compose -f docker-compose.prod.yml up -d"
    echo ""
    echo "See DOCKER.md for detailed documentation."
    exit 0
else
    echo -e "${RED}✗ $missing checks failed${NC}"
    echo ""
    echo "Please ensure all required files are present."
    exit 1
fi
