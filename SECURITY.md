# Security Policy

## Reporting a vulnerability
Please report vulnerabilities privately through **GitHub private vulnerability reporting**: open the repository's **Security** tab and choose **Report a vulnerability** (GitHub Security Advisories).

Do not open a public issue or pull request for a vulnerability. Reports are acknowledged and handled through the advisory, which is published once a fix is available.

## Supported versions
| Version | Supported |
|---|---|
| `main` (Unreleased) | Yes |
| 0.0.0 (design baseline) | No |

Only the latest `main` receives security fixes until the first release.

## Secret handling rules
- **AWS access uses OIDC and temporary credentials only** (GitHub Actions OIDC, ADR-0012). No long-term access keys, anywhere: not in the repo, CI secrets, or developer machines for this project.
- Never commit secrets, credentials, tokens, private keys, or email addresses. CI runs gitleaks over the full history and every PR diff.
- Runtime secrets (e.g. the origin-verify header value) live in SSM Parameter Store as SecureString and are never logged; logs carry the parameter name only.
- If a secret is committed by mistake, treat it as compromised: rotate it first, then remove it.
