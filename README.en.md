# International Chinese Platform

International Chinese Platform is a Vue 3 frontend prototype for personalized Chinese-language education. It models course, booking, homework, chat, live-class, and platform-management workflows for students, teachers, and administrators.

> This is the canonical repository for ongoing development:
> [computersciencefreshmen/International_Chinese_Platform](https://github.com/computersciencefreshmen/International_Chinese_Platform)

[中文说明](README.md)

## Repository consolidation

Early versions of the project were spread across:

- [vue3-project-initialization](https://github.com/computersciencefreshmen/vue3-project-initialization)
- [project](https://github.com/computersciencefreshmen/project)

Development is now consolidated in International_Chinese_Platform. New code, issues, documentation, and releases should use this repository; the older repositories should be treated as historical references to avoid further divergence.

## Current features

- Student workspace for courses, teacher booking, learning requests, chats, homework, live classes, a digital-human classroom, and personal settings.
- Teacher workspace for teaching coordination, online courses, course uploads, user information, and course details.
- Administrator workspace for course coordination, audits, analytics, and account-center workflows.
- Shared infrastructure using nested Vue Router routes, persisted Pinia state, Element Plus, Tailwind CSS, Axios, and Vue i18n.

This repository is currently a frontend prototype and does not include backend services. Authentication, real-time communication, media signaling, and some business workflows depend on external APIs and require security review and end-to-end integration before production use.

## Technology

| Layer               | Technology                         |
| ------------------- | ---------------------------------- |
| Framework           | Vue 3                              |
| Build               | Vite 6                             |
| Routing             | Vue Router                         |
| State               | Pinia, pinia-plugin-persistedstate |
| UI and styling      | Element Plus, Tailwind CSS, Sass   |
| Networking and i18n | Axios, Vue i18n                    |
| Quality             | ESLint, Prettier, GitHub Actions   |

## Requirements

- Node.js 18 or newer
- pnpm 8.15.9

The pnpm version is pinned in package.json. Use Corepack so a different local pnpm version does not rewrite the lockfile.

## Local development

```bash
git clone https://github.com/computersciencefreshmen/International_Chinese_Platform.git
cd International_Chinese_Platform

corepack enable
corepack prepare pnpm@8.15.9 --activate
pnpm install --frozen-lockfile

cp .env.example .env.local
pnpm dev
```

On Windows PowerShell, copy the environment file with:

```powershell
Copy-Item .env.example .env.local
```

## Environment variables

| Variable           | Purpose                                    | Example                             |
| ------------------ | ------------------------------------------ | ----------------------------------- |
| VITE_API_BASE_URL  | REST API base URL                          | http://localhost:7777               |
| VITE_FORUM_API_URL | Full forum/keyword-processing endpoint     | http://localhost:5002/process_words |
| VITE_WEBSOCKET_URL | Chat and live-signaling WebSocket endpoint | ws://localhost:7788/websocket       |

Copy .env.example to .env.local and replace the values for your backend. Variables prefixed with VITE\_ are exposed to the browser; never store passwords, private keys, or long-lived access tokens in them.

The application reads these variables as its shared endpoint contract, avoiding committed environment-specific URLs.

## Commands

| Command           | Description                                       |
| ----------------- | ------------------------------------------------- |
| pnpm dev          | Start the development server                      |
| pnpm build        | Create a production build                         |
| pnpm preview      | Preview the production build locally              |
| pnpm lint         | Apply auto-fixable ESLint changes                 |
| pnpm lint:check   | Run ESLint without modifying files                |
| pnpm format       | Format the src directory                          |
| pnpm format:check | Check src formatting without modifying files      |
| pnpm check        | Run lint, formatting, and production-build checks |

Before committing, run:

```bash
pnpm check
```

GitHub Actions runs the same quality gate for pushes to main and pull requests. Automated unit and end-to-end tests are not configured yet, so the critical role-based paths still require browser smoke testing.

## Project structure

```text
International_Chinese_Platform/
├── .github/workflows/   # Continuous integration
├── public/              # Public static assets
├── src/
│   ├── api/             # API wrappers
│   ├── assets/          # Styles and media
│   ├── components/      # Shared and domain components
│   ├── i18n/            # Locale setup and messages
│   ├── router/          # Role-based routes
│   ├── stores/          # Pinia stores
│   ├── utils/           # HTTP and WebSocket utilities
│   └── views/           # Student, teacher, admin, and login pages
├── .env.example
├── package.json
└── vite.config.js
```

## Deployment

Use HTTPS/WSS service endpoints in production and inject environment variables through the deployment platform. Because the application uses Vue Router history mode, configure the static host to fall back unknown routes to index.html.
