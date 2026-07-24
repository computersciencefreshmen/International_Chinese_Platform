# Public Beta cloud deployment runbook

## Services

- Vercel project: `international-chinese-platform`
- Railway: one Dockerfile-backed Fastify API, one PostgreSQL service, and one independent backup Cron service
- Cloudflare R2: separate private `staging` and `production` buckets
- Gmail SMTP: `yanghanyu2023@gmail.com` from a Vercel Function; Railway calls it over HMAC-authenticated HTTPS

## Railway production variables

Set `NODE_ENV=production`, `HOST=0.0.0.0`, `DATABASE_URL` from the PostgreSQL reference, `DATABASE_SSL=true`, `DATABASE_POOL_MAX=10`, `APP_ORIGINS=https://international-chinese-platform.vercel.app`, `PUBLIC_WEBSOCKET_ORIGIN=wss://<railway-domain>`, `SECURE_COOKIES=true`, `ALLOW_BEARER_AUTH=false`, `TRUST_PROXY=1`, `SEED_ON_START=false`, and a random `VERIFICATION_CODE_SECRET` of at least 32 characters.

Set R2 variables `S3_ENDPOINT`, `S3_REGION=auto`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, and `S3_FORCE_PATH_STYLE=false`. Set `MAIL_RELAY_URL=https://international-chinese-platform.vercel.app/api/mail-relay` and a random `MAIL_RELAY_SECRET` of at least 32 characters. Do not put Gmail SMTP credentials in Railway.

## Vercel mail relay variables

Set the same `MAIL_RELAY_SECRET` in Vercel, plus `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465`, `SMTP_SECURE=true`, `SMTP_USER=yanghanyu2023@gmail.com`, `SMTP_PASS=<app-password>`, and `MAIL_FROM=International Chinese Platform <yanghanyu2023@gmail.com>`.

Railway Hobby blocks SMTP egress, so the API signs the exact JSON request body and a Unix timestamp with HMAC-SHA-256 before calling `/api/mail-relay` over HTTPS. The function rejects signatures outside a five-minute window and accepts only `email`, `code`, and `expiresAt`. Gmail credentials remain only in Vercel.

Secrets must be entered directly in their owning platform. Never commit or paste Gmail, relay, database, R2, backup encryption, or administrator passwords into Git.

## R2 browser CORS

Apply this policy to each application bucket, replacing the staging origin with its exact assigned domain:

```json
[
  {
    "AllowedOrigins": [
      "https://international-chinese-platform.vercel.app",
      "https://<exact-staging-domain>"
    ],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["Content-Type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

Add a one-day lifecycle expiration rule for the `tmp/` prefix. The application normally removes temporary objects through its retryable cleanup queue; the lifecycle rule is the final orphan-object safety net.

## Release order

1. Create Railway staging PostgreSQL and API services, then attach the repository.
2. Create the staging R2 bucket and minimum-scope object read/write token.
3. Configure the Vercel relay variables and deploy `/api/mail-relay`; verify an unsigned request is rejected.
4. Deploy Railway; `railway.json` runs `node server/db/migrate.js` before startup.
5. Verify `/api/v1/health`, `/api/v1/ready`, upload and WebSocket ticket creation.
6. Put the exact Railway HTTPS origin in the first Vercel rewrite, before the SPA fallback:

   ```json
   {
     "source": "/api/v1/:path*",
     "destination": "https://<railway-domain>/api/v1/:path*"
   }
   ```

7. Keep `/api/mail-relay` on Vercel by never rewriting the broader `/api/*` prefix. Deploy and validate a Vercel preview, then repeat for production.
8. Configure Railway's production relay URL and shared Secret, then verify a real registration email without a development code in the response.
9. Bootstrap the only production administrator with `ADMIN_EMAIL=yanghanyu2023@gmail.com`, a generated temporary password, and `node server/db/bootstrap-admin.js`. The account is forced to change that password after login.

## Backup and recovery

The independent Railway service uses [`railway.backup.json`](../../railway.backup.json) to run `node server/ops/backup.js` every day at `18:00 UTC` (`02:00` the next day in Asia/Shanghai). Generate `BACKUP_ENCRYPTION_KEY` as 32 random bytes encoded in base64. The job retains seven daily and four Sunday weekly AES-256-GCM encrypted custom-format dumps.

The current public Beta temporarily sets `S3_BACKUP_BUCKET=international-chinese-platform-staging`. Production application objects remain in the production Bucket. Before using staging for application uploads, create a dedicated private backup Bucket, migrate the encrypted backup objects, and update the Cron service.

For the monthly restore drill, download a backup to an isolated worker, point `DATABASE_URL` at a disposable PostgreSQL database, and run:

```bash
CONFIRM_RESTORE=RESTORE BACKUP_FILE=/tmp/database.dump.enc node server/ops/restore.js
```

Never run a restore drill against production. Beta targets are RPO 24 hours and RTO 4 hours.

## Rollback

The first release uses expand-only migrations. Roll back with the previous Vercel deployment and Railway image; keep added database columns/tables in place until a later reviewed cleanup migration.
