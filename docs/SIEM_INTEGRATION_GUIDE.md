# SIEM Integration Guide

This guide provides instructions for integrating Radio Calico with Security Information and Event Management (SIEM) solutions for centralized security monitoring, log aggregation, and threat detection.

## Table of Contents

1. [Overview](#overview)
2. [SIEM Solution Comparison](#siem-solution-comparison)
3. [Elastic Stack (ELK) Integration](#elastic-stack-elk-integration)
4. [Splunk Integration](#splunk-integration)
5. [Datadog Integration](#datadog-integration)
6. [AWS Security Hub Integration](#aws-security-hub-integration)
7. [Log Formats and Schemas](#log-formats-and-schemas)
8. [Alerting Rules](#alerting-rules)
9. [Dashboards](#dashboards)
10. [Maintenance and Tuning](#maintenance-and-tuning)

---

## Overview

### Why SIEM?

**Benefits:**
- **Centralized logging:** All logs in one place
- **Real-time monitoring:** Detect threats as they happen
- **Historical analysis:** Investigate past incidents
- **Compliance:** Meet audit and regulatory requirements
- **Automation:** Auto-respond to security events

**Radio Calico Log Sources:**
- Application logs (Node.js backend)
- nginx access/error logs
- Security event logs
- Docker container logs
- Database audit logs
- GitHub Actions logs

### Architecture

```
┌─────────────────┐
│  Radio Calico   │
│   (Docker)      │
└────────┬────────┘
         │ Logs
         ↓
┌─────────────────┐
│   Log Shipper   │
│ (Filebeat/      │
│  Fluentd)       │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│  SIEM Platform  │
│ (Elastic/Splunk)│
└─────────────────┘
```

---

## SIEM Solution Comparison

| Feature | Elastic Stack | Splunk | Datadog | AWS Security Hub |
|---------|---------------|--------|---------|------------------|
| **Cost** | Free (self-hosted) | $$ | $$$ | $ |
| **Deployment** | Self-hosted or cloud | Cloud/Enterprise | Cloud | AWS Cloud |
| **Ease of Setup** | Medium | Easy | Easy | Easy |
| **Scalability** | High | High | High | High |
| **Learning Curve** | Medium | Low | Low | Low |
| **Custom Dashboards** | Yes | Yes | Yes | Limited |
| **Alert** ing** | Yes | Yes | Yes | Yes |
| **Log Retention** | Configurable | Configurable | 15 days default | 90 days |
| **Best For** | Custom deployments | Enterprise | Cloud-native apps | AWS-hosted apps |

**Recommendations:**
- **Budget-conscious:** Elastic Stack (self-hosted)
- **Enterprise:** Splunk
- **Cloud-native:** Datadog
- **AWS-hosted:** AWS Security Hub + CloudWatch

---

## Elastic Stack (ELK) Integration

### Architecture

```
Radio Calico → Filebeat → Logstash → Elasticsearch → Kibana
```

### 1. Deploy Elastic Stack

**Docker Compose setup:**

Create `docker-compose.elk.yml`:

```yaml
version: '3.8'

services:
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.11.0
    container_name: elasticsearch
    environment:
      - discovery.type=single-node
      - "ES_JAVA_OPTS=-Xms512m -Xmx512m"
      - xpack.security.enabled=false
    ports:
      - "9200:9200"
    volumes:
      - elasticsearch_data:/usr/share/elasticsearch/data
    networks:
      - elk

  logstash:
    image: docker.elastic.co/logstash/logstash:8.11.0
    container_name: logstash
    volumes:
      - ./logstash/pipeline:/usr/share/logstash/pipeline
    ports:
      - "5044:5044"
    environment:
      - "LS_JAVA_OPTS=-Xms256m -Xmx256m"
    networks:
      - elk
    depends_on:
      - elasticsearch

  kibana:
    image: docker.elastic.co/kibana/kibana:8.11.0
    container_name: kibana
    ports:
      - "5601:5601"
    environment:
      - ELASTICSEARCH_HOSTS=http://elasticsearch:9200
    networks:
      - elk
    depends_on:
      - elasticsearch

  filebeat:
    image: docker.elastic.co/beats/filebeat:8.11.0
    container_name: filebeat
    user: root
    volumes:
      - ./filebeat/filebeat.yml:/usr/share/filebeat/filebeat.yml:ro
      - /var/lib/docker/containers:/var/lib/docker/containers:ro
      - /var/run/docker.sock:/var/run/docker.sock:ro
    command: filebeat -e -strict.perms=false
    networks:
      - elk
    depends_on:
      - logstash

volumes:
  elasticsearch_data:

networks:
  elk:
    driver: bridge
```

### 2. Configure Filebeat

Create `filebeat/filebeat.yml`:

```yaml
filebeat.inputs:
  # Application logs from Docker containers
  - type: container
    paths:
      - '/var/lib/docker/containers/*/*.log'
    processors:
      - add_docker_metadata:
          host: "unix:///var/run/docker.sock"
      - decode_json_fields:
          fields: ["message"]
          target: ""
          overwrite_keys: true

# Parse security events
processors:
  - if:
      contains:
        message: "SECURITY EVENT"
    then:
      - decode_json_fields:
          fields: ["message"]
          target: "security_event"
      - add_fields:
          target: ''
          fields:
            event.category: security
            event.type: alert

output.logstash:
  hosts: ["logstash:5044"]

logging.level: info
```

### 3. Configure Logstash

Create `logstash/pipeline/radio-calico.conf`:

```ruby
input {
  beats {
    port => 5044
  }
}

filter {
  # Parse security events
  if [security_event] {
    mutate {
      add_field => {
        "[@metadata][index]" => "security-events"
      }
    }
  }

  # Parse nginx access logs
  if [container][name] == "nginx" {
    grok {
      match => {
        "message" => '%{IPORHOST:client_ip} - %{USER:ident} \[%{HTTPDATE:timestamp}\] "%{WORD:method} %{URIPATHPARAM:request} HTTP/%{NUMBER:http_version}" %{NUMBER:status_code} %{NUMBER:bytes} "%{DATA:referrer}" "%{DATA:user_agent}"'
      }
    }
    date {
      match => ["timestamp", "dd/MMM/yyyy:HH:mm:ss Z"]
      target => "@timestamp"
    }
    geoip {
      source => "client_ip"
    }
  }

  # Parse Node.js application logs
  if [container][name] == "backend" or [container][name] == "app" {
    if [message] =~ /^\{/ {
      json {
        source => "message"
      }
    }
  }
}

output {
  elasticsearch {
    hosts => ["elasticsearch:9200"]
    index => "radio-calico-%{+YYYY.MM.dd}"
  }

  # Separate index for security events
  if [@metadata][index] == "security-events" {
    elasticsearch {
      hosts => ["elasticsearch:9200"]
      index => "security-events-%{+YYYY.MM.dd}"
    }
  }

  stdout { codec => rubydebug }
}
```

### 4. Start the ELK Stack

```bash
# Start Elastic Stack
docker-compose -f docker-compose.elk.yml up -d

# Verify Elasticsearch is running
curl http://localhost:9200

# Access Kibana
open http://localhost:5601
```

### 5. Create Kibana Dashboards

**Index Patterns:**
```
radio-calico-*
security-events-*
```

**Sample Dashboard Visualizations:**
1. **Security Events Timeline**
   - Type: Line chart
   - Metric: Count of security events
   - Time field: @timestamp
   - Group by: event_type

2. **Top Security Event Types**
   - Type: Pie chart
   - Metric: Count
   - Split slices: event_type

3. **Geographic Map of Requests**
   - Type: Coordinate map
   - Metric: Count
   - Geo coordinates: geoip.location

4. **API Response Codes**
   - Type: Vertical bar chart
   - Metric: Count
   - X-axis: status_code

---

## Splunk Integration

### 1. Install Splunk Universal Forwarder

**On Docker host:**

```bash
# Download Splunk Universal Forwarder
wget -O splunkforwarder.tgz \
  'https://www.splunk.com/bin/splunk/DownloadActivityServlet?architecture=x86_64&platform=linux&version=9.1.2&product=universalforwarder&filename=splunkforwarder-9.1.2-b6b9c8185839-Linux-x86_64.tgz'

# Extract
tar xvzf splunkforwarder.tgz -C /opt

# Start forwarder
cd /opt/splunkforwarder/bin
./splunk start --accept-license
```

### 2. Configure Inputs

Create `/opt/splunkforwarder/etc/system/local/inputs.conf`:

```ini
[default]
host = radio-calico-prod

# Monitor Docker container logs
[monitor:///var/lib/docker/containers/*/*-json.log]
disabled = false
sourcetype = docker:container
index = main

# Monitor nginx logs
[monitor:///var/log/nginx/access.log]
disabled = false
sourcetype = nginx:access
index = main

[monitor:///var/log/nginx/error.log]
disabled = false
sourcetype = nginx:error
index = main
```

### 3. Configure Forwarding

Create `/opt/splunkforwarder/etc/system/local/outputs.conf`:

```ini
[tcpout]
defaultGroup = splunk_indexers

[tcpout:splunk_indexers]
server = your-splunk-server:9997
```

### 4. Restart Forwarder

```bash
/opt/splunkforwarder/bin/splunk restart
```

### 5. Create Splunk Dashboards

**SPL Queries:**

```spl
# Security events over time
index=main sourcetype=docker:container "SECURITY EVENT"
| timechart count by event_type

# Rate limit violations
index=main sourcetype=docker:container event_type=rate_limit_exceeded
| stats count by client_ip
| sort -count

# SQL injection attempts
index=main sourcetype=docker:container event_type=sql_injection_attempt
| table timestamp, client_ip, path, title, artist

# Top API endpoints
index=main sourcetype=nginx:access
| stats count by request
| sort -count
| head 10
```

---

## Datadog Integration

### 1. Install Datadog Agent

**Docker Compose integration:**

Add to `docker-compose.prod.yml`:

```yaml
services:
  datadog:
    image: gcr.io/datadoghq/agent:latest
    container_name: datadog-agent
    environment:
      - DD_API_KEY=${DD_API_KEY}
      - DD_SITE=datadoghq.com
      - DD_LOGS_ENABLED=true
      - DD_LOGS_CONFIG_CONTAINER_COLLECT_ALL=true
      - DD_CONTAINER_EXCLUDE="name:datadog-agent"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - /proc/:/host/proc/:ro
      - /sys/fs/cgroup/:/host/sys/fs/cgroup:ro
      - /var/lib/docker/containers:/var/lib/docker/containers:ro
    networks:
      - radio_calico_network_prod
```

### 2. Configure Log Processing

Create `datadog/conf.d/radio-calico.yaml`:

```yaml
logs:
  - type: docker
    service: radio-calico
    source: nodejs

  - type: docker
    service: radio-calico-nginx
    source: nginx

  # Parse security events
  - type: docker
    service: radio-calico
    source: security-events
    log_processing_rules:
      - type: include_at_match
        name: security_events
        pattern: 'SECURITY EVENT'
```

### 3. Set Up Monitors

**Rate Limit Monitor:**
```json
{
  "name": "High rate of rate limit violations",
  "type": "log alert",
  "query": "logs(\"service:radio-calico event_type:rate_limit_exceeded\").rollup(\"count\").by(\"client_ip\").last(\"5m\") > 10",
  "message": "IP {{client_ip.name}} has exceeded rate limits 10+ times in 5 minutes",
  "tags": ["security", "rate-limiting"],
  "priority": 2
}
```

**SQL Injection Monitor:**
```json
{
  "name": "SQL Injection Attempt Detected",
  "type": "log alert",
  "query": "logs(\"service:radio-calico event_type:sql_injection_attempt\").rollup(\"count\").last(\"1m\") > 0",
  "message": "SQL injection attempt detected from {{client_ip.name}}",
  "tags": ["security", "critical"],
  "priority": 1
}
```

---

## AWS Security Hub Integration

### 1. Enable Security Hub

```bash
# Enable Security Hub
aws securityhub enable-security-hub

# Enable integrations
aws securityhub batch-enable-standards \
  --standards-subscription-requests StandardsArn=arn:aws:securityhub:::ruleset/cis-aws-foundations-benchmark/v/1.2.0
```

### 2. Configure CloudWatch Logs

**Log Group:**
```bash
# Create log group
aws logs create-log-group --log-group-name /radio-calico/security-events

# Set retention
aws logs put-retention-policy \
  --log-group-name /radio-calico/security-events \
  --retention-in-days 90
```

### 3. Stream Logs to CloudWatch

Update `docker-compose.prod.yml`:

```yaml
services:
  backend:
    logging:
      driver: awslogs
      options:
        awslogs-group: /radio-calico/security-events
        awslogs-region: us-east-1
        awslogs-stream-prefix: backend
```

### 4. Create Metric Filters

```bash
# Rate limit violations
aws logs put-metric-filter \
  --log-group-name /radio-calico/security-events \
  --filter-name RateLimitViolations \
  --filter-pattern '[timestamp, level, event="SECURITY EVENT", rest="*rate_limit_exceeded*"]' \
  --metric-transformations \
    metricName=RateLimitCount,metricNamespace=RadioCalico,metricValue=1

# SQL injection attempts
aws logs put-metric-filter \
  --log-group-name /radio-calico/security-events \
  --filter-name SQLInjectionAttempts \
  --filter-pattern '[timestamp, level, event="SECURITY EVENT", rest="*sql_injection_attempt*"]' \
  --metric-transformations \
    metricName=SQLInjectionCount,metricNamespace=RadioCalico,metricValue=1
```

---

## Log Formats and Schemas

### Security Event Schema

```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "level": "warn",
  "message": "🔒 SECURITY EVENT: {...}",
  "event_type": "rate_limit_exceeded",
  "client_ip": "192.168.1.100",
  "method": "POST",
  "path": "/api/ratings",
  "user_agent": "Mozilla/5.0...",
  "request_count": 101,
  "limit": 100,
  "retry_after": 45
}
```

### nginx Access Log Schema

```
192.168.1.100 - - [15/Jan/2024:10:30:00 +0000] "POST /api/ratings HTTP/1.1" 200 123 "-" "Mozilla/5.0..."
```

### Application Error Log Schema

```json
{
  "level": "error",
  "message": "Database error",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "stack": "Error: ...",
  "context": {
    "endpoint": "/api/ratings",
    "method": "POST"
  }
}
```

---

## Alerting Rules

### Critical Alerts

**1. SQL Injection Attempt**
```yaml
rule_name: sql_injection_detected
condition: event_type == "sql_injection_attempt"
severity: critical
action:
  - email: security@yourdomain.com
  - slack: #security-alerts
  - pagerduty: security-team
```

**2. Multiple Failed Authentication** (future)
```yaml
rule_name: brute_force_attempt
condition: failed_auth_count > 10 in 5 minutes
severity: high
action:
  - email: security@yourdomain.com
  - block_ip: true
```

### Warning Alerts

**3. High Rate Limit Violations**
```yaml
rule_name: rate_limit_abuse
condition: rate_limit_exceeded > 5 in 1 minute from same IP
severity: medium
action:
  - email: ops@yourdomain.com
```

**4. Unusual Traffic Patterns**
```yaml
rule_name: traffic_spike
condition: request_rate > 1000/min
severity: medium
action:
  - email: ops@yourdomain.com
```

---

## Dashboards

### Security Overview Dashboard

**Metrics:**
- Total security events (24h)
- Security events by type (pie chart)
- Security events timeline (line chart)
- Top offending IPs (table)
- Geographic distribution (map)

**Queries:**
```
event.category:security
| stats count by event_type
| timechart count by event_type
```

### API Performance Dashboard

**Metrics:**
- Requests per second
- Average response time
- Error rate
- Status code distribution
- Top endpoints

### Infrastructure Dashboard

**Metrics:**
- Container CPU/Memory usage
- Database connections
- Disk I/O
- Network traffic

---

## Maintenance and Tuning

### 1. Log Rotation

**Elasticsearch:**
```bash
# Delete indices older than 30 days
curator_cli --host elasticsearch delete-indices \
  --filter_list '[{"filtertype":"age","source":"creation_date","direction":"older","unit":"days","unit_count":30}]'
```

**Splunk:**
```ini
[default]
frozenTimePeriodInSecs = 2592000  # 30 days
```

### 2. Index Optimization

**Elasticsearch:**
```bash
# Force merge old indices
curl -X POST "localhost:9200/radio-calico-*/_forcemerge?max_num_segments=1"
```

### 3. Alert Tuning

**Reduce false positives:**
- Whitelist known IPs
- Adjust thresholds based on baseline
- Add context to alerts

**Example:**
```yaml
# Ignore rate limits from known monitoring services
rule_name: rate_limit_abuse
condition: rate_limit_exceeded > 5 AND client_ip NOT IN monitoring_ips
```

### 4. Performance Monitoring

**Monitor SIEM performance:**
- Indexing rate
- Query performance
- Storage usage
- System resources

```bash
# Elasticsearch cluster health
curl http://localhost:9200/_cluster/health?pretty

# Index stats
curl http://localhost:9200/_cat/indices?v
```

---

## Resources

- [Elastic Stack Documentation](https://www.elastic.co/guide/index.html)
- [Splunk Documentation](https://docs.splunk.com/)
- [Datadog Log Management](https://docs.datadoghq.com/logs/)
- [AWS Security Hub](https://docs.aws.amazon.com/securityhub/)
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
