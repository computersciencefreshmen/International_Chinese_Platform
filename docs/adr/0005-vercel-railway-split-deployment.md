# ADR 0005: Split Vercel frontend and Railway backend

- Status: Accepted
- Date: 2026-07-20

## Decision

Serve the Vue SPA from Vercel and the single-instance Fastify API from Railway. Vercel externally rewrites `/api/v1/:path*` to Railway, while classroom WebSockets connect directly to the Railway WSS origin returned in the one-time ticket response.

## Consequences

HTTP sessions remain first-party HttpOnly cookies. The backend stays at one instance during Beta because classroom presence is in memory. TURN, Redis fan-out and multi-instance high availability are deferred.
