# app/observability/page.tsx

## Purpose

Internal operator dashboard for AI logs, errors, sessions, cost charts, HTTP-log placeholders, and daily vendor burn-rate monitoring. The default Burn tab lists every spend-capped external dependency sorted by highest percent of cap so release checks can find runaway vendor usage quickly.

## Verification

- Playwright smoke: tests/e2e/app-observability-page.smoke.spec.ts
- Expect flow: tests/expect/app-observability-page.md
