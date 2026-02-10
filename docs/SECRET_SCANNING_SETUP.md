# Secret Scanning Setup Guide

This guide explains how to enable and configure GitHub's secret scanning features for the Radio Calico repository.

## GitHub Secret Scanning

GitHub secret scanning automatically detects secrets (API keys, tokens, credentials) that have been committed to the repository.

### Enabling Secret Scanning

**Note:** Secret scanning is available for all public repositories automatically. For private repositories, it requires GitHub Advanced Security.

#### For Public Repositories (Automatic)

1. Navigate to your repository on GitHub
2. Go to **Settings** → **Code security and analysis**
3. Verify that **Secret scanning** shows as "Enabled"
4. **Push protection** should also be enabled to prevent secrets from being pushed

#### For Private Repositories (Requires GitHub Advanced Security)

1. Navigate to your repository on GitHub
2. Go to **Settings** → **Code security and analysis**
3. Under **GitHub Advanced Security**, click **Enable**
4. Under **Secret scanning**, click **Enable**
5. Under **Push protection**, click **Enable**

### Configuring Secret Scanning

#### 1. Enable Push Protection

Push protection prevents secrets from being committed in the first place:

1. Go to **Settings** → **Code security and analysis**
2. Under **Push protection**, click **Enable**
3. This will block commits that contain detected secrets

#### 2. Custom Patterns (Optional)

You can add custom patterns to detect project-specific secrets:

1. Go to **Settings** → **Code security and analysis** → **Secret scanning**
2. Click **New pattern**
3. Add patterns for:
   - Database connection strings
   - API keys for CloudFront
   - PostgreSQL credentials
   - Any custom tokens

Example custom pattern for PostgreSQL connection strings:
```regex
postgresql:\/\/[a-zA-Z0-9_]+:[a-zA-Z0-9_!@#$%^&*()]+@[a-zA-Z0-9.-]+:[0-9]+\/[a-zA-Z0-9_]+
```

#### 3. Secret Scanning Alerts

Configure how you want to be notified about detected secrets:

1. Go to **Settings** → **Code security and analysis** → **Secret scanning**
2. Enable notifications:
   - Email notifications
   - GitHub notifications
   - Integration with security tools (if available)

### Responding to Secret Scanning Alerts

When a secret is detected:

1. **Revoke the exposed secret immediately**
   - For API keys: Rotate them in the service provider's dashboard
   - For database credentials: Change them in the database and update environment variables
   - For tokens: Generate new ones and update configuration

2. **Remove the secret from Git history**
   ```bash
   # Use BFG Repo-Cleaner or git-filter-repo
   git filter-repo --path .env --invert-paths

   # Or use BFG (recommended)
   bfg --delete-files .env
   bfg --replace-text passwords.txt  # File with passwords to redact
   ```

3. **Update your .gitignore**
   Ensure sensitive files are properly ignored:
   ```gitignore
   .env
   .env.local
   .env.*.local
   *.pem
   *.key
   *.p12
   secrets/
   credentials.json
   ```

4. **Mark the alert as resolved** in GitHub once the secret has been rotated

### Best Practices

1. **Never commit secrets**
   - Use environment variables
   - Use secret management tools (AWS Secrets Manager, HashiCorp Vault, etc.)
   - Use `.env` files (but never commit them!)

2. **Use pre-commit hooks**
   Install `detect-secrets` or `gitleaks` as a pre-commit hook:

   ```bash
   # Install gitleaks
   brew install gitleaks  # macOS
   # or
   curl -sSfL https://raw.githubusercontent.com/gitleaks/gitleaks/master/scripts/install.sh | sh -s -- -b /usr/local/bin

   # Run gitleaks before commits
   gitleaks protect --staged
   ```

3. **Regular audits**
   - Review secret scanning alerts weekly
   - Audit access to secrets quarterly
   - Rotate credentials regularly

4. **Environment-specific secrets**
   - Use different secrets for dev, staging, and production
   - Never use production credentials in development

5. **Document secret locations**
   Keep a secure inventory of where secrets are stored and used

## Dependabot Security Updates

Dependabot is already configured in `.github/dependabot.yml` to automatically create PRs for:
- npm dependency updates (weekly on Mondays at 9:00 UTC)
- Docker base image updates (weekly on Mondays at 10:00 UTC)
- GitHub Actions updates (weekly on Mondays at 11:00 UTC)

### Configuring Dependabot Alerts

1. Go to **Settings** → **Code security and analysis**
2. Under **Dependabot alerts**, ensure it's **Enabled**
3. Under **Dependabot security updates**, ensure it's **Enabled**

This will automatically create PRs to update dependencies with known security vulnerabilities.

## Tools for Local Secret Scanning

### 1. Gitleaks

Scan your repository for secrets before pushing:

```bash
# Install
brew install gitleaks

# Scan repository
gitleaks detect --source . --verbose

# Scan before commit
gitleaks protect --staged
```

### 2. detect-secrets

Baseline and scan for secrets:

```bash
# Install
pip install detect-secrets

# Create baseline
detect-secrets scan > .secrets.baseline

# Scan for new secrets
detect-secrets scan --baseline .secrets.baseline
```

### 3. TruffleHog

Deep scan including Git history:

```bash
# Install
pip install truffleHog

# Scan repository
trufflehog filesystem . --json
trufflehog git file://. --json
```

## Pre-commit Hook Example

Create `.git/hooks/pre-commit`:

```bash
#!/bin/bash

# Run gitleaks on staged files
gitleaks protect --staged --verbose

if [ $? -ne 0 ]; then
    echo "❌ Secret detected! Commit blocked."
    echo "Please remove the secret and try again."
    exit 1
fi

exit 0
```

Make it executable:
```bash
chmod +x .git/hooks/pre-commit
```

## Monitoring and Reporting

### GitHub Security Overview

View all security alerts in one place:
1. Go to **Security** tab
2. Review:
   - Dependabot alerts
   - Secret scanning alerts
   - Code scanning alerts (CodeQL)
   - Vulnerability alerts

### Notifications

Configure notification preferences:
1. Go to your GitHub **Settings** (personal settings, not repo)
2. Navigate to **Notifications** → **Security alerts**
3. Enable email notifications for:
   - Dependabot alerts
   - Secret scanning alerts
   - Vulnerable dependencies

## Resources

- [GitHub Secret Scanning Documentation](https://docs.github.com/en/code-security/secret-scanning)
- [GitHub Push Protection](https://docs.github.com/en/code-security/secret-scanning/push-protection)
- [Dependabot Documentation](https://docs.github.com/en/code-security/dependabot)
- [Gitleaks](https://github.com/gitleaks/gitleaks)
- [detect-secrets](https://github.com/Yelp/detect-secrets)
- [TruffleHog](https://github.com/trufflesecurity/trufflehog)
