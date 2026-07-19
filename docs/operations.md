# 生产部署与运维手册

本手册面向单机 Docker Compose 生产部署。平台是一个 Vue 3 + Fastify + SQLite 的模块化单体：同一进程提供编译后的前端、`/api/v1` API、`/uploads` 文件和 `/ws` 实时连接。

> SQLite 部署应始终保持一个应用副本。不要让多个容器通过网络文件系统共享同一数据库。如果需要水平扩展，应先将持久层迁移到适合多实例的数据库。

## 1. 生产拓扑与持久数据

Compose 默认只将 `127.0.0.1:7777` 暴露给宿主机，应由 Nginx、Caddy 或云负载均衡器终止 TLS：

```text
Internet -> HTTPS reverse proxy -> 127.0.0.1:7777 -> Fastify
                                                    |-- /app/data/platform.db
                                                    `-- /app/uploads
```

两个命名卷分别保存数据库与用户上传文件：

| Compose 卷（默认物理名）                                         | 容器目录       | 内容                             |
| ---------------------------------------------------------------- | -------------- | -------------------------------- |
| `platform-database`（`international-chinese-platform-database`） | `/app/data`    | SQLite 主文件及 WAL/SHM 辅助文件 |
| `platform-uploads`（`international-chinese-platform-uploads`）   | `/app/uploads` | 头像、作业和课程附件             |

镜像为多阶段 Node 24 构建，运行阶段不包含编译工具，以 UID/GID `10001` 的非 root 用户运行。Compose 另外启用只读根文件系统、临时 `/tmp`、全 capability 丢弃和 `no-new-privileges`。

## 2. 准备生产配置

需要 Docker Engine 和 Docker Compose v2。先在部署机上创建不纳入 Git 的 `.env.production`，限制为仅部署用户可读：

```dotenv
APP_ORIGIN=https://chinese.example.com
APP_PORT=7777
BIND_ADDRESS=127.0.0.1

# 可选：稳定的 Docker 卷名，也可用于恢复时安全切换到新卷
DATABASE_VOLUME_NAME=international-chinese-platform-database
UPLOAD_VOLUME_NAME=international-chinese-platform-uploads

# 至少 32 字节的稳定随机值；不要在每次发布时更换
VERIFICATION_CODE_SECRET=replace-with-a-random-secret

SESSION_TTL_HOURS=12
SECURE_COOKIES=true
TRUST_PROXY=true
ALLOW_BEARER_AUTH=false

# 生产注册验证邮件必需
SMTP_URL=smtps://username:percent-encoded-password@smtp.example.com:465
MAIL_FROM=International Chinese Platform <no-reply@example.com>

# 可选外部能力
AI_API_URL=
AI_API_KEY=
TURN_URL=
TURN_USERNAME=
TURN_CREDENTIAL=
```

生成验证码密钥的一种方式是 `openssl rand -hex 32`。请使用密钥管理器或受限制的环境文件；不要把真实值写入镜像、Compose 文件、CI 日志或 shell 历史。注意 Docker 环境变量对具有容器检查权限的运维人员可见。

`SEED_ON_START=false` 在生产 Compose 中是固定值：生产容器不会创建演示账号或演示数据。Compose 也不声明任何 `ADMIN_*` 变量。

## 3. 构建、启动与验证

```bash
docker compose --env-file .env.production build --pull
docker compose --env-file .env.production up -d
docker compose --env-file .env.production ps
docker compose --env-file .env.production logs --tail=100 app
```

首次启动会创建 SQLite 文件并自动应用未执行的有序迁移。两个探针的意义不同：

- `GET /api/v1/health`：进程存活。
- `GET /api/v1/ready`：应用就绪且数据库可读。Docker 健康检查使用此接口。

```bash
curl --fail https://chinese.example.com/api/v1/health
curl --fail https://chinese.example.com/api/v1/ready
```

如果使用宿主目录替代命名卷，请先确保目录属于 `10001:10001` 且不对其他用户开放写权限，否则数据库或上传会因权限错误失败。

## 4. 反向代理与同源要求

浏览器页面、API、上传文件与 WebSocket 必须对外使用完全相同的 scheme、host 和 port。`APP_ORIGIN` 必须精确等于这个公网 origin，不要带路径或末尾斜杠。一个 Nginx 示例如下：

```nginx
map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}

server {
    listen 443 ssl http2;
    server_name chinese.example.com;

    # ssl_certificate /etc/letsencrypt/live/chinese.example.com/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/chinese.example.com/privkey.pem;

    client_max_body_size 50m;

    location / {
        proxy_pass http://127.0.0.1:7777;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_read_timeout 3600s;
    }
}
```

不要单独将 API 发布到另一个 origin。同源部署才能与默认的 HttpOnly/SameSite/Secure 会话 Cookie、来源检查和 WebSocket 路由保持一致。只有反向代理是受信边界时才设置 `TRUST_PROXY=true`，并确保应用端口不可被公网绕过。

## 5. 首个管理员引导

首次部署就绪后，通过一次性容器执行引导。密码必须至少 12 位，并同时包含大写字母、小写字母、数字和特殊字符。先在当前 shell 中安全注入下列三个变量：

```text
ADMIN_EMAIL
ADMIN_PASSWORD
ADMIN_DISPLAY_NAME
```

然后执行：

```bash
docker compose --env-file .env.production run --rm \
  -e ADMIN_EMAIL -e ADMIN_PASSWORD -e ADMIN_DISPLAY_NAME \
  app node server/db/bootstrap-admin.js
```

不要把密码直接写在命令行或 `.env.production` 中。成功后立即从 shell 清除三个变量。引导程序只允许创建第一个管理员；如果已存在管理员，它会拒绝覆盖。

## 6. 数据库迁移与发布

应用在打开数据库时检查 `schema_migrations` 台账，并在事务中按顺序应用新迁移。也可以在维护窗口显式执行：

```bash
docker compose --env-file .env.production stop app
docker compose --env-file .env.production run --rm app node server/db/migrate.js
docker compose --env-file .env.production up -d
```

推荐发布流程：

1. 验证新镜像来源和依赖审计结果。
2. 创建数据库与上传文件的一致备份。
3. 在维护窗口停止应用并执行迁移。
4. 启动新镜像，确认 `/ready`、登录、文件访问和 WebSocket 连接。
5. 保留旧镜像与发布前备份，直到观察窗口结束。

当前迁移是向前迁移，不提供自动 down migration。需要回滚数据结构时，请还原发布前备份，而不是手工删改生产表。

## 7. 备份

备份必须同时包含 `/app/data` 和 `/app/uploads`。只备份 SQLite 会丢失附件；只备份上传目录会丢失文件索引和权限关系。

最简单可靠的方式是在短维护窗口执行冷备份：

1. 确认磁盘空间，创建带 UTC 时间戳的宿主备份目录。
2. 执行 `docker compose --env-file .env.production stop app`，等待优雅停机完成。
3. 用 `docker compose --env-file .env.production cp app:/app/data/. <backup>/database` 复制完整数据目录。
4. 用 `docker compose --env-file .env.production cp app:/app/uploads/. <backup>/uploads` 复制完整上传目录。
5. 执行 `docker compose --env-file .env.production start app`，并确认 `/ready`。
6. 压缩备份，生成 SHA-256 校验和，使用独立密钥加密，然后复制到另一存储位置。

不要在应用写入期间用普通文件复制直接抓取 `platform.db`；WAL 模式下这样的副本可能不一致。如果业务无法接受短暂停机，请引入经验证的 SQLite 在线备份方案，并定期做恢复演练。

建议至少保留每日 7 份、每周 4 份和每月 6 份，实际策略应按数据保留法规和可接受的 RPO/RTO 确定。

## 8. 恢复演练

先在隔离环境演练，再恢复生产。恢复前必须再做一份当前数据的应急备份。

1. 校验备份的 SHA-256、解密并确认包含 `database/platform.db` 和 `uploads/`。
2. 停止应用并做当前数据的应急备份，然后执行 `docker compose --env-file .env.production down`。不要附加 `--volumes`；原卷将作为回退点保留。
3. 复制一份 `.env.production` 为受限制的 `.env.restore`，只将 `DATABASE_VOLUME_NAME` 和 `UPLOAD_VOLUME_NAME` 改为新的、带恢复时间戳的名称。
4. 执行 `docker compose --env-file .env.restore create app`，让 Docker 创建干净卷和已停止的容器。
5. 用 `docker compose --env-file .env.restore cp <backup>/database/. app:/app/data` 和 `docker compose --env-file .env.restore cp <backup>/uploads/. app:/app/uploads` 导入备份。
6. 如果复制改变了所有者，执行一次性权限修复：`docker compose --env-file .env.restore run --rm --user 0 --cap-add CHOWN --cap-add DAC_OVERRIDE --entrypoint chown app -R 10001:10001 /app/data /app/uploads`。
7. 执行 `docker compose --env-file .env.restore run --rm app node server/db/migrate.js`，再执行 `docker compose --env-file .env.restore up -d`。
8. 检查 `/ready`，并用最小冒烟测试验证用户数、课程、预约、作业、附件下载与实时教室。确认恢复点可用后，再将受管理的生产配置切换到这两个新卷。

复制回已有卷会改变生产数据。每次操作前都要记录完整卷名、备份标识和操作人，并采用双人复核。

## 9. 外部适配器与密钥

| 变量                        | 用途           | 运维要求                                              |
| --------------------------- | -------------- | ----------------------------------------------------- |
| `VERIFICATION_CODE_SECRET`  | 验证码 HMAC    | 高熵、稳定保存；轮换会使待使用验证码失效              |
| `SMTP_URL` / `MAIL_FROM`    | 注册邮件       | 生产注册必需；URL 内密码应正确百分号编码              |
| `AI_API_URL` / `AI_API_KEY` | 服务端 AI 对话 | 只允许 HTTPS 且可信的供应商；确认数据保留条款         |
| `TURN_URL` / 用户名 / 凭据  | WebRTC 中继    | TURN 凭据会发给授权教室客户端，应限权、轮换并监控流量 |

外部 AI 未配置时，核心教学工作流仍可运行；TURN 未配置时，直连 WebRTC 可能在严格 NAT 或企业网络中失败。SMTP 未配置时，生产环境不会回传开发验证码，新用户注册将不可用。

## 10. 监控与事故处理

至少监控以下信号：

- `/ready` 成功率和延迟；
- 容器重启次数、CPU、内存和文件句柄；
- 数据卷剩余空间、SQLite 文件与 WAL 增长；
- HTTP 5xx/429、邮件发送失败、AI 适配器失败和 WebSocket 异常断开；
- 备份完成时间、大小、校验和与恢复演练结果。

Compose 已将容器 JSON 日志轮转限制为 3 个、每个 10 MB。数据卷不在该限制内，需要单独监控。故障时先保全日志和数据副本，再执行修复；涉及漏洞或凭据泄露时，按根目录 [SECURITY.md](../SECURITY.md) 进行私密报告和协调披露。
