# README information architecture overhaul

- Date: 2026-07-24
- Status: Implemented

## Goal

Rebuild the repository README as a first-class product and engineering entry point. A new reader should understand the platform in 30 seconds, run a verified local workflow in five minutes, and trace major architectural and security decisions within fifteen minutes.

## Decision

Use the visual hierarchy from the earlier portfolio-oriented README—brand hero, navigation, concise quality signals, workflow diagrams, and a completeness contract—while treating the current PostgreSQL, R2/MinIO, Vercel/Railway, and HMAC mail-relay implementation as the only runtime source of truth.

The README remains an entry point rather than an operations manual. Detailed secrets, recovery, R2 CORS, and rollout steps stay in docs/operations.md. Historical SQLite-era plans and ADRs remain available as project history but are explicitly distinguished from current production decisions.

## Reader flow

1. Hero: project purpose, public-beta status, CI, and technology signals.
2. Value: why persistent cross-role teaching workflows matter.
3. Evidence: four server-enforced journeys and three role workspaces.
4. Action: reproducible local quick start, readiness probe, and seeded demo accounts.
5. Understanding: deployment topology, component responsibilities, and trust boundaries.
6. Verification: Node tests, browser E2E, CI services, documentation, security, scope, and licensing.

## Facts protected by the rewrite

- Production API traffic uses only the /api/v1/* Vercel rewrite to Railway.
- Railway sends a signed minimal payload to Vercel /api/mail-relay; Gmail credentials stay in Vercel.
- PostgreSQL is the current database and R2/MinIO is the object-storage contract.
- The public beta runs one API instance because classroom presence is currently process-local.
- The test suite contains 71 Node tests and four cross-role browser workflows at the time of this rewrite.

## Acceptance criteria

- Chinese and English README files tell the same architecture story.
- Every major claim links to code, a test, or a current operations/ADR document.
- A reader can reach a ready API and seeded role account without hidden setup assumptions.
- Limitations are explicit rather than disguised as production capability.
