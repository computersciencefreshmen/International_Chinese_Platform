# ADR 0006: Relay production email through Vercel over HMAC HTTPS

- Status: Accepted
- Date: 2026-07-23

## Context

The Railway Hobby plan does not provide outbound SMTP, so the Fastify service cannot connect directly to Gmail even with valid application credentials. Registration still requires real verification email, and the Gmail password must not be exposed to the browser or committed to the repository.

## Decision

Keep Gmail SMTP variables only in the Vercel server environment. Railway sends the minimal `email`, `code`, and `expiresAt` payload to the Vercel `/api/mail-relay` function over HTTPS.

Each request includes a Unix timestamp and an HMAC-SHA-256 signature over `timestamp + "." + raw JSON`, using a random shared Secret stored in Railway and Vercel. The function uses constant-time signature comparison, accepts at most five minutes of clock skew, validates an exact payload schema, and then sends through Gmail SMTP.

Vercel rewrites only `/api/v1/:path*` to Railway. The narrower boundary leaves `/api/mail-relay` executing locally on Vercel.

## Consequences

- Real registration email works without upgrading Railway solely for SMTP.
- Gmail credentials have a smaller blast radius because they never enter Railway or client-side variables.
- The relay is not a general public mail endpoint: unsigned, stale, malformed, or extra-field requests are rejected.
- Mail delivery gains an additional HTTPS hop and depends on both Railway and Vercel availability.
- Secret rotation must update both platforms together, and monitoring must distinguish relay authentication failures from Gmail delivery failures.
