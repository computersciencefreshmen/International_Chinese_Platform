# 国际中文教育平台全栈补全设计

**状态：** 已接受  
**日期：** 2026-07-19  
**目标：** 把现有 Vue 多角色原型补成仓库自包含、可重复演示、可自动验收的作品级全栈项目。

## 1. 完整性的边界

本项目的“完整”指：

- 不依赖已经失效或无法验证的旧后端；克隆仓库后可在本机初始化、启动和重置数据。
- 学生、教师、管理员三个角色共享同一持久化数据，并完成跨角色业务闭环。
- 核心接口、权限、状态变化、实时课堂文本能力和失败状态均有自动化测试。
- README 如实区分“仓库内已经实现”“可替换的外部增强”和“生产部署仍需配置”的能力。

首版不承诺真实支付、全球可用的多人音视频 SFU、视频转码/CDN、生产级邮件送达或真实 AI 数字人。这些能力通过适配器和清晰边界保留扩展点。

## 2. 方案比较与决定

### 方案 A：NestJS + PostgreSQL + Docker

模块边界最强，适合团队和生产扩展；但会同时引入框架迁移、容器数据库、ORM 和前端目录重排，显著提高当前单人作品的启动与维护成本。

### 方案 B：Supabase

认证、数据库、存储和实时能力上线快；但核心后端由平台提供，不利于说明“后端由自己完整实现”，离线演示也更依赖外部环境。

### 方案 C：Fastify 模块化单体 + SQLite（采用）

保留现有 Vue 工程，在同一仓库新增 Node API。SQLite 负责真实关系数据和事务，Fastify 提供 REST、静态资源与 WebSocket。该方案无需云账号或数据库服务，最适合当前作品级完整性目标；未来可在仓储层替换 PostgreSQL。

## 3. 系统结构

```text
Vue 3 SPA
  ├─ /api/v1/*  ──────────────┐
  └─ /ws/classroom?ticket=... ─┤
                               ▼
Fastify 模块化单体
  ├─ auth / profiles
  ├─ courses / reviews
  ├─ appointments / classrooms
  ├─ assignments / submissions
  ├─ notifications / metrics
  ├─ dialogue provider
  └─ local file provider
                               │
                               ▼
                         SQLite (WAL)
```

开发环境由 Vite 把 `/api` 和 `/ws` 代理到 Fastify；生产环境由 Fastify 同源托管 `dist/`，文件内容通过受权限控制的 `/api/v1/files/:id/content` 提供。外部 AI、SMTP、对象存储和 TURN 均不是核心流程的硬依赖。

## 4. 核心领域和状态机

- `users`、`sessions`、`verification_codes`：三角色身份、资料和会话。
- `courses`、`course_reviews`：教师创建 `draft -> pending -> published/rejected`，管理员记录审核意见。
- `appointments`、`classrooms`：学生预约 `pending -> accepted/rejected/cancelled/completed`；接受后生成课堂房间。
- `assignments`、`assignment_questions`、`submissions`：学生提交，教师批阅 `submitted -> graded`，成绩回显给学生。
- `chat_messages`、`notifications`、`audit_logs`：课堂消息、业务通知和关键管理操作证据。

所有主键使用 UUID；所有时间存 ISO-8601 UTC；关键外键、唯一约束和查询索引在迁移中创建。预约接受与课程审核使用事务，避免部分更新。

## 5. API 和兼容策略

新接口统一在 `/api/v1`：

- 身份：`/auth/login`、`/auth/register`、`/auth/session`、`/auth/logout`、`/me`。
- 学生：课程、教师、预约、作业提交和成绩。
- 教师：预约处理、课程 CRUD/提交审核、作业批阅。
- 管理员：待审课程、审核动作、指标和审计日志。
- 课堂：加入接口签发短期 WebSocket ticket；实时协议统一为 `chat.message`、`hand.raise`、`presence.*`、`rtc.*` 和 `ping/pong`。

返回格式统一为 `{ code, msg, data }`。前端一次性迁移到新契约；旧路径只在必要时提供薄兼容层，不复制旧后端的不一致认证方式。

## 6. 安全设计

- 密码使用 Node `crypto.scrypt` 加随机盐；不记录密码、验证码、Cookie 或 ticket。
- 会话 token 使用安全随机数，数据库只保存 SHA-256 摘要；浏览器通过 `HttpOnly`、`SameSite=Lax` Cookie 携带。
- 每个业务端点校验身份、角色与资源归属；管理员动作写入 `audit_logs`。
- 所有输入使用完整 JSON Schema/Zod 校验；SQL 仅使用参数化 prepared statements。
- 登录、验证码和注册限流；写请求校验 Origin；错误响应不泄漏堆栈。
- 上传限制类型、大小和魔数，服务端生成存储名，禁止用户输入参与磁盘路径。
- WebSocket ticket 短期、单用途，并再次校验课堂参与资格；SDP/ICE 只转发不持久化。

## 7. 失败与降级

- 数据库不可写：健康检查报告失败，API 返回稳定错误码，前端提供重试。
- 外部 AI 未配置：使用确定性的本地话轮生成器，核心演示不受影响。
- 邮件未配置：开发环境在界面返回一次性演示验证码；生产环境必须配置 SMTP。
- 摄像头、麦克风或 TURN 不可用：文本聊天、举手和课堂参与列表仍可用，界面明确显示音视频限制。
- WebSocket 断线：指数退避重连，历史消息通过 REST 补齐。

## 8. 可验收闭环

1. 三个演示账号登录成功，越权 API 返回 403，刷新后会话恢复。
2. 教师创建课程并提交审核；管理员驳回；教师修改后再次提交；管理员通过；学生列表立即可见。
3. 学生预约教师；教师接受；双方看到同一课堂和状态。
4. 学生提交作业；教师评分；学生看到分数和反馈。
5. 两个浏览器加入同一课堂，聊天、在线列表和举手状态双向同步；断线后恢复历史。
6. 数据中心数字来自数据库；重置 seed 后结果可重复。
7. `pnpm check` 覆盖 lint、format、构建和 API 测试；Playwright 覆盖至少三条跨角色 E2E。
