# WAF Deployment Guide

Deploy a Web Application Firewall to protect against common attacks.

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

## Quick Setup - Cloudflare (Recommended)

**Free tier available, easiest setup**

1. Sign up at [cloudflare.com](https://www.cloudflare.com/)
2. Add your domain
3. Update nameservers at your registrar
4. Enable WAF in Security → WAF
5. Use "OWASP Core Ruleset" managed rules

**Key Rules to Enable:**
- SQL injection protection
- XSS protection
- Rate limiting (100 req/min per IP)
- Bot mitigation

## Alternative Options

### AWS WAF ($5/month + requests)
```bash
# Via AWS Console
1. Create Web ACL
2. Add OWASP rule group
3. Associate with ALB/CloudFront
4. Configure rate limiting
```

### ModSecurity (Self-hosted, Free)
```nginx
# nginx.conf
load_module modules/ngx_http_modsecurity_module.so;

http {
    modsecurity on;
    modsecurity_rules_file /etc/nginx/modsec/main.conf;
}
```

Install OWASP Core Rule Set:
```bash
cd /etc/nginx/modsec
git clone https://github.com/coreruleset/coreruleset.git
cp coreruleset/crs-setup.conf.example crs-setup.conf
```

## Essential WAF Rules

1. **SQL Injection** - Block `' OR 1=1--` patterns
2. **XSS** - Block `<script>` tags
3. **Path Traversal** - Block `../` patterns
4. **Rate Limiting** - 100 requests/min per IP
5. **Geo-blocking** - Block suspicious countries (optional)

## Testing

```bash
# Test SQL injection block
curl "https://your-domain.com/api/ratings?title=test' OR 1=1--"
# Should return 403 Forbidden

# Test rate limit
for i in {1..150}; do curl https://your-domain.com/; done
# Should get blocked after 100 requests
```

## Monitoring

- Review WAF logs daily
- Tune rules to reduce false positives
- Set up alerts for blocked attack attempts

## Resources

- [Cloudflare WAF](https://developers.cloudflare.com/waf/)
- [AWS WAF](https://docs.aws.amazon.com/waf/)
- [ModSecurity](https://github.com/SpiderLabs/ModSecurity)
- [OWASP CRS](https://coreruleset.org/)
