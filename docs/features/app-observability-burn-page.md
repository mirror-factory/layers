# app/observability/burn/page.tsx

## Purpose

Operator-only vendor burn-rate dashboard for spend-cap enforcement.

The page shows the spend-cap registry from `lib/ops/spend-caps.ts`. It combines live AI Gateway rows from the AI telemetry backend with projected/vendor-dashboard rows for dependencies that do not expose usage APIs yet, then sorts rows by 30-day run-rate as a percentage of the monthly cap.

## Verification

- Playwright smoke: tests/e2e/app-observability-burn-page.smoke.spec.ts
- Expect flow: tests/expect/app-observability-burn-page.md
- Unit coverage: tests/spend-caps.test.ts
