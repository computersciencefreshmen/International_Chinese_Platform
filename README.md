# International Chinese Platform

An international Chinese education platform prototype built with Vue 3. It models the main workflows for students, teachers, and administrators in a personalized online learning environment.

## Overview

The project is designed around three user roles:

- **Students** can browse courses, book teachers, publish learning requests, join chats, view homework, attend live classes, and manage their personal center.
- **Teachers** can manage teaching docking, online courses, course uploads, user information, and course details.
- **Administrators** can review courses, manage platform data, audit content, and handle account-center tasks.

The goal is to show a role-based education platform rather than a static website demo.

## Features

- Role-based routing for student, teacher, and administrator dashboards.
- Vue Router page structure with nested layouts.
- Pinia state management with persisted state support.
- Element Plus UI components and icon set.
- Axios-ready frontend architecture for API integration.
- Vue i18n dependency included for multilingual expansion.
- Vite development and production build pipeline.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Vue 3 |
| Build Tool | Vite |
| State | Pinia, pinia-plugin-persistedstate |
| Routing | Vue Router |
| UI | Element Plus, Tailwind CSS |
| HTTP | Axios |
| Tooling | ESLint, Prettier |

## Project Structure

```text
International_Chinese_Platform/
├── public/              # Static assets
├── src/
│   ├── router/          # Role-based route definitions
│   ├── views/           # Student, teacher, admin, login pages
│   └── ...              # Shared app source
├── index.html
├── vite.config.js
└── package.json
```

## Local Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## Portfolio Value

This repository demonstrates Vue 3 application structure, multi-role routing, dashboard-style UI planning, and education-platform product modeling. It is a good base for further backend integration, authentication, course management APIs, and live-class features.
