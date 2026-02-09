# Security

This document describes the security scanning and vulnerability management processes for Radio Calico.

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Security Scanning](#security-scanning)
- [Automated Scanning](#automated-scanning)
- [Responding to Vulnerabilities](#responding-to-vulnerabilities)
- [Best Practices](#best-practices)

## Overview

Radio Calico uses `npm audit` for dependency vulnerability scanning. Security checks are integrated into:

1. **Local development** — via npm scripts and Make targets
2. **CI/CD pipeline** — automatic scanning on every push/PR
3. **Scheduled scans** — weekly security audits with automatic issue creation

## Quick Start

### Check for vulnerabilities

```bash
# Using npm
npm run security

# Using Make
make security
```

### Fix vulnerabilities automatically

```bash
# Using npm
npm run audit:fix

# Using Make
make audit-fix
```

### View all available security commands

```bash
make help
```

## Security Scanning

### npm Scripts

All security-related npm scripts are available in [package.json](package.json):

| Command | Description | Audit Level |
|---------|-------------|-------------|
| `npm run security` | Run all security checks | moderate+ |
| `npm run audit` | Audit all dependencies | moderate+ |
| `npm run audit:prod` | Audit production dependencies only | moderate+ |
| `npm run audit:fix` | Auto-fix vulnerabilities | - |
| `npm run audit:ci` | Strict CI audit | low+ |

### Make Targets

The [Makefile](Makefile) provides convenient targets for security operations:

| Target | Description |
|--------|-------------|
| `make security` | Run all security checks |
| `make audit` | Audit all dependencies |
| `make audit-prod` | Audit production dependencies only |
| `make audit-fix` | Auto-fix vulnerabilities |
| `make audit-report` | Generate detailed JSON report |
| `make audit-ci` | Strict CI checks |
| `make test-security` | Security scans + all tests |
| `make docker-security` | Run security scans in Docker |

### Understanding Audit Levels

- **critical** — Actively exploited or no workaround available
- **high** — High likelihood of exploitation or significant impact
- **moderate** — Moderate impact or mitigation available
- **low** — Low impact or requires specific conditions

Different commands use different thresholds:
- Local development: fails on `moderate+` (recommended for regular checks)
- CI pipeline: fails on `low+` (stricter for production builds)
- Critical checks: fails on `critical` only (gates deployments)

## Automated Scanning

### On Every Push/PR

The `security` job in [.github/workflows/docker-build.yml](.github/workflows/docker-build.yml) runs automatically:

1. ✅ Scans all dependencies
2. ✅ Scans production dependencies separately
3. ✅ Generates JSON security report
4. ✅ Uploads report as artifact (30-day retention)
5. ❌ **Fails build** if critical vulnerabilities are found

### Scheduled Weekly Scans

The [.github/workflows/security-scan.yml](.github/workflows/security-scan.yml) workflow runs every Monday at 9:00 AM UTC:

1. ✅ Full dependency audit
2. ✅ Production dependency audit
3. ✅ Generates detailed report
4. ✅ Uploads report as artifact (90-day retention)
5. 🤖 **Automatically creates GitHub issue** if critical or high severity vulnerabilities are detected
6. ❌ Fails only on critical vulnerabilities

**Manual trigger:** You can also run the scheduled scan manually from the Actions tab in GitHub.

## Responding to Vulnerabilities

### 1. Review the Vulnerability Report

When vulnerabilities are detected, you'll receive:
- GitHub Action failure notification (for push/PR)
- Automated GitHub issue (for scheduled scans)
- Security audit artifact with detailed JSON report

### 2. Assess the Risk

Check the vulnerability details:

```bash
# View full audit output
npm run audit

# View production dependencies only
npm run audit:prod

# Generate detailed JSON report
make audit-report
```

Review:
- **Severity level** — critical, high, moderate, low
- **CVE identifier** — search for public exploits
- **Affected package** — direct or transitive dependency
- **Remediation** — available fix version
- **Exploit conditions** — does it apply to your use case?

### 3. Fix the Vulnerability

#### Option A: Automatic Fix

```bash
# Try automatic fix first
npm run audit:fix

# Or using Make
make audit-fix
```

This updates dependencies to the nearest non-vulnerable version that doesn't break semver.

#### Option B: Manual Update

If automatic fix doesn't work:

```bash
# Update specific package
npm install package-name@latest

# Update all outdated packages
npm update

# Check for major updates
npx npm-check-updates
```

#### Option C: Override (Use with Caution)

If a fix isn't available, you can use npm overrides in `package.json`:

```json
{
  "overrides": {
    "vulnerable-package": "safe-version"
  }
}
```

⚠️ **Warning:** Overrides can cause compatibility issues. Only use as a last resort and document why.

### 4. Verify the Fix

After applying fixes:

```bash
# Run security checks
make security

# Run all tests to ensure nothing broke
make test

# Test the app locally
npm run dev
```

### 5. Commit and Push

```bash
git add package.json package-lock.json
git commit -m "fix: resolve security vulnerabilities in dependencies"
git push
```

The CI pipeline will re-run security scans to verify the fix.

## Best Practices

### Regular Maintenance

1. **Check security weekly** — don't wait for automated scans
   ```bash
   make security
   ```

2. **Keep dependencies updated** — reduce vulnerability window
   ```bash
   npm update
   npm run audit:fix
   ```

3. **Review dependency changes** — understand what you're updating
   ```bash
   git diff package-lock.json
   ```

### Before Deploying

Always run security checks before deploying:

```bash
# Full pre-deployment check
make ci-check

# Or individual steps
make audit-ci
make test
```

### In Development

1. **Run security scans before committing**
   ```bash
   make pre-commit
   ```

2. **Review new dependencies** before adding them
   ```bash
   npm audit --package package-name
   ```

3. **Monitor security advisories** for your dependencies
   - GitHub Security Advisories
   - npm Security Advisories

### Docker Environments

Run security scans in Docker to match production:

```bash
# Run security scans in Docker
make docker-security

# Run all Docker tests
make docker-test
```

## Reporting Security Issues

If you discover a security vulnerability in Radio Calico itself (not dependencies):

1. **Do NOT create a public GitHub issue**
2. Contact the maintainers privately
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

## Additional Resources

- [npm audit documentation](https://docs.npmjs.com/cli/v10/commands/npm-audit)
- [GitHub Security Advisories](https://github.com/advisories)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Snyk Vulnerability Database](https://snyk.io/vuln)

---

**Last updated:** 2026-02-09
