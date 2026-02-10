# Security Testing & Penetration Testing Guide

This guide provides procedures for testing the security of Radio Calico, including OWASP Top 10 vulnerability assessments and API security testing.

## Table of Contents

1. [Automated Security Testing](#automated-security-testing)
2. [OWASP Top 10 Testing](#owasp-top-10-testing)
3. [API Security Testing](#api-security-testing)
4. [Infrastructure Security Testing](#infrastructure-security-testing)
5. [Tools and Setup](#tools-and-setup)
6. [Testing Checklist](#testing-checklist)

---

## Automated Security Testing

### 1. CodeQL Analysis (SAST)

CodeQL runs automatically on every push and PR. To run manually:

```bash
# Install CodeQL CLI
# https://github.com/github/codeql-cli-binaries/releases

# Create database
codeql database create codeql-db --language=javascript

# Run analysis
codeql database analyze codeql-db \
  --format=sarif-latest \
  --output=results.sarif \
  javascript-security-and-quality

# View results
codeql bqrs decode codeql-db/results/*.bqrs --format=text
```

### 2. Trivy Container Scanning

Scan Docker images for vulnerabilities:

```bash
# Scan production image
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
  aquasec/trivy image radio-calico:latest

# Scan with severity filter
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
  aquasec/trivy image --severity CRITICAL,HIGH radio-calico:latest

# Generate HTML report
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
  -v $(pwd):/output \
  aquasec/trivy image --format template --template "@contrib/html.tpl" \
  -o /output/trivy-report.html radio-calico:latest
```

### 3. npm Audit

Check for vulnerable dependencies:

```bash
# Full audit
npm audit

# Production dependencies only
npm audit --omit=dev

# Fix automatically (where possible)
npm audit fix

# Generate detailed report
npm audit --json > npm-audit-report.json
```

---

## OWASP Top 10 Testing

### A01:2021 – Broken Access Control

**Test for:**
- Unauthorized API access
- Missing authentication checks
- Insecure direct object references (IDOR)

**Testing procedures:**

```bash
# Test API without authentication (should work - endpoints are public)
curl http://localhost:3001/api/ratings?title=test&artist=test

# Test with malformed parameters
curl http://localhost:3001/api/ratings?title=&artist=

# Test SQL injection in parameters (should be protected by parameterized queries)
curl "http://localhost:3001/api/ratings?title=test'%20OR%201=1--&artist=test"
```

**Expected results:**
- All API endpoints are currently public (no auth)
- Parameterized queries should prevent SQL injection
- Input validation should reject empty/invalid parameters

### A02:2021 – Cryptographic Failures

**Test for:**
- Unencrypted sensitive data transmission
- Weak SSL/TLS configuration
- Missing HTTPS enforcement

**Testing procedures:**

```bash
# Test SSL/TLS configuration (when HTTPS is enabled)
nmap --script ssl-enum-ciphers -p 443 yourdomain.com

# Or use testssl.sh
./testssl.sh https://yourdomain.com

# Check for insecure protocols
sslscan yourdomain.com
```

**Expected results:**
- TLS 1.2 and 1.3 only (no TLS 1.0/1.1 or SSL)
- Strong cipher suites
- HSTS header present
- No mixed content warnings

### A03:2021 – Injection

**Test for:**
- SQL injection
- NoSQL injection
- Command injection
- XSS (Cross-Site Scripting)

**Testing procedures:**

```bash
# SQL injection in GET parameters
curl "http://localhost:3001/api/ratings?title=test'%20OR%201=1--&artist=test"
curl "http://localhost:3001/api/ratings?title=test;DROP%20TABLE%20song_ratings;--&artist=test"

# SQL injection in POST body
curl -X POST http://localhost:3001/api/ratings \
  -H "Content-Type: application/json" \
  -d '{"title":"test'\'' OR 1=1--","artist":"test","rating":"up"}'

# NoSQL injection attempts
curl -X POST http://localhost:3001/api/ratings \
  -H "Content-Type: application/json" \
  -d '{"title":{"$gt":""},"artist":"test","rating":"up"}'

# XSS in error messages
curl "http://localhost:3001/api/ratings?title=<script>alert('XSS')</script>&artist=test"
```

**Expected results:**
- All SQL injection attempts should fail (parameterized queries)
- XSS attempts should be escaped in responses
- Invalid JSON should return 400 error

### A04:2021 – Insecure Design

**Test for:**
- Missing rate limiting
- Lack of input validation
- Insufficient security controls

**Testing procedures:**

```bash
# Test rate limiting (should hit 429 after 100 requests)
for i in {1..105}; do
  echo "Request $i"
  curl -w "\nHTTP Status: %{http_code}\n" \
    http://localhost:3001/api/ratings?title=test&artist=test
done

# Test oversized request body
dd if=/dev/zero bs=2M count=1 | curl -X POST \
  http://localhost:3001/api/ratings \
  -H "Content-Type: application/json" \
  --data-binary @-

# Test invalid content types
curl -X POST http://localhost:3001/api/ratings \
  -H "Content-Type: text/plain" \
  -d '{"title":"test","artist":"test","rating":"up"}'
```

**Expected results:**
- Rate limiting should return 429 after 100 requests per minute
- Oversized requests should return 413 (Payload Too Large)
- Invalid content-type should return 400

### A05:2021 – Security Misconfiguration

**Test for:**
- Exposed debug information
- Default credentials
- Unnecessary features enabled
- Verbose error messages

**Testing procedures:**

```bash
# Check for debug endpoints
curl http://localhost:3001/debug
curl http://localhost:3001/api/debug

# Check error message verbosity
curl -X POST http://localhost:3001/api/ratings \
  -H "Content-Type: application/json" \
  -d 'invalid json'

# Check for information disclosure in headers
curl -I http://localhost:3001/

# Test for directory listing
curl http://localhost:3001/
curl http://localhost:3001/api/
```

**Expected results:**
- No debug endpoints should be accessible
- Error messages should not expose internal details
- Headers should not reveal technology stack
- Directory listing should be disabled

### A06:2021 – Vulnerable and Outdated Components

**Test for:**
- Outdated npm packages
- Vulnerable Docker base images
- Unpatched dependencies

**Testing procedures:**

```bash
# Check for vulnerable npm packages
npm audit

# Check for outdated packages
npm outdated

# Check Docker base image vulnerabilities
trivy image node:22-alpine

# Check for known CVEs
grype dir:.
```

**Expected results:**
- No critical or high severity vulnerabilities
- Dependabot should create PRs for updates
- Regular dependency updates

### A07:2021 – Identification and Authentication Failures

**Test for:**
- Weak session management
- Missing authentication
- Weak password policies

**Testing procedures:**

**Note:** Radio Calico currently has no authentication system. This section is for future implementation.

```bash
# Test for timing attacks on authentication
# (Not applicable - no auth system)

# Test for weak session tokens
# (Not applicable - no sessions)

# Test for password brute-forcing protection
# (Not applicable - no passwords)
```

**Expected results:**
- N/A - No authentication system currently implemented
- Rate limiting provides some protection against abuse

### A08:2021 – Software and Data Integrity Failures

**Test for:**
- Unsigned updates
- Insecure deserialization
- Missing integrity checks

**Testing procedures:**

```bash
# Check package-lock.json integrity
npm ci --legacy-peer-deps

# Verify Docker image signatures (when using signed images)
docker trust inspect radio-calico:latest

# Check for insecure deserialization
curl -X POST http://localhost:3001/api/errors \
  -H "Content-Type: application/json" \
  -d '{"__proto__":{"polluted":"true"},"session_id":"test","source":"app","severity":"error","message":"test"}'
```

**Expected results:**
- package-lock.json should ensure reproducible builds
- Deserialization attacks should be mitigated
- No prototype pollution vulnerabilities

### A09:2021 – Security Logging and Monitoring Failures

**Test for:**
- Missing security event logging
- Insufficient audit trails
- No alerting on suspicious activity

**Testing procedures:**

```bash
# Generate security events and check logs
# 1. Trigger rate limit
for i in {1..105}; do curl http://localhost:3001/api/ratings?title=test&artist=test; done

# 2. Trigger validation errors
curl -X POST http://localhost:3001/api/ratings -H "Content-Type: application/json" -d '{}'

# 3. Send oversized request
dd if=/dev/zero bs=2M count=1 | curl -X POST http://localhost:3001/api/ratings -H "Content-Type: application/json" --data-binary @-

# Check if events are logged
docker-compose -f docker-compose.prod.yml logs backend | grep -i "rate limit\|error\|validation"
```

**Expected results:**
- Security events should be logged
- Errors should be tracked in database
- Logs should include timestamps and IP addresses

### A10:2021 – Server-Side Request Forgery (SSRF)

**Test for:**
- Unvalidated URLs in user input
- Access to internal resources
- Cloud metadata access

**Testing procedures:**

**Note:** Radio Calico does not accept URLs from users, so SSRF risk is minimal.

```bash
# Test if backend can be tricked into making requests
curl -X POST http://localhost:3001/api/errors \
  -H "Content-Type: application/json" \
  -d '{"session_id":"http://169.254.169.254/latest/meta-data/","source":"app","severity":"error","message":"test"}'
```

**Expected results:**
- No user-controlled URLs are processed
- Internal network access should be restricted

---

## API Security Testing

### Rate Limiting Tests

```bash
# Test rate limit headers
curl -i http://localhost:3001/api/ratings?title=test&artist=test

# Should see:
# X-RateLimit-Limit: 100
# X-RateLimit-Remaining: 99
# X-RateLimit-Reset: [timestamp]

# Exceed rate limit
for i in {1..101}; do
  curl -w "Request $i: HTTP %{http_code}\n" \
    http://localhost:3001/api/ratings?title=test&artist=test
done

# Should see 429 on request 101 with Retry-After header
```

### Input Validation Tests

```bash
# Test required fields
curl -X POST http://localhost:3001/api/ratings \
  -H "Content-Type: application/json" \
  -d '{}'

# Test invalid rating value
curl -X POST http://localhost:3001/api/ratings \
  -H "Content-Type: application/json" \
  -d '{"title":"test","artist":"test","rating":"invalid"}'

# Test oversized fields
curl -X POST http://localhost:3001/api/ratings \
  -H "Content-Type: application/json" \
  -d "{\"title\":\"$(python3 -c 'print("A"*300)')\",\"artist\":\"test\",\"rating\":\"up\"}"
```

### CORS Testing

```bash
# Test CORS headers (dev mode)
curl -H "Origin: http://evil.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -X OPTIONS \
  http://localhost:3001/api/ratings

# Should only allow http://localhost:3000 in dev mode
```

---

## Infrastructure Security Testing

### Docker Security

```bash
# Scan for vulnerabilities
trivy image radio-calico:latest

# Check for running as non-root
docker inspect radio-calico:latest | jq '.[0].Config.User'
# Should not be empty or "root"

# Check for exposed secrets
trivy fs --scanners secret .
```

### nginx Security

```bash
# Test security headers
curl -I http://localhost:8080/

# Should see:
# X-Content-Type-Options: nosniff
# X-Frame-Options: DENY
# X-XSS-Protection: 1; mode=block
# Referrer-Policy: strict-origin-when-cross-origin
# Content-Security-Policy: ...
# Permissions-Policy: ...

# Test CSP
curl -I http://localhost:8080/ | grep -i "content-security-policy"

# Test for clickjacking
curl http://localhost:8080/ | grep -i "x-frame-options"
```

### Database Security

```bash
# Test PostgreSQL connection limits
# Should not be accessible from outside Docker network

# Test for default credentials (should fail)
PGPASSWORD=postgres psql -h localhost -U postgres -d radio_calico -c "SELECT version();"

# Check for SQL injection protection
# (Already covered in OWASP A03 section)
```

---

## Tools and Setup

### Required Tools

```bash
# Install security testing tools

# nmap (network scanning)
sudo apt-get install nmap

# curl (API testing)
sudo apt-get install curl

# jq (JSON parsing)
sudo apt-get install jq

# Trivy (container scanning)
curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh | sh -s -- -b /usr/local/bin

# OWASP ZAP (web app scanning)
# Download from https://www.zaproxy.org/download/

# Burp Suite Community (web app testing)
# Download from https://portswigger.net/burp/communitydownload

# sqlmap (SQL injection testing)
sudo apt-get install sqlmap

# nikto (web server scanning)
sudo apt-get install nikto
```

### OWASP ZAP Automated Scan

```bash
# Start ZAP in daemon mode
zap.sh -daemon -port 8090 -config api.disablekey=true

# Run baseline scan
zap-baseline.py -t http://localhost:8080 -r zap-report.html

# Run full scan
zap-full-scan.py -t http://localhost:8080 -r zap-full-report.html
```

### Nikto Web Server Scan

```bash
# Scan web server
nikto -h http://localhost:8080 -output nikto-report.html -Format html
```

---

## Testing Checklist

### Pre-Deployment Checklist

- [ ] Run `npm audit` and fix all critical/high vulnerabilities
- [ ] Run Trivy scan on Docker images
- [ ] Run CodeQL analysis
- [ ] Verify all security headers are present
- [ ] Test rate limiting on all API endpoints
- [ ] Verify input validation on all POST endpoints
- [ ] Check CSP doesn't block legitimate resources
- [ ] Test HTTPS configuration (when enabled)
- [ ] Verify HSTS header (when HTTPS enabled)
- [ ] Run OWASP ZAP baseline scan
- [ ] Review all security logs
- [ ] Test error handling doesn't leak information

### Quarterly Security Audit

- [ ] Review and update dependencies
- [ ] Scan for vulnerabilities with multiple tools
- [ ] Test for OWASP Top 10 vulnerabilities
- [ ] Review security logs for anomalies
- [ ] Penetration testing of API endpoints
- [ ] Review and rotate credentials
- [ ] Audit database access patterns
- [ ] Review nginx configuration
- [ ] Test backup and recovery procedures
- [ ] Update security documentation

### After Major Changes

- [ ] Re-run all security scans
- [ ] Test new endpoints for vulnerabilities
- [ ] Update threat model
- [ ] Review security impact of changes
- [ ] Update security documentation

---

## Reporting Vulnerabilities

If you discover a security vulnerability in Radio Calico:

1. **Do not** create a public GitHub issue
2. Send details to the maintainer via private communication
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if available)
4. Allow reasonable time for a fix before public disclosure

---

## Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [OWASP Testing Guide](https://owasp.org/www-project-web-security-testing-guide/)
- [OWASP API Security Top 10](https://owasp.org/www-project-api-security/)
- [OWASP ZAP Documentation](https://www.zaproxy.org/docs/)
- [Burp Suite Documentation](https://portswigger.net/burp/documentation)
- [Trivy Documentation](https://aquasecurity.github.io/trivy/)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)
