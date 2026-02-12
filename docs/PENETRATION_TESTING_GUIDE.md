# Penetration Testing Guide

Guide for conducting professional security assessments of Radio Calico.

## Pre-Engagement

### Scope Definition
- **In scope:** Web app, API endpoints, database
- **Out of scope:** Infrastructure, third-party services, social engineering
- **Testing window:** Off-peak hours preferred
- **Contacts:** Technical lead, security team

### Legal Requirements
- Signed authorization letter (specifies scope, dates, contacts)
- Rules of engagement document (what's allowed/forbidden)
- NDA if required (protect sensitive findings)
- Insurance certificate (for external testers, $1M+ coverage typical)

### Vendor Selection (External Testing)

**Evaluation criteria:**
1. **Certifications:** OSCP, CEH, GPEN, GWAPT
2. **Experience:** 3+ years, web app/API testing
3. **References:** Check 2-3 previous clients
4. **Sample reports:** Verify quality and detail
5. **Cost:** $5k-$20k typical for 1-2 week audit
6. **Methodology:** Ask about OWASP, PTES compliance

**Recommended firms:**
- Cure53 (Europe)
- NCC Group (Global)
- Bishop Fox (US)
- Trail of Bits (US)

## Testing Phases

### 1. Reconnaissance (Information Gathering)
```bash
# Discover subdomains
subfinder -d example.com

# Port scanning
nmap -sV -p- example.com

# Technology stack
whatweb https://example.com
wappalyzer

# Enumerate endpoints
ffuf -w wordlist.txt -u https://example.com/FUZZ
```

### 2. Vulnerability Assessment
```bash
# Automated scanning
nikto -h https://example.com
owasp-zap-cli quick-scan https://example.com

# Dependency check
pnpm audit
docker scan radio-calico:latest
```

### 3. Exploitation (Authorized Only)

**Test for:**
- SQL Injection: `' OR 1=1--`
- XSS: `<script>alert('XSS')</script>`
- CSRF: Missing tokens
- Authentication bypass
- Rate limiting
- Input validation

### 4. Post-Exploitation
- Assess impact of successful exploits
- Check for privilege escalation
- Test lateral movement

### 5. Reporting

**Report Structure:**

1. **Executive Summary** (1-2 pages)
   - Overall risk rating (Critical/High/Medium/Low)
   - Key findings summary
   - Business impact assessment

2. **Vulnerabilities** (detailed, CVSS scored)
   - Title and severity (CVSS 3.1 score)
   - Description and affected components
   - Likelihood and impact assessment
   - Screenshots/evidence

3. **Proof of Concept**
   - Step-by-step reproduction steps
   - Request/response examples
   - Video walkthrough (for complex issues)

4. **Remediation Steps**
   - Specific code fixes with examples
   - Configuration changes needed
   - Priority order for fixes

5. **Appendices**
   - Full scan outputs
   - Tool versions used
   - Testing methodology

## OWASP Top 10 Checklist

- [ ] A01: Broken Access Control
- [ ] A02: Cryptographic Failures
- [ ] A03: Injection (SQL, XSS)
- [ ] A04: Insecure Design
- [ ] A05: Security Misconfiguration
- [ ] A06: Vulnerable Components
- [ ] A07: Auth/Session Issues
- [ ] A08: Data Integrity Failures
- [ ] A09: Logging Failures
- [ ] A10: SSRF

## Recommended Tools

- **Burp Suite** - Web app testing
- **OWASP ZAP** - Automated scanning
- **Nmap** - Port scanning
- **SQLMap** - SQL injection testing
- **Metasploit** - Exploitation framework

## Post-Test Remediation

**Tracking process:**
1. Create GitHub issues for each finding
2. Assign severity labels (critical/high/medium/low)
3. Set remediation deadlines:
   - Critical: 7 days
   - High: 30 days
   - Medium: 90 days
   - Low: Best effort
4. Schedule retest after fixes (typically 2-4 weeks)
5. Issue remediation certificate when complete

## Responsible Disclosure

If vulnerability found:
1. Do NOT exploit beyond POC
2. Report to security@example.com
3. Allow 90 days for remediation
4. Coordinate public disclosure

## Resources

- [OWASP Testing Guide](https://owasp.org/www-project-web-security-testing-guide/)
- [PTES](http://www.pentest-standard.org/)
- [Bug Bounty Methodology](https://github.com/jhaddix/tbhm)
