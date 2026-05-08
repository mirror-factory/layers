# app/observability/page.tsx

## Purpose

Operator-only observability dashboard for AI calls, errors, sessions, charts, and HTTP logging placeholders.

Vendor burn-rate moved to `app/observability/burn/page.tsx` so the spend-cap table can render as a dedicated operator page without expanding the existing tab dashboard.

## Verification

- Playwright smoke: tests/e2e/app-observability-page.smoke.spec.ts
- Expect flow: tests/expect/app-observability-page.md
