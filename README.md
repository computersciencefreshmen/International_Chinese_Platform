# 国际中文平台

国际中文平台是一个基于 Vue 3 的国际中文教育前端原型，围绕学生、教师和管理员三类角色组织课程、预约、作业、聊天、直播课堂与平台管理流程。

> 当前仓库是项目的唯一主维护仓库：
> [computersciencefreshmen/International_Chinese_Platform](https://github.com/computersciencefreshmen/International_Chinese_Platform)

[English](README.en.md)

## 仓库整合

项目早期代码曾分散在以下仓库：

- [vue3-project-initialization](https://github.com/computersciencefreshmen/vue3-project-initialization)
- [project](https://github.com/computersciencefreshmen/project)

现已统一到 International_Chinese_Platform。后续代码、Issue、文档和发布均应以本仓库为准；旧仓库仅作为历史参考，避免继续产生分叉。

## 当前功能

- 学生端：课程浏览、教师预约、学习需求发布、话轮聊天、作业、直播课堂、数字人课堂和个人中心。
- 教师端：授课对接、网络课程、课程上传、用户信息和课程详情。
- 管理员端：课程对接、审核中心、数据中心和账户中心。
- 公共能力：Vue Router 嵌套路由、Pinia 持久化状态、Element Plus 组件、Tailwind CSS、Axios 接口层和 Vue i18n 基础设施。

本仓库目前是前端原型，不包含后端服务。登录鉴权、实时通信、媒体信令和部分业务流程仍依赖外部接口，部署前应完成安全审查和端到端联调。

## 技术栈

| 层级         | 技术                               |
| ------------ | ---------------------------------- |
| 前端框架     | Vue 3                              |
| 构建工具     | Vite 6                             |
| 路由         | Vue Router                         |
| 状态管理     | Pinia、pinia-plugin-persistedstate |
| UI 与样式    | Element Plus、Tailwind CSS、Sass   |
| 网络与国际化 | Axios、Vue i18n                    |
| 工程质量     | ESLint、Prettier、GitHub Actions   |

## 环境要求

- Node.js 18 或更高版本
- pnpm 8.15.9

package.json 已固定 pnpm 版本。建议通过 Corepack 使用项目声明的版本，避免 pnpm 版本差异改写锁文件。

## 本地开发

```bash
git clone https://github.com/computersciencefreshmen/International_Chinese_Platform.git
cd International_Chinese_Platform

corepack enable
corepack prepare pnpm@8.15.9 --activate
pnpm install --frozen-lockfile

cp .env.example .env.local
pnpm dev
```

Windows PowerShell 可使用以下命令复制环境文件：

```powershell
Copy-Item .env.example .env.local
```

## 环境变量

| 变量               | 用途                          | 示例                                |
| ------------------ | ----------------------------- | ----------------------------------- |
| VITE_API_BASE_URL  | REST API 基础地址             | http://localhost:7777               |
| VITE_FORUM_API_URL | 话轮/关键词处理接口完整地址   | http://localhost:5002/process_words |
| VITE_WEBSOCKET_URL | 聊天和直播信令 WebSocket 地址 | ws://localhost:7788/websocket       |

复制 .env.example 为 .env.local 后，根据实际后端修改地址。所有以 VITE\_ 开头的变量都会暴露给浏览器，禁止写入密码、私钥或长期有效的访问令牌。

业务代码统一读取这些变量作为服务地址契约，避免提交环境相关的硬编码地址。

## 常用命令

| 命令              | 说明                              |
| ----------------- | --------------------------------- |
| pnpm dev          | 启动开发服务器                    |
| pnpm build        | 构建生产版本                      |
| pnpm preview      | 本地预览生产构建                  |
| pnpm lint         | 自动修复可修复的 ESLint 问题      |
| pnpm lint:check   | 只读检查 ESLint                   |
| pnpm format       | 格式化 src 目录                   |
| pnpm format:check | 只读检查 src 目录格式             |
| pnpm check        | 依次执行 lint、格式检查和生产构建 |

提交前建议执行：

```bash
pnpm check
```

GitHub Actions 会在推送到 main 以及 Pull Request 时执行同样的质量门禁。当前项目尚未配置自动化单元测试或端到端测试，关键角色路径仍需进行浏览器冒烟测试。

## 项目结构

```text
International_Chinese_Platform/
├── .github/workflows/   # 持续集成
├── public/              # 公共静态资源
├── src/
│   ├── api/             # API 封装
│   ├── assets/          # 样式与媒体资源
│   ├── components/      # 通用与业务组件
│   ├── i18n/            # 国际化配置和词条
│   ├── router/          # 多角色路由
│   ├── stores/          # Pinia 状态
│   ├── utils/           # HTTP、WebSocket 等工具
│   └── views/           # 学生、教师、管理员和登录页面
├── .env.example
├── package.json
└── vite.config.js
```

## 部署说明

生产环境应使用 HTTPS/WSS 服务地址，并由部署平台注入环境变量。由于项目采用 Vue Router history 模式，静态服务器还需将未知路由回退到 index.html。
