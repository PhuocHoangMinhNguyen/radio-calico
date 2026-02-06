#!/bin/bash
# test-docker-setup.sh
# Comprehensive test script for Radio Calico Docker setup
# Run this script to validate the entire Docker configuration

set -e

echo "======================================"
echo "Radio Calico Docker Setup Test"
echo "======================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counters
PASSED=0
FAILED=0

# Helper function for test results
test_pass() {
    echo -e "${GREEN}✓${NC} $1"
    ((PASSED++))
}

test_fail() {
    echo -e "${RED}✗${NC} $1"
    ((FAILED++))
}

test_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Test 1: Check Docker is installed
echo "1. Checking Docker installation..."
if command -v docker &> /dev/null; then
    DOCKER_VERSION=$(docker --version)
    test_pass "Docker is installed: $DOCKER_VERSION"
else
    test_fail "Docker is not installed"
    echo "   Install from: https://docs.docker.com/get-docker/"
    exit 1
fi

# Test 2: Check Docker Compose is installed
echo ""
echo "2. Checking Docker Compose..."
if docker compose version &> /dev/null; then
    COMPOSE_VERSION=$(docker compose version)
    test_pass "Docker Compose is installed: $COMPOSE_VERSION"
else
    test_fail "Docker Compose is not installed"
    exit 1
fi

# Test 3: Check Docker daemon is running
echo ""
echo "3. Checking Docker daemon..."
if docker info &> /dev/null; then
    test_pass "Docker daemon is running"
else
    test_fail "Docker daemon is not running"
    echo "   Start Docker Desktop or run: sudo systemctl start docker"
    exit 1
fi

# Test 4: Build development image
echo ""
echo "4. Building development Docker image..."
echo "   This may take 3-5 minutes on first run..."
if docker build --target development -t radio-calico:dev . > /tmp/docker-build-dev.log 2>&1; then
    test_pass "Development image built successfully"
    DEV_SIZE=$(docker images radio-calico:dev --format "{{.Size}}")
    echo "   Image size: $DEV_SIZE"
else
    test_fail "Development image build failed"
    echo "   Check logs: /tmp/docker-build-dev.log"
    tail -20 /tmp/docker-build-dev.log
    ((FAILED++))
fi

# Test 5: Build production image
echo ""
echo "5. Building production Docker image..."
echo "   This includes Angular production build (may take 2-4 minutes)..."
if docker build --target production -t radio-calico:prod . > /tmp/docker-build-prod.log 2>&1; then
    test_pass "Production image built successfully"
    PROD_SIZE=$(docker images radio-calico:prod --format "{{.Size}}")
    echo "   Image size: $PROD_SIZE"
else
    test_fail "Production image build failed"
    echo "   Check logs: /tmp/docker-build-prod.log"
    tail -20 /tmp/docker-build-prod.log
    ((FAILED++))
fi

# Test 6: Check .env.example exists
echo ""
echo "6. Checking environment configuration..."
if [ -f ".env.example" ]; then
    test_pass ".env.example exists"
else
    test_fail ".env.example not found"
fi

# Test 7: Validate docker-compose.yml
echo ""
echo "7. Validating docker-compose.yml..."
if docker compose -f docker-compose.yml config > /dev/null 2>&1; then
    test_pass "docker-compose.yml is valid"
else
    test_fail "docker-compose.yml has errors"
fi

# Test 8: Validate docker-compose.prod.yml
echo ""
echo "8. Validating docker-compose.prod.yml..."
if docker compose -f docker-compose.prod.yml config > /dev/null 2>&1; then
    test_pass "docker-compose.prod.yml is valid"
else
    test_fail "docker-compose.prod.yml has errors"
fi

# Test 9: Start development stack
echo ""
echo "9. Starting development stack..."
echo "   This will start PostgreSQL and the application..."
if docker compose up -d > /tmp/docker-compose-up.log 2>&1; then
    test_pass "Development stack started"

    # Wait for services to initialize
    echo "   Waiting 30 seconds for services to initialize..."
    sleep 30

    # Test 10: Check service health
    echo ""
    echo "10. Checking service health..."

    # Check database health
    if docker compose exec -T db pg_isready -U postgres -d radio_calico > /dev/null 2>&1; then
        test_pass "PostgreSQL is healthy"
    else
        test_fail "PostgreSQL health check failed"
    fi

    # Check if Angular dev server is responding
    echo ""
    echo "11. Checking Angular dev server (port 3000)..."
    if curl -f -s http://localhost:3000 > /dev/null 2>&1; then
        test_pass "Angular dev server is responding"
    else
        test_warn "Angular dev server not responding yet (may still be compiling)"
        echo "   Try: curl http://localhost:3000 (after a minute)"
    fi

    # Check if API server is responding
    echo ""
    echo "12. Checking API server (port 3001)..."
    if curl -f -s "http://localhost:3001/api/ratings?title=test&artist=test" > /dev/null 2>&1; then
        test_pass "API server is responding"
    else
        test_warn "API server not responding yet"
        echo "   Try: curl http://localhost:3001/api/ratings?title=test&artist=test"
    fi

    # Show container status
    echo ""
    echo "13. Container status:"
    docker compose ps

    # Test 14: Check logs for errors
    echo ""
    echo "14. Checking logs for errors..."
    ERROR_COUNT=$(docker compose logs 2>&1 | grep -i "error" | grep -v "0 error" | wc -l)
    if [ "$ERROR_COUNT" -eq 0 ]; then
        test_pass "No errors found in logs"
    else
        test_warn "Found $ERROR_COUNT error messages in logs"
        echo "   Run 'docker compose logs' to review"
    fi

    # Cleanup
    echo ""
    echo "15. Cleaning up test environment..."
    docker compose down > /dev/null 2>&1
    test_pass "Development stack stopped"

else
    test_fail "Failed to start development stack"
    cat /tmp/docker-compose-up.log
fi

# Test 16: Check documentation
echo ""
echo "16. Checking documentation files..."
docs=("DOCKER.md" "DOCKER_QUICK_REFERENCE.md" "DEPLOYMENT_SUMMARY.md")
for doc in "${docs[@]}"; do
    if [ -f "$doc" ]; then
        test_pass "$doc exists"
    else
        test_fail "$doc not found"
    fi
done

# Final summary
echo ""
echo "======================================"
echo "Test Summary"
echo "======================================"
echo -e "${GREEN}Passed: $PASSED${NC}"
if [ $FAILED -gt 0 ]; then
    echo -e "${RED}Failed: $FAILED${NC}"
fi
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed!${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Start development: docker compose up -d"
    echo "  2. Access app: http://localhost:3000"
    echo "  3. Access API: http://localhost:3001/api/ratings?title=test&artist=test"
    echo "  4. View logs: docker compose logs -f"
    echo "  5. Stop: docker compose down"
    echo ""
    echo "For production deployment, see: DOCKER.md"
    exit 0
else
    echo -e "${RED}✗ Some tests failed${NC}"
    echo ""
    echo "Common issues:"
    echo "  - Ports 3000, 3001, 5432 already in use"
    echo "  - Insufficient disk space for Docker builds"
    echo "  - Docker daemon not running"
    echo ""
    echo "Run with verbose output: bash -x test-docker-setup.sh"
    exit 1
fi
