# Load Testing

k6 load tests simulating 100 concurrent users over 5 minutes.

## Quick Start

```bash
# Install k6
winget install k6              # Windows
brew install k6                # macOS

# Or use Docker (no install)
pnpm test:load:docker          # Full test (5 min, 100 users)
pnpm test:load:quick           # Quick test (10s, 5 users)
```

## Test Configuration

**load-test.js** (5 minutes):
- Ramp up: 0→20→50→100 users over 3.5 min
- Sustain: 100 users for 1 min
- Ramp down: 30s

**load-test-quick.js** (10 seconds):
- 5 users for quick validation

**Success criteria:**
- 95th percentile <500ms
- Error rate <1%

## Usage

```bash
# Local development
pnpm start:api                 # Terminal 1
pnpm test:load                 # Terminal 2

# Docker production
docker-compose -f docker-compose.prod.yml up -d
pnpm test:load

# Custom target
K6_BASE_URL=https://prod.example.com k6 run tests/load-test.js
```

## Key Metrics

- `http_req_duration` p(95) - Should be <500ms
- `http_req_failed` rate - Should be <1%
- `checks` - Should be >99%

## Monitoring During Test

```bash
docker logs -f radio-calico-backend-prod    # Backend logs
docker stats                                 # Resource usage
```

## Resources

- [k6 docs](https://k6.io/docs/)
- [k6 best practices](https://k6.io/docs/testing-guides/automated-performance-testing/)
