# ADR 0004: Cloudflare R2 for durable file storage

- Status: Accepted
- Date: 2026-07-20

## Decision

Store uploads in a private Cloudflare R2 bucket through the S3 API. Browsers upload to temporary object keys through ten-minute presigned PUT URLs whose content type and content length are signed. The API reserves quota in PostgreSQL, claims each completion once, validates the temporary object by size, SHA-256 and magic bytes, then conditionally copies the validated ETag to a new immutable final key. It returns five-minute signed download redirects only after authorization.

## Consequences

Large files do not traverse Vercel or Railway request bodies. Reusing an unexpired upload URL can only replace the temporary object and cannot mutate an already-promoted file. Pending and interrupted validation intents expire and release reserved quota. Temporary and deleted objects are removed through a retryable PostgreSQL cleanup outbox, with an R2 lifecycle rule on the temporary prefix as a final safety net. Development uses MinIO with the same S3 interface; API tests use an in-memory adapter for deterministic failure cases.
