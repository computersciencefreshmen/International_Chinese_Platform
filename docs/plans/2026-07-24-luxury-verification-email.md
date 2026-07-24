# Luxury Verification Email Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship a premium, responsive registration-code email that preserves the
existing secure relay and broad email-client compatibility.

**Architecture:** Keep rendering in `createVerificationMessage` and leave the
Railway-to-Vercel HMAC contract unchanged. Build a self-contained, table-based
HTML document with inline styles, a plain-text fallback, HTML escaping, and no
remote assets.

**Tech Stack:** Node.js, Nodemailer, semantic HTML email, inline CSS, Node test
runner, Prettier, Vercel Functions.

---

### Task 1: Lock the message contract with tests

**Files:**

- Modify: `server/test/mail-provider.test.js`
- Modify: `server/test/mail-relay.test.js`

**Step 1:** Import `createVerificationMessage` and add assertions for the
bilingual masthead, code, Shanghai expiry, presentation-table structure,
preheader, security copy, and text alternative.

**Step 2:** Add a defensive escaping case that passes HTML metacharacters
directly to the renderer and verifies that executable markup never appears.

**Step 3:** Run:

```bash
pnpm exec node --test server/test/mail-provider.test.js server/test/mail-relay.test.js
```

Expected: the new visual-contract assertions fail before implementation while
the existing transport and HMAC tests continue to pass.

### Task 2: Implement the premium renderer

**Files:**

- Modify: `server/services/mail-provider.js`

**Step 1:** Add a small `escapeHtml` helper for renderer-owned dynamic content.

**Step 2:** Improve the plain-text message with a clear title, code, expiry,
security guidance, and support context.

**Step 3:** Replace the minimal HTML fragment with a complete email document:
hidden preheader, ink masthead, ivory body, cinnabar code panel, exact expiry,
security note, and restrained footer.

**Step 4:** Keep every critical style inline, use `role="presentation"` layout
tables, and avoid external images, fonts, scripts, forms, and CSS URLs.

**Step 5:** Re-run the two focused test files. Expected: all tests pass.

### Task 3: Validate the visual output

**Files:**

- Temporary artifact only: `C:\tmp\international-chinese-verification-email.html`
- Temporary artifact only: `C:\tmp\international-chinese-verification-email.png`

**Step 1:** Render a deterministic example using
`createVerificationMessage`.

**Step 2:** Capture the HTML at a mobile-friendly viewport and inspect the
screenshot for hierarchy, clipping, contrast, spacing, and code legibility.

**Step 3:** Fix any visible issue before continuing and delete temporary
preview artifacts after review.

### Task 4: Run repository verification

**Files:** No new files.

**Step 1:** Run `pnpm lint:check`.

**Step 2:** Run `pnpm format:check`.

**Step 3:** Run `pnpm test:api`.

**Step 4:** Run `pnpm build`.

Expected: every command exits successfully.

### Task 5: Release and production smoke test

**Files:** Commit the renderer, tests, and design documents.

**Step 1:** Commit and push `codex/luxury-verification-email`.

**Step 2:** Merge only after GitHub CI and Vercel preview checks pass.

**Step 3:** Confirm Railway and Vercel production deployments are healthy.

**Step 4:** Request a production verification code through the public API and
confirm HTTP 200, an expiry timestamp, and no `developmentCode`.
