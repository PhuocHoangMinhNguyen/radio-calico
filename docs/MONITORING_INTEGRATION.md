# Production Monitoring Integration

Integrate Radio Calico with external monitoring for real-time alerts, performance tracking, and error aggregation.

## Quick Setup - Sentry (Recommended)

**Frontend:**
```bash
pnpm add @sentry/angular
```

```typescript
// src/main.ts
import * as Sentry from '@sentry/angular';

Sentry.init({
  dsn: 'https://your-dsn@sentry.io/project-id',
  environment: 'production',
  tracesSampleRate: 0.1,
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
  ],
});
```

**Backend:**
```bash
pnpm add @sentry/node
```

```javascript
// server.js (top of file)
const Sentry = require('@sentry/node');

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
});
```

**Auto-Detection:** `ErrorMonitoringService` automatically sends to Sentry if detected.

## Service Comparison

| Service | Free Tier | Best For | Setup Time | Cost (Paid) |
|---------|-----------|----------|------------|-------------|
| **Sentry** | 5k errors/month | Error tracking, releases | 10 min | $26+/mo |
| **Datadog** | 14-day trial | Full observability, APM | 30 min | $15+/host/mo |
| **New Relic** | 100GB/month | APM, infrastructure | 20 min | $0.30/GB |
| **CloudWatch** | AWS Free Tier | AWS-hosted apps | 15 min | Usage-based |

### Detailed Setup - Datadog

```javascript
// server.js
const tracer = require('dd-trace').init({
  service: 'radio-calico-backend',
  env: process.env.NODE_ENV,
});

// Custom metrics
const StatsD = require('node-statsd');
const metrics = new StatsD({ host: 'localhost', port: 8125 });

// Track API calls
metrics.increment('api.ratings.request');
metrics.timing('api.ratings.duration', responseTime);
```

### Custom Metrics

**Backend metrics to track:**
```javascript
// Track HLS stream requests
metrics.increment('hls.stream.request');
metrics.gauge('database.pool.active', pool.totalCount);
metrics.histogram('api.response_time', duration);

// Track business metrics
metrics.increment('ratings.thumbs_up');
metrics.increment('bookmarks.created');
```

**Frontend metrics (via Sentry):**
```typescript
// Track user actions
Sentry.metrics.increment('track.played');
Sentry.metrics.distribution('playback.duration', seconds);
Sentry.metrics.gauge('buffer.health', percentage);
```

## Essential Alerts

**Configure these alerts:**
1. Error rate >5/min
2. API p95 response time >1s
3. Database connection failures
4. HLS stream failures >10/hour
5. Rate limiting >100 hits/hour

## Dashboard Configuration

**Create a production dashboard with:**

1. **Error Overview Panel**
   - Total errors (24h)
   - Error rate trend graph
   - Top 5 error messages

2. **API Performance Panel**
   - Request count (requests/min)
   - Response time p50/p95/p99
   - Error rate percentage

3. **System Health Panel**
   - Database connection pool usage
   - Memory/CPU utilization
   - Active user count

4. **Business Metrics Panel**
   - Tracks played per hour
   - Ratings submitted
   - Bookmarks created

**Sentry Release Tracking:**
```bash
# Tag releases for error tracking
sentry-cli releases new "radio-calico@1.2.3"
sentry-cli releases set-commits "radio-calico@1.2.3" --auto
sentry-cli releases finalize "radio-calico@1.2.3"
```

## Verification

```bash
# Test error reporting
throw new Error('Test monitoring integration');

# Test custom metrics
metrics.increment('test.metric');

# Check dashboard for:
# - Error appears within 30 seconds
# - Alerts trigger correctly
# - Custom metrics visible
```

## Resources

- [Sentry Angular SDK](https://docs.sentry.io/platforms/javascript/guides/angular/)
- [Sentry Node SDK](https://docs.sentry.io/platforms/node/)
- [Error monitoring service](../src/app/services/error-monitoring.service.ts)
