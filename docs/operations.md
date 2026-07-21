# 公开 Beta 部署与运维手册

本文档对应当前云架构：Vercel 托管 Vue 前端，Railway 运行单实例 Fastify，Railway PostgreSQL 保存业务数据，Cloudflare R2 私有 Bucket 保存文件。

```text
Browser ── HTTPS ──> Vercel ── /api/* ──> Railway Fastify ──> PostgreSQL
   │                                      │
   ├── presigned PUT ─────────────────────┴───────────────> private R2
   └── WSS /ws/classroom ────────────────────────────────> Railway
```

Beta 阶段只运行一个后端实例。实时房间状态保存在进程内；增加实例前必须引入跨实例广播与房间协调。

## 1. 生产变量

Railway 后端必须配置：

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

SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=yanghanyu2023@gmail.com
SMTP_PASS=<Gmail application password>
MAIL_FROM=International Chinese Platform <yanghanyu2023@gmail.com>

S3_ENDPOINT=https://<cloudflare-account-id>.r2.cloudflarestorage.com
S3_REGION=auto
S3_BUCKET=<private-production-bucket>
S3_ACCESS_KEY_ID=<bucket-scoped-token-id>
S3_SECRET_ACCESS_KEY=<bucket-scoped-token-secret>
S3_FORCE_PATH_STYLE=false
```

真实 Secret 只录入 Railway/Cloudflare/Vercel，不写入 Git、聊天、构建参数或日志。公开域名下 `TRUST_PROXY` 必须是明确跳数；不要配置成 `true`。

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
2. Railway 构建 `Dockerfile`；`railway.json` 的 pre-deploy 命令先运行 `node server/db/migrate.js`。
3. `/api/v1/ready` 返回 200 后，再把 Vercel `/api/:path*` rewrite 指向 Railway 公网域名。
4. 刷新任意 SPA 路由，确认返回页面；请求不存在的 `/api/*`，确认返回 JSON 404 而不是 `index.html`。
5. 完成学生注册邮件、教师申请、管理员审核、课程、预约、课堂、作业全链路冒烟。

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
- 监控 5xx、429、进程重启、数据库连接池耗尽、对象清理任务重试和 SMTP 失败。
- Railway 日志不得输出 Cookie、验证码、SMTP 密码、数据库 URL 或 R2 Secret。

## 6. 备份与恢复

Railway Cron 在运行时镜像中执行 `node server/ops/backup.js`，使用 PostgreSQL 18 客户端的 `pg_dump --format=custom`，再以 AES-256-GCM 加密并上传备份 Bucket。较新的 `pg_dump` 也兼容本项目本地 PostgreSQL 15 环境。需要：

```dotenv
DATABASE_URL=<production database>
BACKUP_ENCRYPTION_KEY=<base64 encoded 32-byte key>
S3_BACKUP_BUCKET=<separate private backup bucket>
```

保留 7 个日备份和 4 个周备份。每天由 Railway Cron 运行；每月在临时 PostgreSQL 实例执行恢复演练。

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
