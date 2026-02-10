# Security Policy

## Supported Versions

We release patches for security vulnerabilities in the following versions:

| Version | Supported          |
| ------- | ------------------ |
| latest  | :white_check_mark: |

## Reporting a Vulnerability

We take the security of Radio Calico seriously. If you have discovered a security vulnerability, please report it to us as described below.

### Where to Report

**Please do NOT report security vulnerabilities through public GitHub issues.**

Instead, please report them via one of the following methods:

1. **Preferred**: Open a [GitHub Security Advisory](https://github.com/PhuocHoangMinhNguyen/radio-calico/security/advisories/new)
2. **Alternative**: Email the repository owner directly through their GitHub profile

### What to Include

Please include the following information in your report:

- Type of issue (e.g., SQL injection, XSS, CSRF, etc.)
- Full paths of source file(s) related to the manifestation of the issue
- The location of the affected source code (tag/branch/commit or direct URL)
- Any special configuration required to reproduce the issue
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the issue, including how an attacker might exploit it

### What to Expect

- We will acknowledge receipt of your vulnerability report within 48 hours
- We will send a more detailed response within 7 days indicating the next steps in handling your report
- We will keep you informed of the progress towards a fix and full announcement
- We may ask for additional information or guidance

## Security Measures

Radio Calico implements multiple layers of security:

### Application Security
- **Input Validation**: All API endpoints validate and sanitize input
- **SQL Injection Prevention**: Parameterized queries for all database operations
- **XSS Protection**: Angular's built-in sanitization + Content Security Policy headers
- **CSRF Protection**: API rate limiting and request validation
- **Size Limits**: Request size limits on all endpoints (see CLAUDE.md for configuration)

### Infrastructure Security
- **Rate Limiting**: 100 requests per IP per minute on all `/api/*` endpoints
- **Security Headers**: X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, Referrer-Policy, Permissions-Policy
- **Content Security Policy**: Restricts resource loading to trusted domains
- **TLS/HTTPS Ready**: Pre-configured nginx SSL/TLS with modern cipher suites (requires certificates)
- **Non-root Containers**: All Docker containers run as non-root users
- **Resource Limits**: CPU and memory limits on all production services

### Development Security
- **Automated Scanning**:
  - npm audit runs on every push/PR and weekly scheduled scans
  - Trivy container scanning for Docker image vulnerabilities
  - CodeQL SAST scanning for code vulnerabilities
  - Dependabot automated dependency updates
- **Secret Scanning**: Guide provided for GitHub secret scanning setup
- **Security Testing**: OWASP Top 10 testing procedures documented

### Data Security
- **Password Protection**: Database credentials stored in environment variables, never in code
- **Session Isolation**: Error logs grouped by session ID with 30-day auto-deletion
- **IP Anonymization**: Vote deduplication uses hashed IPs (PostgreSQL backend)
- **Data Retention**: Automatic cleanup of error logs older than 30 days

## Security Event Logging

All security-related events are logged to both console and the `error_logs` database table:
- Rate limit violations
- Invalid content-type headers
- Oversized requests
- Validation failures
- Suspicious patterns (SQL injection attempts, XSS attempts)

See `CLAUDE.md` Security Feature Configuration section for details on viewing security logs.

## Security Documentation

Comprehensive security guides are available in the `docs/` directory:
- `SECRET_SCANNING_SETUP.md` - GitHub secret scanning configuration
- `SECURITY_TESTING_GUIDE.md` - OWASP Top 10 testing procedures
- `PENETRATION_TESTING_GUIDE.md` - Professional security audit planning
- `SIEM_INTEGRATION_GUIDE.md` - Security information and event management
- `INCIDENT_RESPONSE.md` - Incident response procedures and templates
- `WAF_DEPLOYMENT_GUIDE.md` - Web Application Firewall deployment

## Disclosure Policy

When we receive a security bug report, we will:

1. Confirm the problem and determine the affected versions
2. Audit code to find any similar problems
3. Prepare fixes for all supported versions
4. Release new security fix versions as soon as possible

## Known Limitations

Current security limitations and future enhancements:
- HTTPS/TLS requires SSL certificate provisioning (configuration ready, see `nginx.conf`)
- Professional penetration testing requires budget allocation (guide provided)
- Secret scanning requires manual enablement in GitHub settings (guide provided)
- SIEM integration requires infrastructure setup (guide provided)
- WAF deployment requires service selection (guide provided)

See `CLAUDE.md` Security Roadmap section for complete details.

## Comments on this Policy

If you have suggestions on how this process could be improved, please submit a pull request or open an issue.
