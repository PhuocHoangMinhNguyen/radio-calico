# Incident Response Plan

Quick response procedures for security incidents.

## Severity Classification

| Level | Examples | Response Time |
|-------|----------|---------------|
| **P0 - Critical** | Data breach, RCE | Immediate |
| **P1 - High** | Auth bypass, SQL injection | <1 hour |
| **P2 - Medium** | XSS, info disclosure | <4 hours |
| **P3 - Low** | Rate limit abuse | <24 hours |

## Response Team

- **Incident Commander** - Coordinates response
- **Technical Lead** - Investigates and fixes
- **Communications Lead** - User/stakeholder updates  
- **Legal/Compliance** - Regulatory requirements

## Response Steps

### 1. Detection & Triage (0-15 min)
```bash
# Check logs and monitoring
docker logs radio-calico-backend-prod
psql -c "SELECT * FROM error_logs ORDER BY created_at DESC LIMIT 50"
```

### 2. Containment (15-30 min)
```bash
# Stop affected services if needed
docker-compose -f docker-compose.prod.yml down backend
```

### 3. Investigation (30 min - 2 hours)
- Review logs, database, network traffic
- Identify attack vector and scope
- Document findings

### 4. Eradication & Recovery
- Apply patches, rotate credentials
- Restore from backup if needed
- Redeploy services

### 5. Post-Incident (24-48 hours)
- Root cause analysis
- Update security controls
- Document lessons learned

## Communication Template

**User Notification:**
```
Subject: Security Incident Notification

We detected unauthorized access to [system] on [date].
Affected: [what data]
Actions taken: [steps]
Your action: [if any]

Contact: security@example.com
```

## Resources

- [NIST IR Guide](https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-61r2.pdf)
- [SANS Handbook](https://www.sans.org/white-papers/33901/)
