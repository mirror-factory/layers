# Web Final Report

Date: 2026-05-18
Platform: Web, Playwright Chromium
Verdict: PASS for external tester web QA

## What Was Checked

| Area | Status | Evidence |
| --- | --- | --- |
| Typecheck | PASS | `pnpm typecheck` |
| Lint | PASS | `pnpm lint`, 70 warnings and 0 errors |
| Compliance/deprecations | PASS | `pnpm compliance`, `pnpm check:deprecations` |
| Unit/API/MCP/tools/contracts/evals | PASS | `pnpm test`, `pnpm test:api`, `pnpm test:mcp`, `pnpm test:tools`, `pnpm test:contracts`, `pnpm test:eval` |
| Smoke desktop/mobile/light/dark | PASS | 68/68 Playwright smoke tests |
| Feature checklist | PASS | 7/7 after stale test updates |
| Mobile polish | PASS | 10/10 after stale sign-up expectation update |
| Visual regression | PASS | Desktop light/dark updated intentionally; all rerun projects passed or were skipped by test/project rules |
| Onboarding safe-area regression | PASS | New mobile test verifies first-run welcome modal, tour popovers, and mobile recorder setup-error states stay within viewport. It initially failed on modal clipping, was fixed, then passed. |
| Expect route registry | PASS/PARTIAL | 22/22 route specs covered; deterministic fallback passed, AI TUI subprocess timed out |
| Homepage/sign-in/record/meetings/settings screenshots | PASS | `web/*.png` |

## Fixes Made

- Fixed stale invite-only sign-up footnote.
- Updated stale Playwright feature and mobile tests for the current homepage and invite-only sign-up flow.
- Fixed onboarding welcome modal and tour popover safe-area/viewport clamping.
- Fixed Android/iOS recorder setup-state consistency: failed mic/provider setup now says `Review setup`, wraps cleanly, and does not leak raw provider env variable names.
- Renamed the recent-recordings empty CTA from `Start live recording` to `Start recording` and aligned its visual treatment with the primary recorder CTA.
- Added `tests/e2e/onboarding-safe-area.spec.ts` to prevent popup cutoff and mobile recorder-error regressions.
- Updated six homepage visual snapshots for the intentional homepage redesign.

## Screenshots

- `web/desktop-home-light.png`
- `web/desktop-home-dark.png`
- `web/mobile-home-light.png`
- `web/mobile-home-dark.png`
- `web/desktop-sign-in.png`
- `web/mobile-sign-in.png`
- `web/desktop-record.png`
- `web/desktop-meetings.png`
- `web/desktop-settings.png`

## Blockers

- Full production Google callback was not completed in this pass because manual Google credential and 2FA completion would be required.
- GitHub PR #88 still requires review before merge.
