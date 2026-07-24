# Security Policy

## Supported versions

This project is maintained from the default branch. Security fixes target the latest commit on `main`; historical snapshots and private forks are not supported release lines.

## Reporting a vulnerability

Please do **not** disclose a suspected vulnerability in a public issue, discussion, pull request, screenshot, or demo environment.

1. Open a private report through [GitHub Security Advisories](https://github.com/computersciencefreshmen/International_Chinese_Platform/security/advisories/new).
2. If private reporting is unavailable, open a public issue that contains only a request for a private contact channel. Do not include exploit details, credentials, personal data, or affected URLs.
3. Include the affected commit or deployment version, prerequisites, reproducible steps, impact, and any suggested mitigation. Use synthetic data only.

We aim to acknowledge a report within 72 hours, complete initial triage within 7 days, and provide an update at least every 7 days until resolution. These targets are best-effort for a community project and are not a service-level agreement.

Please allow time for a fix and coordinated disclosure. After remediation, the project may publish an advisory crediting the reporter, unless anonymity is requested. This repository does not currently operate a paid bug-bounty program.

## Security expectations for operators

- Serve the site only through HTTPS and keep the browser, API, uploads, and WebSocket endpoint on one public origin.
- Never enable demo seeding in production and never bake administrator credentials into an image or Compose file.
- Store `VERIFICATION_CODE_SECRET`, SMTP, AI, and TURN credentials outside version control; grant access only to deployment operators and rotate them after suspected exposure.
- Keep secure, HttpOnly session cookies enabled, disable bearer authentication unless an audited non-browser client requires it, and configure the trusted proxy boundary deliberately.
- Back up PostgreSQL data, encrypt backup dumps, test restores, and restrict access to both the private object bucket and the backup bucket.
- Rebuild frequently from the lockfile and review dependency/security alerts before deploying.

Deployment hardening, backup, restore, migration, and secret-handling procedures are documented in [docs/operations.md](docs/operations.md).

## Scope and safe research

Good-faith reports about authentication, authorization, sensitive-data exposure, injection, file upload/download controls, session handling, WebSocket isolation, or deployment defaults are welcome. Do not access another person's data, degrade a service, send unsolicited messages, or retain data obtained during testing. Stop testing and report immediately if real personal data or credentials are encountered.
