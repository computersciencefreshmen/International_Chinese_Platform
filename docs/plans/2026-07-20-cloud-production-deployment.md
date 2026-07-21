# Public Beta cloud deployment runbook

## Services

- Vercel project: `international-chinese-platform`
- Railway: one Dockerfile-backed Fastify service plus one PostgreSQL service
- Cloudflare R2: separate private `staging` and `production` buckets
- Gmail SMTP: `yanghanyu2023@gmail.com` with an application password

## Railway production variables

Set `NODE_ENV=production`, `HOST=0.0.0.0`, `DATABASE_URL` from the PostgreSQL reference, `DATABASE_SSL=true`, `DATABASE_POOL_MAX=10`, `APP_ORIGINS=https://international-chinese-platform.vercel.app`, `PUBLIC_WEBSOCKET_ORIGIN=wss://<railway-domain>`, `SECURE_COOKIES=true`, `ALLOW_BEARER_AUTH=false`, `TRUST_PROXY=1`, `SEED_ON_START=false`, and a random `VERIFICATION_CODE_SECRET` of at least 32 characters.

Set R2 variables `S3_ENDPOINT`, `S3_REGION=auto`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, and `S3_FORCE_PATH_STYLE=false`. Set Gmail variables `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465`, `SMTP_SECURE=true`, `SMTP_USER=yanghanyu2023@gmail.com`, `SMTP_PASS=<app-password>`, and `MAIL_FROM=International Chinese Platform <yanghanyu2023@gmail.com>`.

Secrets must be entered directly in Railway. Never commit or paste Gmail, database, R2, backup encryption, or administrator passwords into Git.

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
Add a one-day lifecycle expiration rule for the `tmp/` prefix. The application normally removes temporary objects through its retryable cleanup queue; the lifecycle rule is the final orphan-object safety net.

```

## Release order

1. Create Railway staging PostgreSQL and API services, then attach the repository.
2. Create the staging R2 bucket and minimum-scope object read/write token.
3. Deploy Railway; `railway.json` runs `node server/db/migrate.js` before startup.
4. Verify `/api/v1/health`, `/api/v1/ready`, registration, upload and WebSocket ticket creation.
5. Put the exact Railway HTTPS origin in the first Vercel rewrite, before the SPA fallback:

   ```json
   {
     "source": "/api/:path*",
     "destination": "https://<railway-domain>/api/:path*"
   }
   ```

6. Deploy and validate a Vercel preview, then repeat for production.
7. Bootstrap the only production administrator with `ADMIN_EMAIL=yanghanyu2023@gmail.com`, a generated temporary password, and `node server/db/bootstrap-admin.js`. The account is forced to change that password after login.

## Backup and recovery

Create a separate least-privilege R2 backup bucket or set `S3_BACKUP_BUCKET`. Generate `BACKUP_ENCRYPTION_KEY` as 32 random bytes encoded in base64. A Railway cron service using the same image runs `node server/ops/backup.js` daily. It retains seven daily and four Sunday weekly AES-256-GCM encrypted custom-format dumps.

For the monthly restore drill, download a backup to an isolated worker, point `DATABASE_URL` at a disposable PostgreSQL database, and run:

```bash
CONFIRM_RESTORE=RESTORE BACKUP_FILE=/tmp/database.dump.enc node server/ops/restore.js
```

Never run a restore drill against production. Beta targets are RPO 24 hours and RTO 4 hours.

## Rollback

The first release uses expand-only migrations. Roll back with the previous Vercel deployment and Railway image; keep added database columns/tables in place until a later reviewed cleanup migration.
