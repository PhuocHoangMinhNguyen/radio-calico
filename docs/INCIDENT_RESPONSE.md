# Incident Response Plan

This document defines the procedures for responding to security incidents affecting Radio Calico.

## Table of Contents

1. [Overview](#overview)
2. [Incident Response Team](#incident-response-team)
3. [Incident Classification](#incident-classification)
4. [Response Phases](#response-phases)
5. [Communication Protocols](#communication-protocols)
6. [Incident Types and Procedures](#incident-types-and-procedures)
7. [Post-Incident Activities](#post-incident-activities)
8. [Tools and Resources](#tools-and-resources)
9. [Appendices](#appendices)

---

## Overview

### Purpose

This Incident Response Plan provides a structured approach to detecting, responding to, and recovering from security incidents affecting Radio Calico.

### Scope

This plan covers:
- Web application security incidents
- API security incidents
- Infrastructure compromises
- Data breaches
- Denial of Service (DoS) attacks
- Unauthorized access attempts

### Objectives

1. **Minimize impact:** Contain and remediate incidents quickly
2. **Preserve evidence:** Maintain forensic data for investigation
3. **Maintain operations:** Keep service running where possible
4. **Learn and improve:** Update security controls based on incidents

### Definitions

- **Security Incident:** Any event that compromises the confidentiality, integrity, or availability of Radio Calico
- **Security Event:** A suspicious activity that may or may not be an incident
- **Incident Response Team (IRT):** The team responsible for managing security incidents

---

## Incident Response Team

### Roles and Responsibilities

#### Incident Commander
- **Name:** [To be assigned]
- **Contact:** [Email, Phone]
- **Responsibilities:**
  - Overall incident coordination
  - Decision-making authority
  - Stakeholder communication
  - Declare incident severity
  - Authorize containment actions

#### Technical Lead
- **Name:** [To be assigned]
- **Contact:** [Email, Phone]
- **Responsibilities:**
  - Technical investigation
  - Containment and remediation
  - Evidence collection
  - System restoration
  - Root cause analysis

#### Communications Lead
- **Name:** [To be assigned]
- **Contact:** [Email, Phone]
- **Responsibilities:**
  - Internal communications
  - External communications
  - Customer notifications
  - Media relations (if needed)
  - Status updates

#### Security Analyst
- **Name:** [To be assigned]
- **Contact:** [Email, Phone]
- **Responsibilities:**
  - Log analysis
  - Threat intelligence
  - Indicator of Compromise (IOC) identification
  - Security monitoring
  - Documentation

### Escalation Path

```
Level 1: Security Event Detected
         ↓
Level 2: Security Analyst investigates
         ↓
Level 3: Confirmed Incident → Notify Technical Lead
         ↓
Level 4: High Severity → Notify Incident Commander
         ↓
Level 5: Critical → Notify Executive Management
```

### Contact List

| Role | Name | Email | Phone | Backup |
|------|------|-------|-------|--------|
| Incident Commander | [Name] | [Email] | [Phone] | [Backup Name] |
| Technical Lead | [Name] | [Email] | [Phone] | [Backup Name] |
| Communications Lead | [Name] | [Email] | [Phone] | [Backup Name] |
| Security Analyst | [Name] | [Email] | [Phone] | [Backup Name] |
| Legal Counsel | [Name] | [Email] | [Phone] | - |
| PR Contact | [Name] | [Email] | [Phone] | - |

### External Contacts

- **Hosting Provider:** [Provider Name] - [Support Phone]
- **Cloud Provider (if applicable):** AWS/GCP - [Support]
- **Law Enforcement:** [Local Contact]
- **Cyber Insurance:** [Provider] - [Policy #]

---

## Incident Classification

### Severity Levels

#### Critical (P0)
- **Definition:** Severe impact on business operations or data security
- **Response Time:** Immediate (within 15 minutes)
- **Examples:**
  - Data breach with PII exposed
  - Complete service outage
  - Active ransomware attack
  - Unauthorized root/admin access

#### High (P1)
- **Definition:** Significant security compromise or service degradation
- **Response Time:** 1 hour
- **Examples:**
  - SQL injection exploitation with database access
  - DDoS attack causing service degradation
  - Unauthorized access to sensitive data
  - Malware on production systems

#### Medium (P2)
- **Definition:** Limited impact or contained security incident
- **Response Time:** 4 hours
- **Examples:**
  - Successful phishing attempt (no data accessed)
  - Unauthorized access to non-critical system
  - Vulnerability discovered in production code
  - Suspicious activity detected

#### Low (P3)
- **Definition:** Minor security concern or potential vulnerability
- **Response Time:** Next business day
- **Examples:**
  - Failed intrusion attempt
  - Security misconfiguration (no exploitation)
  - Policy violation
  - Suspicious logs (unconfirmed)

### Impact Assessment

**Factors to consider:**
- **Data compromise:** Type and volume of data affected
- **Service availability:** Duration and extent of outage
- **User impact:** Number of affected users
- **Reputation:** Potential brand damage
- **Financial:** Direct and indirect costs
- **Legal:** Regulatory implications

---

## Response Phases

### Phase 1: Detection and Analysis

#### 1.1 Detection Methods

**Automated Detection:**
- Security event logs
- Intrusion Detection System (IDS) alerts
- Rate limiting triggers
- Error log anomalies
- SIEM alerts

**Manual Detection:**
- User reports
- Security team monitoring
- External notification (security researcher)
- Third-party service alerts

#### 1.2 Initial Analysis

**Checklist:**
```markdown
- [ ] What was detected? (Event type)
- [ ] When did it occur? (Timestamp)
- [ ] Where did it originate? (IP, location)
- [ ] Who is affected? (Users, systems)
- [ ] How severe is it? (Severity level)
- [ ] Is it still ongoing? (Active/Contained)
```

**Evidence Collection:**
```bash
# Capture current system state
docker ps > incident-containers-$(date +%Y%m%d-%H%M%S).txt
docker logs backend > incident-backend-logs-$(date +%Y%m%d-%H%M%S).log
docker logs nginx > incident-nginx-logs-$(date +%Y%m%d-%H%M%S).log

# Database snapshot
pg_dump radio_calico > incident-db-backup-$(date +%Y%m%d-%H%M%S).sql

# Security event logs
psql -U postgres -d radio_calico -c \
  "COPY (SELECT * FROM error_logs WHERE created_at > NOW() - INTERVAL '24 hours') \
  TO '/tmp/incident-error-logs-$(date +%Y%m%d-%H%M%S).csv' CSV HEADER;"

# Network capture (if needed)
tcpdump -i any -w incident-network-$(date +%Y%m%d-%H%M%S).pcap
```

#### 1.3 Incident Declaration

**Decision Matrix:**
| Criteria | Yes/No | Weight |
|----------|--------|--------|
| Confirmed unauthorized access? | | High |
| Data exfiltration suspected? | | High |
| Service disruption? | | Medium |
| Multiple failed controls? | | Medium |
| Indicators of Compromise (IOCs) present? | | High |

**If 2+ High or 3+ Medium criteria met → Declare Incident**

**Declare Incident:**
```markdown
INCIDENT DECLARED

Incident ID: INC-[YYYY-MM-DD]-[Number]
Severity: [Critical/High/Medium/Low]
Type: [Data Breach/Intrusion/DoS/etc.]
Detected: [Timestamp]
Declared By: [Name]
Incident Commander: [Name]

Brief Description:
[1-2 sentences describing the incident]

Initial Actions Taken:
- [Action 1]
- [Action 2]

Next Steps:
- [Step 1]
- [Step 2]
```

### Phase 2: Containment

#### 2.1 Short-term Containment

**Immediate actions (within 1 hour):**

**For Active Intrusion:**
```bash
# Block attacking IP at firewall
iptables -A INPUT -s <ATTACKER_IP> -j DROP

# Or in nginx
# Add to nginx.conf:
deny <ATTACKER_IP>;
# Reload: docker-compose -f docker-compose.prod.yml restart nginx

# Isolate compromised container
docker network disconnect radio_calico_network_prod <container_name>

# Take snapshot for forensics
docker commit <container_id> incident-snapshot-$(date +%Y%m%d-%H%M%S)
```

**For Data Breach:**
```bash
# Revoke all active sessions (implement in application)
# Change database credentials
# Rotate API keys
# Update secrets in environment variables

# Backup affected data
pg_dump -t affected_table radio_calico > compromised-data-backup.sql
```

**For DoS Attack:**
```bash
# Enable aggressive rate limiting temporarily
# Update server.js:
const RATE_LIMIT_MAX_REQUESTS = 20; # Reduce from 100
const RATE_LIMIT_WINDOW_MS = 60 * 1000;

# Deploy updated configuration
docker-compose -f docker-compose.prod.yml restart backend

# Consider enabling CloudFlare DDoS protection
```

#### 2.2 Long-term Containment

**System hardening (within 24 hours):**
```markdown
- [ ] Patch identified vulnerabilities
- [ ] Update security rules
- [ ] Implement additional monitoring
- [ ] Review and update access controls
- [ ] Deploy additional security controls
```

### Phase 3: Eradication

#### 3.1 Root Cause Analysis

**5 Whys Technique:**
```markdown
1. Why did the incident occur?
   → [Answer]

2. Why did that happen?
   → [Answer]

3. Why did that condition exist?
   → [Answer]

4. Why wasn't it prevented?
   → [Answer]

5. Why wasn't it detected earlier?
   → [Answer]
```

#### 3.2 Remediation

**Checklist:**
```markdown
- [ ] Remove malicious code/files
- [ ] Close vulnerability
- [ ] Update security controls
- [ ] Verify no backdoors remain
- [ ] Change all compromised credentials
- [ ] Review similar systems for same vulnerability
```

**Example: SQL Injection Remediation:**
```bash
# 1. Identify vulnerable endpoint
# Already using parameterized queries - verify implementation

# 2. Add additional validation
# Update server.js with stricter input validation (already done)

# 3. Add WAF rules
# Deploy WAF with SQL injection protection

# 4. Review all database queries
grep -r "pool.query" server.js
# Verify all use parameterized queries
```

### Phase 4: Recovery

#### 4.1 System Restoration

**Checklist:**
```markdown
- [ ] Restore from clean backup (if needed)
- [ ] Verify system integrity
- [ ] Re-enable services gradually
- [ ] Monitor closely for re-infection
- [ ] Validate all security controls
- [ ] Test functionality
- [ ] Notify users of restoration
```

**Gradual Restoration:**
```bash
# Step 1: Restore to staging environment
docker-compose -f docker-compose.test.yml up -d

# Step 2: Run security scans
npm audit
trivy image radio-calico:latest

# Step 3: Verify functionality
npm run test:api
npm run test:headless

# Step 4: Deploy to production
docker-compose -f docker-compose.prod.yml up -d

# Step 5: Monitor for 24-48 hours
docker-compose -f docker-compose.prod.yml logs -f | grep "SECURITY EVENT"
```

#### 4.2 Validation

**Verify incident is resolved:**
- [ ] Attack vector no longer accessible
- [ ] No signs of attacker presence
- [ ] Systems operating normally
- [ ] No ongoing unauthorized activity
- [ ] Security controls functioning

### Phase 5: Post-Incident Activities

See [Post-Incident Activities](#post-incident-activities) section below.

---

## Communication Protocols

### Internal Communication

**Incident War Room:**
- **Platform:** Slack channel #incident-response
- **Purpose:** Real-time coordination during incidents
- **Participants:** IRT members only

**Status Updates:**
```markdown
INCIDENT UPDATE - [Timestamp]

Incident ID: INC-[ID]
Status: [Investigating/Contained/Resolved]
Severity: [Level]

What happened:
[Brief update]

What we're doing:
[Current actions]

Impact:
[User/system impact]

Next update in: [Timeframe]
```

### External Communication

#### User Notification Template

**For Data Breach:**
```markdown
Subject: Important Security Notice

Dear Radio Calico User,

We are writing to inform you of a security incident that may have affected your information.

What Happened:
On [Date], we discovered that [brief description of incident].

What Information Was Involved:
[List of data types potentially affected]

What We're Doing:
- [Action 1]
- [Action 2]
- [Action 3]

What You Should Do:
- [Recommendation 1]
- [Recommendation 2]

We take this matter very seriously and sincerely apologize for any concern this may cause.

For questions, contact: security@yourdomain.com

Sincerely,
[Name]
[Title]
```

#### Media Statement Template

```markdown
MEDIA STATEMENT

[Date]

Radio Calico experienced a security incident on [Date] that [brief impact description].

We immediately launched an investigation and took steps to [containment actions].

Based on our investigation, [what we know about the incident].

We have notified [affected parties/authorities] and are working with [security experts/law enforcement].

The security and privacy of our users is our top priority.

For more information: [Contact]
```

### Regulatory Notification

**GDPR (if applicable):**
- **Timeline:** Within 72 hours of discovery
- **Authority:** Relevant data protection authority
- **Content:** Nature of breach, data involved, likely consequences, measures taken

---

## Incident Types and Procedures

### 1. SQL Injection Attack

**Indicators:**
- SQL injection patterns in logs
- Unexpected database queries
- Database errors in logs
- Unusual data access patterns

**Response:**
```bash
# 1. Identify affected endpoint
grep "sql_injection_attempt" logs/

# 2. Block attacker IP
iptables -A INPUT -s <IP> -j DROP

# 3. Review database logs
psql -U postgres -d radio_calico -c "SELECT * FROM pg_stat_activity;"

# 4. Check for data exfiltration
psql -U postgres -d radio_calico -c \
  "SELECT * FROM song_ratings WHERE updated_at > NOW() - INTERVAL '24 hours';"

# 5. Verify parameterized queries are in use
grep "pool.query" server.js

# 6. Deploy fix (already implemented)
# 7. Monitor for additional attempts
```

### 2. DDoS Attack

**Indicators:**
- Sudden spike in traffic
- High rate limit violations
- Service degradation
- Unusual geographic distribution of requests

**Response:**
```bash
# 1. Identify attack pattern
tail -f /var/log/nginx/access.log | grep -E "(rate limit|429)"

# 2. Enable CloudFlare (if available)
# 3. Tighten rate limits temporarily
# Update server.js RATE_LIMIT_MAX_REQUESTS = 20

# 4. Block attacking IPs
# Use automated blocking for multiple violations

# 5. Scale infrastructure if needed
docker-compose -f docker-compose.prod.yml up --scale backend=3

# 6. Monitor until attack subsides
```

### 3. Data Breach

**Indicators:**
- Unauthorized database access
- Large data exports
- Stolen credentials used
- Security researcher notification

**Response:**
```bash
# 1. Contain immediately
# Disable affected accounts
# Change database credentials
# Rotate API keys

# 2. Assess scope
psql -U postgres -d radio_calico -c \
  "SELECT COUNT(*) FROM [affected_table];"

# 3. Preserve evidence
pg_dump radio_calico > breach-evidence-$(date +%Y%m%d).sql

# 4. Notify affected users (GDPR: within 72 hours)
# 5. Report to authorities if required
# 6. Conduct forensic investigation
```

### 4. Unauthorized Access

**Indicators:**
- Login from unusual location
- Failed authentication attempts
- New admin users created
- Unexpected configuration changes

**Response:**
```bash
# 1. Revoke access
# Disable compromised accounts
# Change all passwords/keys

# 2. Review access logs
docker logs backend | grep "authentication"

# 3. Check for backdoors
# Review user accounts, SSH keys, cron jobs

# 4. Conduct full security audit
# 5. Implement MFA (if not already)
```

---

## Post-Incident Activities

### 1. Post-Incident Review (PIR)

**Schedule within 5 business days of incident resolution**

**Agenda:**
```markdown
# Post-Incident Review - INC-[ID]

Date: [Date]
Attendees: [IRT + Stakeholders]

## Timeline of Events
[Chronological sequence]

## What Went Well
- [Item 1]
- [Item 2]

## What Could Be Improved
- [Item 1]
- [Item 2]

## Root Cause
[5 Whys analysis results]

## Action Items
| Action | Owner | Due Date | Status |
|--------|-------|----------|--------|
| [Action 1] | [Name] | [Date] | Open |
| [Action 2] | [Name] | [Date] | Open |

## Lessons Learned
[Key takeaways]
```

### 2. Documentation

**Final Incident Report:**
```markdown
# Incident Report - INC-[ID]

## Executive Summary
[High-level overview for non-technical stakeholders]

## Incident Details
- ID: INC-[ID]
- Severity: [Level]
- Type: [Type]
- Detected: [Timestamp]
- Contained: [Timestamp]
- Resolved: [Timestamp]
- Duration: [Hours]

## Timeline
| Time | Event |
|------|-------|
| [HH:MM] | [Event description] |

## Impact Analysis
- Users affected: [Number]
- Data compromised: [Type and volume]
- Downtime: [Duration]
- Financial impact: $[Amount]

## Root Cause
[Detailed analysis]

## Remediation Steps
1. [Step]
2. [Step]

## Preventive Measures
1. [Measure]
2. [Measure]

## Appendices
- [Evidence]
- [Logs]
- [Screenshots]
```

### 3. Security Improvements

**Update Security Controls:**
```markdown
- [ ] Update firewall rules
- [ ] Enhance monitoring
- [ ] Add new detection rules
- [ ] Improve incident response procedures
- [ ] Conduct security training
- [ ] Update documentation
```

### 4. Compliance and Legal

**Required Notifications:**
- Data protection authorities (GDPR: 72 hours)
- Affected individuals (without undue delay)
- Law enforcement (if criminal activity)
- Cyber insurance provider

**Documentation Retention:**
- Incident reports: 7 years
- Evidence: Until legal hold lifted
- Communications: 3 years

---

## Tools and Resources

### Incident Response Tools

**Log Analysis:**
- `grep`, `awk`, `sed` for log parsing
- Kibana/Splunk for SIEM analysis
- `jq` for JSON log parsing

**Forensics:**
- Docker forensics: `docker commit`, `docker export`
- Database forensics: `pg_dump`, query logs
- Network forensics: `tcpdump`, Wireshark

**Communication:**
- Slack/Teams for coordination
- PagerDuty for escalation
- Status page for user updates

### Reference Materials

- [NIST Computer Security Incident Handling Guide](https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-61r2.pdf)
- [SANS Incident Response Guide](https://www.sans.org/reading-room/whitepapers/incident/incident-handlers-handbook-33901)
- [OWASP Incident Response](https://cheatsheetseries.owasp.org/cheatsheets/Incident_Response_Cheat_Sheet.html)

---

## Appendices

### Appendix A: Incident Response Checklist

```markdown
## Detection Phase
- [ ] Incident detected
- [ ] Initial analysis completed
- [ ] Severity determined
- [ ] Incident Commander notified
- [ ] Evidence preserved

## Containment Phase
- [ ] Attack vector identified
- [ ] Attacker access blocked
- [ ] Affected systems isolated
- [ ] Additional spread prevented

## Eradication Phase
- [ ] Root cause identified
- [ ] Vulnerability patched
- [ ] Malicious artifacts removed
- [ ] Security controls updated

## Recovery Phase
- [ ] Systems restored
- [ ] Functionality verified
- [ ] Monitoring enhanced
- [ ] Users notified

## Post-Incident Phase
- [ ] PIR conducted
- [ ] Report documented
- [ ] Action items created
- [ ] Lessons learned applied
```

### Appendix B: Contact Information

**Emergency Contacts:**
| Service | Contact | Phone |
|---------|---------|-------|
| Hosting Provider | [Provider] | [Phone] |
| DNS Provider | [Provider] | [Phone] |
| CDN Provider | [Provider] | [Phone] |
| Database | [Provider] | [Phone] |

**Incident Response Vendors:**
| Company | Services | Contact |
|---------|----------|---------|
| [Forensics Firm] | Digital forensics | [Email/Phone] |
| [Law Firm] | Legal counsel | [Email/Phone] |
| [PR Firm] | Crisis communications | [Email/Phone] |

---

**Document Control**

- **Version:** 1.0
- **Last Updated:** [Date]
- **Next Review:** [Date + 6 months]
- **Owner:** [Security Team]
- **Approved By:** [Name, Title]

**Revision History**

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | [Date] | [Name] | Initial version |
