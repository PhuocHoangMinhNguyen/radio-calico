# Professional Penetration Testing Guide

This guide outlines the process for conducting professional penetration testing for Radio Calico, including planning, execution, and remediation.

## Table of Contents

1. [Overview](#overview)
2. [When to Conduct Penetration Testing](#when-to-conduct-penetration-testing)
3. [Scope Definition](#scope-definition)
4. [Selecting a Penetration Testing Provider](#selecting-a-penetration-testing-provider)
5. [Pre-Engagement Preparation](#pre-engagement-preparation)
6. [Testing Phases](#testing-phases)
7. [Post-Test Activities](#post-test-activities)
8. [Remediation and Re-testing](#remediation-and-re-testing)
9. [Compliance and Reporting](#compliance-and-reporting)

---

## Overview

Professional penetration testing is a comprehensive security assessment conducted by qualified security professionals to identify vulnerabilities, security weaknesses, and potential attack vectors in Radio Calico.

**Benefits:**
- Identify vulnerabilities before attackers do
- Validate security controls effectiveness
- Meet compliance requirements
- Improve overall security posture
- Demonstrate due diligence to stakeholders

**Recommended Frequency:**
- **Annual:** Full-scope penetration test
- **Quarterly:** Targeted testing of critical components
- **Ad-hoc:** After major changes or security incidents

---

## When to Conduct Penetration Testing

### Required Scenarios

1. **Before Production Launch**
   - First-time deployment to production
   - Identifies critical issues before users are affected

2. **After Major Changes**
   - New features with authentication/authorization
   - Significant architectural changes
   - Integration with third-party services
   - Database schema changes

3. **Compliance Requirements**
   - PCI DSS (if handling payments in future)
   - GDPR (for EU users)
   - Industry-specific regulations

4. **Post-Incident**
   - After a security breach
   - Verify remediation effectiveness
   - Identify any related vulnerabilities

### Recommended Scenarios

1. **Annual Security Audit**
   - Comprehensive full-scope testing
   - Review all components and endpoints

2. **Before Major Milestones**
   - Prior to significant user growth
   - Before adding sensitive features
   - Before seeking funding or acquisition

---

## Scope Definition

### In-Scope Components

#### Infrastructure
- **Production Environment:**
  - Web server (nginx)
  - Application server (Node.js backend)
  - Database server (PostgreSQL)
  - Docker containers
  - Network configuration

- **Deployment Infrastructure:**
  - GitHub Actions workflows
  - Container registry
  - Domain and DNS configuration

#### Application Layer
- **Frontend:**
  - Angular SPA (https://yourdomain.com)
  - PWA functionality
  - Client-side storage (localStorage)
  - Service Worker

- **Backend API:**
  - `/api/ratings` (GET, POST)
  - `/api/errors` (POST)
  - Rate limiting mechanisms
  - Input validation

- **Third-Party Integrations:**
  - CloudFront CDN (HLS stream)
  - Google Fonts
  - External dependencies

#### Security Controls
- Content Security Policy
- HTTPS/TLS configuration
- Security headers
- Rate limiting
- Input validation
- CORS configuration

### Out-of-Scope

- **Denial of Service (DoS) attacks** - Requires explicit approval
- **Social engineering** - Unless specifically requested
- **Physical security** - Not applicable for cloud-hosted app
- **CloudFront infrastructure** - Owned by AWS, not in our control

### Testing Methods

**Allowed:**
- ✅ Web application vulnerability scanning
- ✅ Manual penetration testing
- ✅ API security testing
- ✅ Authentication and authorization testing
- ✅ SQL injection attempts (against test environment)
- ✅ Cross-site scripting (XSS) testing
- ✅ Session management testing
- ✅ Container security assessment

**Prohibited Without Approval:**
- ❌ Denial of Service attacks
- ❌ Testing production database directly
- ❌ Social engineering of team members
- ❌ Physical intrusion attempts
- ❌ Testing third-party services (CloudFront, Google Fonts)

---

## Selecting a Penetration Testing Provider

### Qualification Criteria

**Required Certifications:**
- OSCP (Offensive Security Certified Professional)
- CEH (Certified Ethical Hacker)
- GPEN (GIAC Penetration Tester)
- CREST registered testers

**Experience Requirements:**
- Minimum 5 years in penetration testing
- Experience with similar technology stack:
  - Node.js applications
  - Angular/React SPAs
  - PostgreSQL databases
  - Docker/container security
  - API security testing

**Insurance:**
- Professional indemnity insurance
- Cyber liability insurance
- Minimum $1M coverage

### Evaluation Criteria

**Technical Expertise:**
- OWASP Top 10 testing experience
- API security testing capabilities
- Container security assessment
- Modern web application testing

**Methodology:**
- Follows recognized frameworks (OWASP, PTES, NIST)
- Clear testing methodology
- Comprehensive reporting
- Remediation guidance

**References:**
- Provide recent client references
- Similar project experience
- Positive testimonials

### Recommended Providers

**Freelance/Boutique:**
- [Cobalt.io](https://cobalt.io) - Pentest-as-a-Service
- [Synack](https://www.synack.com) - Crowdsourced security testing
- [HackerOne](https://www.hackerone.com) - Bug bounty + pentesting

**Enterprise:**
- [Rapid7](https://www.rapid7.com)
- [Coalfire](https://www.coalfire.com)
- [Bishop Fox](https://bishopfox.com)

**Cost Estimate:**
- **Web App Pentest:** $5,000 - $15,000
- **Full-Scope Pentest:** $15,000 - $30,000
- **Bug Bounty Program:** Variable, pay-per-finding

---

## Pre-Engagement Preparation

### 1. Legal Documentation

**Rules of Engagement (RoE):**
```markdown
# Rules of Engagement - Radio Calico Penetration Test

**Client:** [Your Organization]
**Vendor:** [Pentesting Company]
**Start Date:** [Date]
**End Date:** [Date]

## Scope
- Web Application: https://yourdomain.com
- API Endpoints: /api/*
- Infrastructure: [Details]

## Testing Window
- Monday - Friday, 9:00 AM - 5:00 PM UTC
- Emergency contact: [Phone]

## Out of Scope
- Production database direct access
- DoS attacks
- Social engineering

## Authorized Personnel
- [Tester Name 1] - [Email]
- [Tester Name 2] - [Email]

## Reporting
- Daily status updates
- Critical findings within 24 hours
- Final report within 2 weeks of completion

## Signatures
Client: _____________ Date: _______
Vendor: _____________ Date: _______
```

**Non-Disclosure Agreement (NDA):**
- Protect sensitive information
- Restrict sharing of findings
- Define data handling procedures

**Authorization Letter:**
- Formal permission to test
- Proof of authorization if contacted by hosting provider
- Contact information for escalation

### 2. Environment Preparation

**Create Testing Environment:**
```bash
# Set up isolated test environment
docker-compose -f docker-compose.test.yml up -d

# Use test database credentials
export PGDATABASE=radio_calico_test
export PGPASSWORD=test_password

# Deploy to test domain
# test.yourdomain.com
```

**Provide Test Accounts:**
- Admin account (if applicable)
- Regular user accounts
- Test data for various scenarios

**Document Current Security Posture:**
```bash
# Run pre-test security scans
npm audit > pre-test-npm-audit.txt
docker run aquasec/trivy image radio-calico:latest > pre-test-trivy.txt

# Document current vulnerabilities
echo "Known Issues:" > known-vulnerabilities.md
echo "1. [Issue description]" >> known-vulnerabilities.md
```

### 3. Communication Plan

**Key Contacts:**
- **Technical Lead:** [Name, Email, Phone]
- **Security Contact:** [Name, Email, Phone]
- **Emergency Contact:** [Name, Phone] (available 24/7)

**Communication Channels:**
- **Regular Updates:** Email
- **Critical Issues:** Phone + Email
- **Daily Standups:** Video call (optional)

**Escalation Path:**
```
Critical Finding → Technical Lead (15 min)
                 ↓
    Security Contact (30 min)
                 ↓
    Emergency Contact (1 hour)
```

---

## Testing Phases

### Phase 1: Reconnaissance (1-2 days)

**Activities:**
- Information gathering
- Technology stack fingerprinting
- DNS enumeration
- Subdomain discovery
- Port scanning
- Service identification

**Deliverables:**
- Asset inventory
- Technology stack report
- Attack surface map

### Phase 2: Vulnerability Assessment (2-3 days)

**Activities:**
- Automated vulnerability scanning
- OWASP Top 10 testing
- API security testing
- Configuration review
- Security header analysis

**Tools Used:**
- Burp Suite Professional
- OWASP ZAP
- Nessus/Qualys
- Custom scripts

**Deliverables:**
- Vulnerability report
- Risk prioritization

### Phase 3: Exploitation (3-5 days)

**Activities:**
- Attempt to exploit identified vulnerabilities
- Privilege escalation testing
- Data exfiltration attempts
- Authentication bypass testing
- SQL injection exploitation
- XSS exploitation

**Deliverables:**
- Proof-of-concept exploits
- Impact assessment
- Evidence of successful exploitation

### Phase 4: Post-Exploitation (1-2 days)

**Activities:**
- Lateral movement attempts
- Data access testing
- Persistence mechanisms
- Cleanup activities

**Deliverables:**
- Access path documentation
- Compromised data inventory

### Phase 5: Reporting (3-5 days)

**Activities:**
- Report compilation
- Finding validation
- Risk scoring
- Remediation recommendations
- Executive summary preparation

**Deliverables:**
- Executive summary
- Technical report
- Remediation roadmap

---

## Post-Test Activities

### 1. Report Review

**Initial Review:**
- Schedule debrief call within 48 hours
- Review all findings with testing team
- Clarify technical details
- Validate proof-of-concept exploits

**Report Components:**
```markdown
# Penetration Test Report Structure

## Executive Summary
- Overall security posture
- Key findings
- Risk level
- Recommendations

## Scope and Methodology
- What was tested
- How it was tested
- Tools used
- Limitations

## Findings
For each finding:
- Title and description
- Severity (Critical/High/Medium/Low)
- CVSS score
- Proof of concept
- Impact analysis
- Remediation steps
- References (CWE, OWASP)

## Appendices
- Vulnerability details
- Screenshots
- Tool outputs
- Test data
```

### 2. Finding Classification

**Severity Levels:**

**Critical (CVSS 9.0-10.0):**
- Remote code execution
- SQL injection with data access
- Authentication bypass
- Sensitive data exposure

**High (CVSS 7.0-8.9):**
- Privilege escalation
- XSS with sensitive data access
- Insecure direct object references
- Missing authentication

**Medium (CVSS 4.0-6.9):**
- Information disclosure
- CSRF vulnerabilities
- Missing security headers
- Session management issues

**Low (CVSS 0.1-3.9):**
- Security misconfigurations
- Verbose error messages
- Missing best practices

### 3. Stakeholder Communication

**Internal Communication:**
```markdown
# Security Test Results - Internal Memo

Date: [Date]
To: Engineering Team, Management
From: Security Team

## Summary
We completed a professional penetration test of Radio Calico.

## Key Findings
- X Critical findings
- Y High findings
- Z Medium findings

## Immediate Actions Required
1. [Critical fix #1] - Due: [Date]
2. [Critical fix #2] - Due: [Date]

## Next Steps
- Remediation planning meeting: [Date]
- Re-test scheduled for: [Date]

Full report available at: [Secure Link]
```

**External Communication (if required):**
- Notify affected users (if data breach)
- Update security page
- Prepare PR statement (if public incident)

---

## Remediation and Re-testing

### 1. Remediation Planning

**Prioritization Matrix:**
```
                High Impact
                    |
  Fix Immediately   |   Fix Soon
                    |
--------------------+--------------------
                    |
  Fix When Possible |   Monitor
                    |
              Low Exploitability
```

**Remediation Timeline:**
- **Critical:** 24-48 hours
- **High:** 1 week
- **Medium:** 2-4 weeks
- **Low:** Next release cycle

### 2. Remediation Tracking

**Create GitHub Issues:**
```bash
# Create security-labeled issues for each finding
gh issue create \
  --title "SEC-001: SQL Injection in /api/ratings" \
  --body "$(cat pentest-finding-001.md)" \
  --label "security,critical,pentest" \
  --assignee "@me"
```

**Remediation Checklist:**
```markdown
## Finding: [Title]
- [ ] Root cause identified
- [ ] Fix implemented
- [ ] Code reviewed
- [ ] Tested in dev environment
- [ ] Security team approved
- [ ] Deployed to production
- [ ] Re-tested by pentester
- [ ] Documented in changelog
```

### 3. Re-testing

**Schedule Re-test:**
- After all critical/high findings remediated
- Typically 2-4 weeks after initial test
- May be included in original engagement cost

**Re-test Scope:**
- Verify all findings are resolved
- Test for new issues introduced by fixes
- Confirm no regression

**Acceptance Criteria:**
- All critical findings resolved
- All high findings resolved or mitigated
- Clear plan for medium/low findings
- No new critical/high issues introduced

---

## Compliance and Reporting

### Industry Standards

**OWASP:**
- OWASP Top 10 compliance
- OWASP ASVS (Application Security Verification Standard)

**NIST:**
- NIST Cybersecurity Framework
- NIST 800-115 (Technical Guide to Information Security Testing)

**PCI DSS (if applicable):**
- Requirement 11.3: External and internal penetration testing

### Documentation

**Required Records:**
- Rules of Engagement (signed)
- Penetration test report
- Remediation plan
- Re-test results
- Sign-off documentation

**Retention:**
- Keep for minimum 3 years
- Store in secure location
- Limit access to authorized personnel

### Continuous Improvement

**Lessons Learned:**
```markdown
# Post-Test Retrospective

## What Went Well
- [Item]

## What Could Be Improved
- [Item]

## Action Items
- [ ] Update secure coding guidelines
- [ ] Add security training for team
- [ ] Implement additional controls
- [ ] Update security testing procedures

## Metrics
- Vulnerabilities found: X
- Time to remediate: Y days
- Cost: $Z
- Coverage: A% of application
```

**Update Security Controls:**
- Add new test cases to automated testing
- Update WAF rules
- Enhance monitoring/alerting
- Improve logging

---

## Appendix: Sample RFP

**Request for Proposal - Penetration Testing Services**

```markdown
# RFP: Penetration Testing Services

## Project Overview
Radio Calico is seeking qualified vendors to perform professional penetration testing.

## Scope
- Web application security testing
- API security assessment
- Infrastructure security review
- Container security assessment

## Requirements
1. Vendor qualifications
2. Testing methodology
3. Timeline and deliverables
4. Pricing
5. References

## Timeline
- RFP Issue Date: [Date]
- Questions Due: [Date]
- Proposals Due: [Date]
- Vendor Selection: [Date]
- Testing Start: [Date]

## Evaluation Criteria
- Technical expertise (40%)
- Methodology (25%)
- Cost (20%)
- References (15%)

## Contact
[Name]
[Email]
[Phone]
```

---

## Resources

- [OWASP Testing Guide](https://owasp.org/www-project-web-security-testing-guide/)
- [PTES (Penetration Testing Execution Standard)](http://www.pentest-standard.org/)
- [NIST 800-115](https://csrc.nist.gov/publications/detail/sp/800-115/final)
- [OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/)
- [CWE Top 25](https://cwe.mitre.org/top25/)
- [CVSS Calculator](https://www.first.org/cvss/calculator/3.1)
