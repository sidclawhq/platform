# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| Latest on `main` | Yes |
| `@sidclaw/sdk` (npm) | Yes |

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Instead, please email **security@sidclaw.com** with:

1. A description of the vulnerability
2. Steps to reproduce
3. Affected component (SDK, API, dashboard, etc.)
4. Potential impact assessment

### What to Expect

- **Acknowledgment** within 2 business days
- **Initial assessment** within 5 business days
- **Fix timeline** communicated after assessment — typically within 14 days for critical issues

### Scope

The following are in scope:

- Authentication and authorization bypasses
- Cross-tenant data leakage
- Injection vulnerabilities (SQL, XSS, command injection)
- Audit trail integrity violations (hash chain tampering)
- API key or secret exposure
- CSRF bypasses
- SDK vulnerabilities affecting downstream consumers

The following are out of scope:

- Denial of service (rate limiting is in-memory by design)
- Issues in the `v0-prototype/` directory (archived, not deployed)
- Social engineering
- Issues requiring physical access

## Security Architecture

SidClaw is a governance platform — security is foundational to the product. Key security properties:

- **Tenant isolation**: Prisma `$extends` injects `tenant_id` into all queries at the ORM level
- **Audit integrity**: SHA-256 hash chains on audit events, verifiable via API
- **Secret storage**: API keys stored as SHA-256 hashes, never in plaintext
- **Auth**: bcrypt password hashing, OIDC/OAuth for enterprise SSO, CSRF tokens on state-changing requests
- **Webhook signatures**: HMAC-SHA256 for webhook payload verification
