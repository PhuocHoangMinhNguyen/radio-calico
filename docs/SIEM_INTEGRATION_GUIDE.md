# SIEM Integration Guide

Centralize logs and security events from Radio Calico into a SIEM (Security Information and Event Management) system.

## Quick Setup - Elastic Stack (Free, Self-hosted)

**1. Install Elastic Stack**
```bash
docker run -d --name elasticsearch -p 9200:9200 -e "discovery.type=single-node" docker.elastic.co/elasticsearch/elasticsearch:8.11.0
docker run -d --name kibana -p 5601:5601 --link elasticsearch docker.elastic.co/kibana/kibana:8.11.0
```

**2. Forward Application Logs**
```javascript
// server.js - Add after error logging
const { Client } = require('@elastic/elasticsearch');
const client = new Client({ node: 'http://localhost:9200' });

// Send to Elasticsearch
await client.index({
  index: 'radio-calico-logs',
  document: {
    '@timestamp': new Date(),
    level: 'error',
    message: error.message,
    service: 'backend',
  },
});
```

**3. View in Kibana**
- Open http://localhost:5601
- Create index pattern: `radio-calico-logs*`
- View logs in Discover tab

## Alternative SIEMs

### Splunk (Enterprise)
```bash
# Install Splunk forwarder
docker run -d splunk/universalforwarder

# Configure inputs.conf
[monitor:///var/log/radio-calico]
disabled = false
index = main
```

### Datadog (Cloud)
```javascript
// server.js
const { logger } = require('dd-trace');
logger.error('Error message', { service: 'radio-calico' });
```

### AWS CloudWatch
```bash
# Install CloudWatch agent
aws cloudwatch put-log-events \
  --log-group-name /radio-calico/backend \
  --log-stream-name production \
  --log-events "timestamp=$(date +%s)000,message='Log message'"
```

## Essential Alerts

### Kibana Alert Rules

**1. High Error Rate:**
```
Condition: count() > 10 per 1 minute
Filter: level:error
Action: Email/Slack notification
```

**2. Security Events:**
```
Condition: any occurrence
Filter: event_type:(sql_injection_attempt OR xss_attempt)
Action: Page security team
```

**3. Rate Limit Abuse:**
```
Condition: count() > 50 per 1 hour
Filter: event_type:rate_limit_exceeded
Group by: client_ip
Action: Investigate + consider IP block
```

### Example Queries

**Recent errors (last hour):**
```
level:error AND @timestamp:[now-1h TO now]
```

**Security threats:**
```
event_type:(sql_injection_attempt OR xss_attempt OR rate_limit_exceeded)
```

**Slow API calls:**
```
service:backend AND response_time_ms:>2000
```

**Database issues:**
```
message:"connection" AND level:error
```

## Dashboard Setup

**Create Kibana dashboard with:**
1. **Error rate timeline** - Area chart of errors over time
2. **Top error messages** - Bar chart of most common errors
3. **Security events map** - Geographic distribution of threats
4. **API performance** - Line chart of p95 response times
5. **Rate limit violations** - Table of IPs exceeding limits

**Visualization Examples:**
- Errors by service: Pie chart grouped by `service` field
- Response time heatmap: Time-series heatmap of `response_time_ms`
- Top endpoints: Bar chart of `endpoint` field sorted by count

## Log Format

Send structured JSON logs:
```json
{
  "@timestamp": "2024-01-15T10:30:00.000Z",
  "service": "backend",
  "level": "error",
  "message": "Database connection failed",
  "error": {
    "type": "ConnectionError",
    "stack": "..."
  },
  "context": {
    "user_ip": "192.168.1.1",
    "endpoint": "/api/ratings",
    "response_time_ms": 1523
  }
}
```

## Resources

- [Elastic Stack docs](https://www.elastic.co/guide/index.html)
- [Splunk docs](https://docs.splunk.com/)
- [Datadog logs](https://docs.datadoghq.com/logs/)
