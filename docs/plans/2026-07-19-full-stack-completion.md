# Full-stack Completion Implementation Plan

> **For Codex:** Execute this plan in vertical slices. Each slice must finish with focused tests and an intentional commit; do not claim a capability before its acceptance test passes.

**Goal:** Convert the current Vue prototype into a self-contained, portfolio-grade platform with persistent three-role workflows and reproducible evidence.

**Architecture:** Keep the Vue application at the repository root. Add a Fastify ESM server under `server/`, backed by SQLite. Use HttpOnly opaque sessions, versioned REST endpoints, a unified classroom WebSocket, deterministic local providers, and production same-origin serving.

**Tech Stack:** Vue 3, Vite, Pinia, Fastify 5, better-sqlite3, Zod/JSON Schema, Node crypto, `node:test`, Playwright.

---

## Task 1: Establish the server foundation and executable contract

**Files:**

- Modify: `package.json`, `pnpm-lock.yaml`, `vite.config.js`, `.env.example`, `.gitignore`
- Create: `server/config.js`, `server/app.js`, `server/index.js`, `server/lib/http.js`
- Create: `server/test/health.test.js`

**Work:** Add API/dev/build/test scripts, Vite proxy rules, health/readiness endpoints, structured errors, security headers, and production static serving. Write a failing health test first, then implement until it passes.

**Verify:** `pnpm test:api --test-name-pattern health`, `pnpm build`.

**Commit:** `feat(server): add self-contained API foundation`

## Task 2: Add SQLite migrations, deterministic seed, and reset tooling

**Files:**

- Create: `server/db/schema.sql`, `server/db/database.js`, `server/db/migrate.js`, `server/db/seed.js`, `server/db/reset.js`
- Create: `server/test/database.test.js`
- Modify: `.gitignore`, `package.json`

**Work:** Create users, sessions, codes, courses/reviews, appointments/classrooms, assignments/submissions, messages, notifications and audit tables with constraints/indexes. Seed three accounts and repeatable course/teacher/student data. Test migrations, foreign keys, idempotent seed and reset.

**Verify:** `pnpm db:reset`, `pnpm test:api --test-name-pattern database`.

**Commit:** `feat(database): add schema migrations and demo seed`

## Task 3: Implement secure auth, profile, and authorization

**Files:**

- Create: `server/lib/password.js`, `server/lib/session.js`, `server/plugins/auth.js`
- Create: `server/routes/auth.js`, `server/routes/profile.js`
- Create: `server/test/auth.test.js`
- Modify: `src/utils/request.js`, `src/stores/modules/user.js`, `src/router/index.js`, `src/views/login/loginPage.vue`, `src/views/login/components/registerComponent.vue`

**Work:** Implement scrypt password hashes, opaque cookie sessions, role/ownership guards, login rate limits, student/teacher registration, session restore/logout/profile/password endpoints. Update Axios and route guards to use cookie session without localStorage token.

**Verify:** auth integration tests cover invalid input, wrong role, expiry, logout, 401 and 403; manually refresh an authenticated page.

**Commit:** `feat(auth): add secure multi-role sessions`

## Task 4: Complete course creation, review, and student discovery

**Files:**

- Create: `server/routes/courses.js`, `server/routes/admin.js`, `server/test/course-workflow.test.js`
- Create: `src/api/platform.js`
- Modify: teacher upload/list/detail views, administrator audit/data views, student online course views

**Work:** Implement course CRUD and explicit status transitions. Replace static cards with loading/empty/error/pagination states. Wire teacher submit, administrator reject/approve with reason, and student published-only discovery.

**Verify:** integration test exercises draft → rejected → revised → pending → published; Playwright confirms three-role visibility.

**Commit:** `feat(courses): complete cross-role publishing workflow`

## Task 5: Complete booking and classroom scheduling

**Files:**

- Create: `server/routes/teachers.js`, `server/routes/appointments.js`, `server/test/appointment-workflow.test.js`
- Modify: student teacher/search/detail/publish/home views; teacher docking/home views; administrator docking view

**Work:** Replace local-only appointments with transactional APIs, prevent overlapping accepted slots, create a classroom on acceptance, and surface the same status to both roles.

**Verify:** tests cover accept/reject/cancel, ownership, slot conflict and classroom creation; E2E checks student request → teacher accept.

**Commit:** `feat(booking): connect student and teacher schedules`

## Task 6: Complete assignments and grading

**Files:**

- Create: `server/routes/assignments.js`, `server/test/assignment-workflow.test.js`
- Modify: student homework view; teacher course detail/docking views

**Work:** Drive questions from the selected course, persist drafts/submissions, prevent invalid duplicate submissions, add teacher grading and student result display.

**Verify:** API test covers submit → grade → result plus cross-user access denial; E2E covers the role handoff.

**Commit:** `feat(homework): add submission and grading loop`

## Task 7: Make the classroom realtime path usable

**Files:**

- Create: `server/realtime/classroom.js`, `server/routes/classrooms.js`, `server/test/classroom.test.js`
- Modify: `src/config/runtime.js`, WebSocket/WebRTC composables, live classroom components

**Work:** Issue short-lived join tickets, implement presence/chat/hand raise/history and RTC signal relay, connect UI initialization, fix stream binding and permission/error states. Text classroom must work without camera or TURN.

**Verify:** integration test uses two WebSocket clients; Playwright checks two contexts exchange messages and restore history.

**Commit:** `feat(classroom): add authenticated realtime rooms`

## Task 8: Finish profiles, notifications, uploads, and local dialogue

**Files:**

- Create: `server/routes/files.js`, `server/routes/notifications.js`, `server/routes/dialogue.js`, provider modules and tests
- Modify: personal-center, messages, digital-human and dialogue views

**Work:** Persist profile/password updates, validate local uploads, derive notifications from workflows, and replace alert-only dialogue with a deterministic provider plus Web Speech API TTS when available.

**Verify:** upload magic-byte/size tests, notification ownership tests, deterministic dialogue snapshots, UI fallback checks.

**Commit:** `feat(platform): complete supporting user workflows`

## Task 9: Add end-to-end evidence, documentation, and CI

**Files:**

- Create: `playwright.config.js`, `e2e/*.spec.js`, `docs/api.md`, `docs/demo-script.md`, `SECURITY.md`
- Modify: `.github/workflows/ci.yml`, `README.md`, `package.json`

**Work:** Add API tests to `pnpm check`, Playwright browser setup and three-role workflow specs, demo accounts, reset/start instructions, truthful capability matrix, architecture diagram and production limitations.

**Verify:** clean install; reset; full `pnpm check`; Playwright; production build/start; dependency audit; final security review.

**Commit:** `test(docs): prove and document full-stack completeness`

## Task 10: Publish and merge

**Work:** Review diff and secrets, push `agent/full-stack-completion`, open PR, wait for CI, address failures, merge to `main`, delete the branch, and fast-forward the local checkout to merged `main`.

**Verify:** `git status --short --branch` is clean on `main`; remote default branch contains the merge; README badges/checks point at the canonical repository.
