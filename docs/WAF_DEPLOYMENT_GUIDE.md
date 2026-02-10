# Web Application Firewall (WAF) Deployment Guide

This guide provides instructions for deploying and configuring a Web Application Firewall (WAF) to protect Radio Calico from common web attacks.

## Table of Contents

1. [Overview](#overview)
2. [WAF Solution Comparison](#waf-solution-comparison)
3. [Cloudflare WAF Setup](#cloudflare-waf-setup)
4. [AWS WAF Setup](#aws-waf-setup)
5. [ModSecurity (Open Source)](#modsecurity-open-source)
6. [WAF Rule Configuration](#waf-rule-configuration)
7. [Testing and Validation](#testing-and-validation)
8. [Monitoring and Tuning](#monitoring-and-tuning)
9. [Best Practices](#best-practices)

---

## Overview

### What is a WAF?

A Web Application Firewall (WAF) protects web applications by filtering and monitoring HTTP traffic between the application and the internet. It defends against common attacks like:
- SQL injection
- Cross-Site Scripting (XSS)
- Cross-Site Request Forgery (CSRF)
- File inclusion attacks
- DDoS attacks
- Bot attacks

### Why Deploy a WAF?

**Benefits:**
- **Protection:** Block malicious requests before they reach your application
- **Compliance:** Meet PCI DSS, HIPAA, and other regulatory requirements
- **Performance:** Cache static content and reduce origin server load
- **Visibility:** Detailed logging and analytics of attack patterns
- **Zero-day protection:** Virtual patching while developing permanent fixes

### Architecture

```
┌──────────┐      ┌──────────┐      ┌──────────────┐
│  Client  │─────>│   WAF    │─────>│ Radio Calico │
└──────────┘      └──────────┘      └──────────────┘
                       │
                       ├─> Block malicious requests
                       ├─> Rate limiting
                       ├─> Cache static content
                       └─> Log all requests
```

---

## WAF Solution Comparison

| Feature | Cloudflare | AWS WAF | ModSecurity | Imperva |
|---------|-----------|---------|-------------|---------|
| **Deployment** | Cloud/CDN | Cloud | Self-hosted | Cloud/Hybrid |
| **Cost** | Free - $200+/mo | $5/mo + usage | Free (OSS) | $$$ |
| **Ease of Setup** | Very Easy | Easy | Complex | Easy |
| **DDoS Protection** | Yes (included) | Separate service | Limited | Yes |
| **CDN** | Yes | No | No | Optional |
| **Bot Management** | Yes ($200+) | Basic | No | Yes |
| **Managed Rules** | Yes | Yes | OWASP CRS | Yes |
| **Custom Rules** | Yes | Yes | Yes | Yes |
| **Best For** | Most users | AWS-hosted | Advanced users | Enterprise |

**Recommendations:**
- **Budget & Simplicity:** Cloudflare Free/Pro
- **AWS-hosted:** AWS WAF
- **Full Control:** ModSecurity with nginx
- **Enterprise:** Imperva or Cloudflare Enterprise

---

## Cloudflare WAF Setup

### 1. Sign Up and Add Domain

**Steps:**
1. Go to [cloudflare.com](https://cloudflare.com)
2. Click "Sign Up" and create account
3. Click "Add a Site"
4. Enter your domain: `yourdomain.com`
5. Select plan:
   - **Free:** Basic protection
   - **Pro ($20/mo):** Advanced DDoS, WAF rules
   - **Business ($200/mo):** Custom rules, advanced bot protection

### 2. Update DNS

**Get Cloudflare nameservers:**
```
# Example:
ns1.cloudflare.com
ns2.cloudflare.com
```

**Update at your domain registrar:**
```
# Replace existing nameservers with Cloudflare's
nameserver ns1.cloudflare.com
nameserver ns2.cloudflare.com
```

**Wait for DNS propagation (up to 24 hours)**

### 3. Configure DNS Records

**In Cloudflare Dashboard:**
```
DNS Records:

A    @             <YOUR_SERVER_IP>     Proxied (orange cloud)
A    www           <YOUR_SERVER_IP>     Proxied (orange cloud)
CNAME api           @                    Proxied (orange cloud)

# Orange cloud = Traffic routed through Cloudflare (WAF enabled)
# Gray cloud = Direct to origin (no WAF)
```

### 4. Enable WAF Features

**Security → WAF:**
```
✅ Managed Ruleset
   - Cloudflare Managed Ruleset (recommended)
   - OWASP ModSecurity Core Rule Set

✅ Security Level: Medium (adjust based on traffic)

✅ Bot Fight Mode (Free plan)
   OR
✅ Super Bot Fight Mode (Pro+ plan)
```

**Additional Settings:**
```
Security → Settings:
✅ Security Level: Medium
✅ Challenge Passage: 30 minutes
✅ Browser Integrity Check: ON
✅ Privacy Pass Support: ON
```

### 5. Create Custom WAF Rules

**Security → WAF → Custom Rules:**

**Block SQL Injection Patterns:**
```
Rule Name: Block SQL Injection
Field: URI Path
Operator: contains
Value: ' OR 1=1--
      UNION SELECT
      DROP TABLE

Action: Block
```

**Rate Limiting for API:**
```
Rule Name: API Rate Limiting
Field: URI Path
Operator: starts with
Value: /api/

Requests: 100 requests
Period: 60 seconds
Action: Block
```

**Block Known Bad Bots:**
```
Rule Name: Block Bad Bots
Field: User Agent
Operator: contains any
Value: sqlmap
       nikto
       nmap
       masscan

Action: Block
```

**Geo-Blocking (optional):**
```
Rule Name: Block High-Risk Countries
Field: Country
Operator: is in
Value: [Countries with high attack rates]

Action: JS Challenge or Block
```

### 6. Page Rules (Caching)

**Rules → Page Rules:**

**Cache API Responses:**
```
URL: yourdomain.com/api/*
Settings:
- Cache Level: Bypass (don't cache API responses)
- Security Level: High
```

**Cache Static Assets:**
```
URL: yourdomain.com/*.js
     yourdomain.com/*.css
     yourdomain.com/*.png
     yourdomain.com/*.jpg
Settings:
- Cache Level: Cache Everything
- Edge Cache TTL: 1 month
```

### 7. SSL/TLS Configuration

**SSL/TLS → Overview:**
```
Encryption Mode: Full (strict)
```

**SSL/TLS → Edge Certificates:**
```
✅ Always Use HTTPS: ON
✅ Automatic HTTPS Rewrites: ON
✅ Minimum TLS Version: 1.2
```

### 8. Verify Configuration

**Test WAF is active:**
```bash
# Should be blocked by WAF
curl "https://yourdomain.com/api/ratings?title=test' OR 1=1--&artist=test"

# Check if proxied through Cloudflare
curl -I https://yourdomain.com
# Look for: cf-ray, cf-cache-status headers
```

---

## AWS WAF Setup

### 1. Create Web ACL

**AWS Console → WAF & Shield → Web ACLs → Create web ACL:**

```
Name: radio-calico-waf
Resource type: Regional (ALB, API Gateway) or CloudFront
Region: [Your region]

Associated Resources:
- Add your Application Load Balancer or CloudFront distribution
```

### 2. Add Managed Rule Groups

**Recommended managed rules:**
```
✅ AWS Managed Rules - Core Rule Set (CRS)
   - Protection against OWASP Top 10

✅ AWS Managed Rules - Known Bad Inputs
   - Blocks patterns associated with vulnerabilities

✅ AWS Managed Rules - SQL Database
   - SQL injection protection

✅ AWS Managed Rules - Linux OS
   - Protection against Linux-specific attacks

✅ AWS Managed Rules - IP Reputation List
   - Blocks known malicious IPs
```

### 3. Create Custom Rules

**Rule: Rate Limiting**

```json
{
  "Name": "RateLimitAPI",
  "Priority": 1,
  "Statement": {
    "RateBasedStatement": {
      "Limit": 2000,
      "AggregateKeyType": "IP",
      "ScopeDownStatement": {
        "ByteMatchStatement": {
          "FieldToMatch": {
            "UriPath": {}
          },
          "PositionalConstraint": "STARTS_WITH",
          "SearchString": "/api/"
        }
      }
    }
  },
  "Action": {
    "Block": {}
  },
  "VisibilityConfig": {
    "SampledRequestsEnabled": true,
    "CloudWatchMetricsEnabled": true,
    "MetricName": "RateLimitAPI"
  }
}
```

**Rule: Geo-Blocking**

```json
{
  "Name": "GeoBlock",
  "Priority": 2,
  "Statement": {
    "GeoMatchStatement": {
      "CountryCodes": ["CN", "RU", "KP"]
    }
  },
  "Action": {
    "Block": {}
  },
  "VisibilityConfig": {
    "SampledRequestsEnabled": true,
    "CloudWatchMetricsEnabled": true,
    "MetricName": "GeoBlock"
  }
}
```

### 4. Configure Logging

**AWS WAF → Logging:**

```bash
# Create S3 bucket for WAF logs
aws s3 mb s3://radio-calico-waf-logs

# Enable logging
aws wafv2 put-logging-configuration \
  --logging-configuration \
  ResourceArn=arn:aws:wafv2:region:account-id:regional/webacl/radio-calico-waf/id,\
  LogDestinationConfigs=arn:aws:s3:::radio-calico-waf-logs,\
  RedactedFields=[]
```

### 5. Set Up CloudWatch Alarms

```bash
# Alarm for blocked requests spike
aws cloudwatch put-metric-alarm \
  --alarm-name waf-blocked-requests-spike \
  --alarm-description "Alert when blocked requests exceed threshold" \
  --metric-name BlockedRequests \
  --namespace AWS/WAFV2 \
  --statistic Sum \
  --period 300 \
  --evaluation-periods 2 \
  --threshold 100 \
  --comparison-operator GreaterThanThreshold \
  --alarm-actions arn:aws:sns:region:account-id:security-alerts
```

---

## ModSecurity (Open Source)

### 1. Install ModSecurity with nginx

**Update `Dockerfile.nginx`:**

```dockerfile
FROM nginx:alpine

# Install ModSecurity dependencies
RUN apk add --no-cache \
    modsecurity-nginx \
    git

# Clone OWASP CRS
RUN git clone https://github.com/coreruleset/coreruleset.git /usr/local/modsecurity-crs

# Copy ModSecurity configuration
COPY modsecurity/modsecurity.conf /etc/nginx/modsecurity/
COPY modsecurity/crs-setup.conf /etc/nginx/modsecurity/

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80 443

CMD ["nginx", "-g", "daemon off;"]
```

### 2. Configure ModSecurity

**Create `modsecurity/modsecurity.conf`:**

```nginx
# ModSecurity configuration
SecRuleEngine On
SecRequestBodyAccess On
SecRequestBodyLimit 13107200
SecRequestBodyNoFilesLimit 131072
SecResponseBodyAccess Off

# Audit logging
SecAuditEngine RelevantOnly
SecAuditLog /var/log/nginx/modsec_audit.log

# Debug logging
SecDebugLog /var/log/nginx/modsec_debug.log
SecDebugLogLevel 0

# Default actions
SecDefaultAction "phase:1,pass,log,tag:'Local Lab Service'"
SecDefaultAction "phase:2,pass,log,tag:'Local Lab Service'"
```

### 3. Enable OWASP Core Rule Set

**Create `modsecurity/crs-setup.conf`:**

```nginx
# OWASP CRS configuration
Include /usr/local/modsecurity-crs/crs-setup.conf.example
Include /usr/local/modsecurity-crs/rules/*.conf

# Anomaly scoring
SecAction "id:900000,\
  phase:1,\
  nolog,\
  pass,\
  t:none,\
  setvar:tx.inbound_anomaly_score_threshold=5,\
  setvar:tx.outbound_anomaly_score_threshold=4"

# Paranoia level (1-4, higher = stricter)
SecAction "id:900001,\
  phase:1,\
  nolog,\
  pass,\
  t:none,\
  setvar:tx.paranoia_level=2"
```

### 4. Update nginx Configuration

**Add to `nginx.conf`:**

```nginx
http {
    # Enable ModSecurity
    modsecurity on;
    modsecurity_rules_file /etc/nginx/modsecurity/modsecurity.conf;

    server {
        listen 80;
        server_name _;

        # Rest of nginx configuration...
    }
}
```

### 5. Build and Deploy

```bash
# Build with ModSecurity
docker build -f Dockerfile.nginx -t radio-calico-nginx-waf .

# Update docker-compose.prod.yml to use new image
# Deploy
docker-compose -f docker-compose.prod.yml up -d
```

---

## WAF Rule Configuration

### Core Protection Rules

**1. SQL Injection Protection**
```
Block patterns:
- ' OR 1=1--
- UNION SELECT
- DROP TABLE
- INSERT INTO
- UPDATE SET
- DELETE FROM
```

**2. XSS Protection**
```
Block patterns:
- <script>
- javascript:
- onerror=
- onload=
- eval(
```

**3. Path Traversal Protection**
```
Block patterns:
- ../
- ..\\
- %2e%2e/
- %2e%2e\\
```

**4. Command Injection Protection**
```
Block patterns:
- ; ls
- | cat
- && whoami
- `command`
```

### Rate Limiting Rules

**API Endpoints:**
```
Path: /api/*
Limit: 100 requests per minute per IP
Action: Block for 5 minutes
```

**Login Endpoints (future):**
```
Path: /api/login
Limit: 5 attempts per minute per IP
Action: Challenge or block
```

### Geographic Rules

**Allow List (if using geo-restrictions):**
```
Allowed countries: US, CA, UK, EU countries
Action for others: Challenge or block
```

### Custom Application Rules

**Radio Calico Specific:**
```
Rule: Protect ratings endpoint
Condition: POST /api/ratings with non-JSON Content-Type
Action: Block

Rule: Limit error logging
Condition: POST /api/errors rate > 10/min from same IP
Action: Block

Rule: Block suspicious patterns in song titles
Condition: title/artist contains HTML, SQL, or script tags
Action: Block
```

---

## Testing and Validation

### 1. Functional Testing

**Verify legitimate traffic passes:**
```bash
# Normal request - should succeed
curl -X POST https://yourdomain.com/api/ratings \
  -H "Content-Type: application/json" \
  -d '{"title":"Test Song","artist":"Test Artist","rating":"up"}'

# Should return 200 OK
```

### 2. Security Testing

**SQL Injection - should be blocked:**
```bash
curl "https://yourdomain.com/api/ratings?title=test' OR 1=1--&artist=test"
# Expected: 403 Forbidden or WAF block page
```

**XSS Attack - should be blocked:**
```bash
curl -X POST https://yourdomain.com/api/ratings \
  -H "Content-Type: application/json" \
  -d '{"title":"<script>alert(1)</script>","artist":"Test","rating":"up"}'
# Expected: 403 Forbidden
```

**Rate Limiting - should block after threshold:**
```bash
# Send 105 requests rapidly
for i in {1..105}; do
  curl https://yourdomain.com/api/ratings?title=test&artist=test
done
# Expected: First 100 succeed, rest blocked
```

### 3. False Positive Testing

**Test edge cases that might trigger false positives:**
```bash
# Song title with apostrophe (O'Brien)
curl -X POST https://yourdomain.com/api/ratings \
  -H "Content-Type: application/json" \
  -d '{"title":"O'\''Brien","artist":"Test","rating":"up"}'
# Should succeed (apostrophe is valid in names)

# Special characters in artist name
curl -X POST https://yourdomain.com/api/ratings \
  -H "Content-Type: application/json" \
  -d '{"title":"Test","artist":"AC/DC","rating":"up"}'
# Should succeed
```

---

## Monitoring and Tuning

### Metrics to Monitor

**Cloudflare Analytics:**
- Total requests
- Blocked requests
- Threat types distribution
- Top blocked countries
- Cache hit ratio

**AWS CloudWatch:**
- `BlockedRequests` metric
- `AllowedRequests` metric
- Rule-specific metrics
- Sampled requests

### Reviewing Blocked Requests

**Cloudflare:**
```
Security → Events
- Filter by: Action = Block
- Review: URI, IP, Country, Rule
- Determine: Legitimate block or false positive
```

**AWS WAF:**
```bash
# Query WAF logs in S3
aws s3 cp s3://radio-calico-waf-logs/ . --recursive

# Analyze with jq
cat waf-logs.json | jq '.httpRequest.uri' | sort | uniq -c | sort -rn
```

### Tuning for False Positives

**If legitimate requests are blocked:**

**Cloudflare - Create Exception:**
```
Rule Name: Allow Apostrophes in Song Titles
Field: URI
Operator: equals
Value: /api/ratings
AND
Field: Request Body
Operator: contains
Value: {"title":"
Action: Skip WAF rules
```

**AWS WAF - Create Exception:**
```json
{
  "Name": "AllowApostrophes",
  "Priority": 0,
  "Statement": {
    "AndStatement": {
      "Statements": [
        {
          "ByteMatchStatement": {
            "FieldToMatch": {"UriPath": {}},
            "PositionalConstraint": "EQUALS",
            "SearchString": "/api/ratings"
          }
        }
      ]
    }
  },
  "Action": {
    "Allow": {}
  }
}
```

### Performance Optimization

**Cloudflare:**
- Enable caching for static assets
- Use Argo Smart Routing (paid)
- Enable HTTP/3 (QUIC)
- Optimize cache purge strategy

**ModSecurity:**
- Adjust paranoia level (lower = less strict, better performance)
- Disable unnecessary rules
- Tune anomaly scoring threshold

---

## Best Practices

### 1. Start in Monitor Mode

**Before blocking:**
```
1. Deploy WAF in log-only mode
2. Monitor for 1-2 weeks
3. Review false positives
4. Create exceptions
5. Enable blocking mode
```

### 2. Layer Defense

```
Internet → WAF → nginx → Application → Database

Each layer adds protection:
- WAF: Blocks common attacks
- nginx: Rate limiting, security headers
- Application: Input validation, parameterized queries
- Database: Permissions, encryption
```

### 3. Regular Review

```
Weekly:
- Review blocked requests
- Adjust false positives
- Update custom rules

Monthly:
- Review WAF logs and analytics
- Test WAF effectiveness
- Update managed rulesets

Quarterly:
- Conduct penetration testing with WAF enabled
- Review and update exception rules
- Evaluate WAF performance
```

### 4. Documentation

```
Maintain:
- List of custom rules and their purpose
- Exception rules and why they were added
- Known false positives
- Contact information for WAF support
```

### 5. Incident Response Integration

```
When attack detected:
1. WAF blocks automatically
2. Alert security team
3. Review attack patterns
4. Create/update rules
5. Document in incident report
```

---

## Resources

- [Cloudflare WAF Documentation](https://developers.cloudflare.com/waf/)
- [AWS WAF Documentation](https://docs.aws.amazon.com/waf/)
- [ModSecurity Documentation](https://github.com/SpiderLabs/ModSecurity)
- [OWASP Core Rule Set](https://coreruleset.org/)
- [OWASP WAF Best Practices](https://owasp.org/www-community/Web_Application_Firewall)

---

**Deployment Checklist**

```markdown
- [ ] WAF solution selected
- [ ] DNS updated (if using Cloudflare)
- [ ] Web ACL created and configured
- [ ] Managed rules enabled
- [ ] Custom rules created
- [ ] Rate limiting configured
- [ ] SSL/TLS configured
- [ ] Logging enabled
- [ ] Alerts configured
- [ ] Testing completed
- [ ] Documentation updated
- [ ] Team trained on WAF management
```
