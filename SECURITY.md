# Security Policy

## Reporting a Vulnerability

We take the security of this project seriously. If you discover a security vulnerability, please follow the steps below.

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, report them via email to the project maintainer. If you do not have a direct contact, please open a GitHub Issue with the label `security` and the maintainer will follow up privately.

### What to Include

When reporting a vulnerability, please include:

- A clear description of the issue
- Steps to reproduce the vulnerability
- Affected versions and configuration
- Any potential impact or exploit scenarios
- Your contact information for follow-up

### What to Expect

- **Acknowledgment**: You will receive an acknowledgment of your report within 48 hours.
- **Status Updates**: We will provide updates on the investigation and remediation progress.
- **Disclosure**: We coordinate disclosure and will credit you in the advisory if you wish.

## Scope

The following areas are in scope for security review:

- **Worker (CLI)**: Token handling (`GITHUB_TOKEN_PRIVATE`, `GITHUB_TOKEN_PERSONAL`), repository data processing, backup archive integrity.
- **Backend (Dashboard/API)**: Authentication, database access (`POSTGRES_URL`), WebSocket connections, API rate limiting.
- **Configuration**: Environment variable handling, `.env` file management, secret exposure.
- **Dependencies**: Third-party Go modules, npm packages in the frontend.

## Best Practices

- **Never commit secrets** – Use `.env` files (excluded via `.gitignore`) or environment variables.
- **Use short-lived tokens** – Regularly rotate `GITHUB_TOKEN_*` values.
- **Restrict `BACKUP_REPO_PATH`** – Ensure the backup remote is an authenticated, private repository.
- **Keep dependencies updated** – Run `go mod tidy` and review frontend dependency updates periodically.

## Supported Versions

| Version | Supported          |
|---------|--------------------|
| Latest  | Active support     |
| Older   | Not supported      |

Only the latest release of this project is actively supported with security updates.

## Contact

For security-related matters, please open a GitHub Issue with the `security` label, or contact the repository owner directly via the GitHub profile.
