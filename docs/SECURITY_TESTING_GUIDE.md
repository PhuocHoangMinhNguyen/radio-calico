# Security Testing Guide

OWASP Top 10 testing procedures for Radio Calico.

## Automated Scanning

```bash
# Dependency vulnerabilities
pnpm audit
docker scan radio-calico:latest

# Web app scan
docker run -t zaproxy/zap-baseline.py -t http://localhost:3000
```

## Manual Testing

### A01: Broken Access Control
```bash
# Test unauthorized access
curl http://localhost:3001/api/admin  # Should return 403/401

# Test parameter tampering
curl "http://localhost:3001/api/ratings?user_id=OTHER_USER"
```

### A02: SQL Injection
```bash
# Test injection in query params
curl "http://localhost:3001/api/ratings?title=test' OR 1=1--&artist=test"
# Should be blocked or safely handled

# Test in POST body
curl -X POST http://localhost:3001/api/ratings \
  -H "Content-Type: application/json" \
  -d '{"title": "test\"; DROP TABLE users--", "artist": "test"}'
```

### A03: XSS (Cross-Site Scripting)
```bash
# Test reflected XSS
curl "http://localhost:3000/search?q=<script>alert('XSS')</script>"

# Test stored XSS (via rating)
curl -X POST http://localhost:3001/api/ratings \
  -d '{"title": "<script>alert(1)</script>", "artist": "test"}'
```

### A04: CSRF (Cross-Site Request Forgery)
- Check for CSRF tokens on state-changing operations
- Test with curl without tokens
- Verify SameSite cookie attribute

### A05: Security Misconfiguration
```bash
# Check headers
curl -I http://localhost:3000
# Should have: X-Content-Type-Options, X-Frame-Options, CSP

# Check for exposed secrets
grep -r "password\|secret\|key" .env
```

### A06: Rate Limiting
```bash
# Test rate limits (100 req/min)
for i in {1..105}; do 
  curl http://localhost:3001/api/ratings?title=test&artist=test
done
# Should get 429 after 100 requests
```

### A07: Authentication Testing
- Test password complexity requirements
- Test account lockout
- Test session timeout
- Test concurrent sessions

### A08: Input Validation
```bash
# Test request size limits
dd if=/dev/zero bs=5M count=1 | \
  curl -X POST http://localhost:3001/api/ratings \
  -H "Content-Type: application/json" --data-binary @-
# Should return 413

# Test invalid content-type
curl -X POST http://localhost:3001/api/ratings \
  -H "Content-Type: text/plain" -d "test"
# Should return 400
```

## Regression Testing

Run after each release:
```bash
# 1. Dependency scan
pnpm audit

# 2. Container scan  
docker scan radio-calico:latest

# 3. OWASP ZAP baseline
zap-baseline.py -t http://localhost:3000

# 4. Manual smoke tests
- SQL injection attempt
- XSS attempt  
- Rate limiting
- CSRF tokens present
```

## CI/CD Integration

Add to `.github/workflows/security.yml`:
```yaml
- name: Security tests
  run: |
    pnpm audit --audit-level=moderate
    docker scan radio-calico:latest
```

## Resources

- [OWASP Testing Guide](https://owasp.org/www-project-web-security-testing-guide/)
- [OWASP ZAP](https://www.zaproxy.org/)
- [Burp Suite](https://portswigger.net/burp)
