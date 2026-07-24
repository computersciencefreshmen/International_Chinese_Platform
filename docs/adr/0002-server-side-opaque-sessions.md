# ADR-0002：使用服务端 opaque session

**状态：** Partially superseded by ADR-0003 · **日期：** 2026-07-19

> **历史说明：** 不透明服务端 Session 的安全模型仍然有效；当前实现把 Session 摘要保存在 PostgreSQL，而不是本文记录的 SQLite。数据存储事实以 ADR-0003 为准。

## Context

旧原型把长期 token 存入 localStorage，并在部分请求和 WebSocket URL 中传递，容易被 XSS 或访问日志暴露，也没有可靠的服务端撤销机制。

## Decision

登录后签发安全随机 session token，通过 HttpOnly Cookie 携带；SQLite 只保存 token 的 SHA-256 摘要和过期时间。退出登录、修改密码和管理员禁用账号时可立即撤销。WebSocket 使用短期、单用途 ticket。

迁移阶段 REST 可接受 `Authorization: Bearer` 作为非浏览器客户端兼容方式，但前端不持久化 token，URL 中禁止出现长期凭据。

## Consequences

- 正面：降低浏览器令牌泄漏风险；会话可撤销；REST 与 WebSocket 权限统一。
- 负面：写请求必须处理 CSRF/Origin；前端启动时需要恢复会话。
- 约束：生产环境必须 HTTPS，Cookie 启用 `Secure`；所有角色权限由服务端执行。
