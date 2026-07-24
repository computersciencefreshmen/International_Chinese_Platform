# 公开 Beta 部署与运维手册

本文档对应当前线上架构：Vercel 托管 Vue 前端和邮件中继函数，Railway 运行单实例 Fastify 与独立备份 Cron 服务，Railway PostgreSQL 保存业务数据，Cloudflare R2 私有 Bucket 保存文件与加密备份。

```text
Browser ── HTTPS ──> Vercel ── /api/v1/* rewrite ──> Railway Fastify ──> PostgreSQL
   │                                                    │
   ├── presigned PUT ───────────────────────────────────┴────────> private R2
   └── WSS /ws/classroom ───────────────────────────────────────> Railway

Railway Fastify ── HMAC HTTPS ──> Vercel /api/mail-relay ── SMTP 465 ──> Gmail
Railway Backup Cron ── pg_dump + AES-256-GCM ───────────────────────────> private R2
```

Beta 阶段只运行一个后端实例。实时房间状态保存在进程内；增加实例前必须引入跨实例广播与房间协调。

## 1. 生产变量

### Railway API

Railway 后端保存数据库、对象存储和邮件中继配置，但不保存 Gmail 应用密码：

```dotenv
NODE_ENV=production
HOST=0.0.0.0
DATABASE_URL=<Railway PostgreSQL reference>
DATABASE_SSL=true
DATABASE_POOL_MAX=10
APP_ORIGINS=https://international-chinese-platform.vercel.app
PUBLIC_WEBSOCKET_ORIGIN=wss://<railway-public-domain>
SECURE_COOKIES=true
ALLOW_BEARER_AUTH=false
TRUST_PROXY=1
SEED_ON_START=false
VERIFICATION_CODE_SECRET=<at-least-32-random-characters>
MAIL_RELAY_URL=https://international-chinese-platform.vercel.app/api/mail-relay
MAIL_RELAY_SECRET=<shared-at-least-32-character-random-secret>

S3_ENDPOINT=https://<cloudflare-account-id>.r2.cloudflarestorage.com
S3_REGION=auto
S3_BUCKET=<private-production-bucket>
S3_ACCESS_KEY_ID=<bucket-scoped-token-id>
S3_SECRET_ACCESS_KEY=<bucket-scoped-token-secret>
S3_FORCE_PATH_STYLE=false
```

`MAIL_RELAY_URL` 必须是无用户名、密码、查询参数和片段的 HTTPS URL。公开域名下 `TRUST_PROXY` 必须是明确跳数；不要配置成 `true`。

### Vercel 邮件中继

Railway Hobby 不提供 SMTP 出站能力，因此生产邮件由 Railway 通过 HTTPS 调用 Vercel Function。以下变量只配置在 Vercel 的目标环境：

```dotenv
MAIL_RELAY_SECRET=<same-value-as-railway>
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=yanghanyu2023@gmail.com
SMTP_PASS=<Gmail application password>
MAIL_FROM=International Chinese Platform <yanghanyu2023@gmail.com>
```

中继对 `timestamp + "." + raw JSON` 计算 HMAC-SHA-256，并只接受 5 分钟时间窗内、字段严格为 `email`、`code`、`expiresAt` 的请求。Railway 和 Vercel 必须共享同一个随机中继 Secret；Gmail 应用密码只存在于 Vercel，且变量不得使用 `VITE_` 前缀。

真实 Secret 只录入 Railway/Cloudflare/Vercel，不写入 Git、聊天、构建参数或日志。

## 2. R2 配置

Bucket 必须保持私有。Token 只授予目标 Bucket 的对象读写权限。浏览器 CORS 仅允许正式 Vercel 域名和明确的 staging 域名：

```json
[
  {
    "AllowedOrigins": ["https://international-chinese-platform.vercel.app"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["Content-Type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

为 `tmp/` 前缀设置 1 天生命周期删除规则，作为数据库清理 Outbox 之外的兜底。上传只进入 `tmp/uploads/`；服务端完成大小、魔数和 SHA-256 校验后，按 ETag 条件复制到新的 `files/` Key。正式 Key 从不签发 PUT URL。

## 3. 发布流程

1. 合并前运行 `pnpm check` 和跨角色 Playwright E2E。
2. 先在 Vercel 配置邮件中继和 SMTP 变量并部署 `/api/mail-relay`；无签名请求应返回 401。
3. Railway 构建 `Dockerfile`；`railway.json` 的 pre-deploy 命令先运行 `node server/db/migrate.js`。
4. `/api/v1/ready` 返回 200 后，让 Vercel 只转发版本化业务 API：

   ```json
   {
     "source": "/api/v1/:path*",
     "destination": "https://<railway-domain>/api/v1/:path*"
   }
   ```

5. 将 SPA fallback 放在 rewrite 列表最后。不要转发整个 `/api/*`，否则 `/api/mail-relay` 会被误送到 Railway。
6. 在 Railway 配置生产中继 URL 和共享 Secret；触发真实邮箱验证码，确认 API 不返回开发验证码。
7. 刷新任意 SPA 路由，确认返回页面；请求不存在的 `/api/v1/*`，确认返回 JSON 404 而不是 `index.html`。
8. 完成教师申请、管理员审核、课程、预约、课堂、作业全链路冒烟。

生产环境会拒绝 `SEED_ON_START=true`。演示数据只能在本地或测试环境显式执行 `pnpm db:seed`。

## 4. 管理员初始化

空库迁移后，在 Railway 一次性任务中设置 `ADMIN_EMAIL`、`ADMIN_PASSWORD`、`ADMIN_DISPLAY_NAME`，执行：

```bash
node server/db/bootstrap-admin.js
```

命令只创建首个管理员，密码以 scrypt 保存，并标记为必须首次改密。成功后立刻删除 `ADMIN_PASSWORD` Secret。管理员登录后只能查看会话、退出或修改密码；其他 API 在改密前返回 `PASSWORD_RESET_REQUIRED`。

## 5. 探针与监控

- `/api/v1/health`：进程存活。
- `/api/v1/ready`：PostgreSQL 不可用时返回 503；R2 不可用时返回 200 且状态为 `degraded`。
- 监控 5xx、429、进程重启、数据库连接池耗尽、对象清理任务重试，以及 Railway 到中继和 Vercel 到 Gmail 的两段邮件失败。
- 中继 401 通常表示 Secret、签名或时钟问题；502 表示 Gmail 投递失败；503 表示 Vercel 中继环境变量不完整。
- Railway 与 Vercel 日志不得输出 Cookie、验证码、中继 Secret、SMTP 密码、数据库 URL 或 R2 Secret。
- 监控独立备份服务的 Cron 执行状态，并定期确认最新加密对象已写入目标 Bucket。

## 6. 备份与恢复

独立 Railway 服务使用同一运行时镜像，并由 [`railway.backup.json`](../railway.backup.json) 在每天 `18:00 UTC`（北京时间次日 `02:00`）执行 `node server/ops/backup.js`。它使用 PostgreSQL 18 客户端的 `pg_dump --format=custom`，再以 AES-256-GCM 加密并上传私有 Bucket。较新的 `pg_dump` 也兼容本项目本地 PostgreSQL 15 环境。备份服务需要：

```dotenv
DATABASE_URL=<production database>
DATABASE_SSL=true
BACKUP_ENCRYPTION_KEY=<base64 encoded 32-byte key>
S3_ENDPOINT=<same R2 endpoint as API>
S3_REGION=auto
S3_ACCESS_KEY_ID=<backup-capable token id>
S3_SECRET_ACCESS_KEY=<backup-capable token secret>
S3_BACKUP_BUCKET=international-chinese-platform-staging
```

当前公开 Beta 暂时复用 `international-chinese-platform-staging` 作为加密备份 Bucket，生产应用文件仍写入 production Bucket。它不是长期隔离方案：启用真实 staging 文件上传前，应创建专用私有备份 Bucket、迁移已加密对象并更新 `S3_BACKUP_BUCKET`。

保留 7 个日备份和 4 个周备份。每次 Cron 后检查任务成功和新对象时间；每月在临时 PostgreSQL 实例执行恢复演练。

恢复必须先在隔离环境验证。确认目标数据库允许被覆盖后设置 `BACKUP_FILE` 与 `CONFIRM_RESTORE=RESTORE`，运行 `node server/ops/restore.js`。目标 RPO 为 24 小时，RTO 为 4 小时。

## 7. 回滚

- 前端恢复上一版 Vercel Deployment。
- 后端恢复上一版 Railway Image。
- 首发迁移只做扩展型变更；回滚应用时保留新增表和字段，不立即执行破坏性 down migration。
- 如数据损坏，先冻结写入、保存当前应急备份，再按最近一次已验证备份恢复。

## 8. 本地一致环境

```bash
docker compose up -d postgres minio minio-init
pnpm db:migrate
pnpm db:seed
pnpm dev
```

本地 PostgreSQL 在 `127.0.0.1:5432`，MinIO API 在 `127.0.0.1:9000`，控制台在 `127.0.0.1:9001`。不要把 Compose 默认凭据用于公网。

## 9. 已知 Beta 限制

- 单 Railway 后端实例，没有 Redis 房间广播。
- 没有 TURN；严格 NAT 下音视频可能失败。
- 没有支付、正式入学、课程录像或外部付费 AI。
- 多实例和高可用不在本轮范围内。
- Railway Hobby 不能直接发送 SMTP；注册邮件依赖 Vercel HTTPS 中继及 Gmail 可用性。
