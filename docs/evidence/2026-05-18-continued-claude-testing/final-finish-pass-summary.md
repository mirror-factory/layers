# Layers Release-Readiness Finish Pass Summary

Date: 2026-05-18
Branch: `release/external-tester-readiness-2026-05-17`

## Verdict

Safe for external tester debug QA, not safe for store/TestFlight/public release yet.

## Claude Lanes Used

| Lane | Scope | Result |
|---|---|---|
| Web/Brand/Electron | Sans-only font proof, public/auth screenshots, Electron launch smoke | PASS |
| iOS Capacitor | iPhone 16 Pro simulator, Google button native browser proof | PASS |
| Android Capacitor | LayersPixel emulator, Google button native browser proof | PASS with emulator Chrome first-run caveat |
| Final read-only Claude audit | Evidence/report consistency check | ATTEMPTED; CLI produced no output and was stopped to avoid blocking |

## Fixes Made

| File | Change | Why |
|---|---|---|
| `app/globals.css` | Hardened global sans-only font stack and form/text inheritance | Removes serif drift across home/auth/public pages |
| `next.config.ts` | Maps existing `VITE_SUPABASE_*` env vars to `NEXT_PUBLIC_SUPABASE_*` | Lets Next.js browser bundle configure Supabase locally |
| `lib/auth/native-oauth.ts` | Wraps Capacitor `App` and `Browser` plugin methods in plain objects | Prevents Android `"App.then()" is not implemented` runtime failure |
| `tests/auth-domain-config.test.ts` | Adds regression coverage for runtime auth/native-shell domains | Prevents stale `layers.hustletogether.com` redirects from returning |
| public/dev-kit/MCP/telemetry/Remotion files | Removed low-risk unused code/import warnings | Reduced lint warnings from 96 to 44 without changing product behavior |
| Storybook stories | Converted anonymous default exports to named `meta` exports | Removes story lint noise and improves generated docs/debuggability |
| `docs/reports/release-readiness-cpo-report.html` | Updated CPO report with final pass/fail state | Keeps the standard update artifact current |

## Slim Gates

| Command | Result |
|---|---|
| `pnpm typecheck` | PASS |
| `pnpm lint` | PASS, 44 warnings, 0 errors |
| `pnpm compliance` | PASS, 12 checks, 0 warnings, 0 errors |
| `pnpm check:deprecations` | PASS, no deprecated patterns found |
| `pnpm secrets:check` | PASS, 5 vendors detected; timestamp-only generated doc change was restored |
| `pnpm test:native:config` | PASS, native IDs/deep links/release gates checked |
| `pnpm test:native:smoke` | PASS harness result, skipped live Maestro because `MAESTRO_RUN=1` was not set |
| `pnpm exec vitest run tests/auth-domain-config.test.ts tests/native-oauth.test.ts tests/onboarding-emails.test.ts --passWithNoTests` | PASS, 16 tests |
| `PLAYWRIGHT_DISABLE_VIDEO=1 pnpm exec playwright test tests/e2e/smoke.spec.ts --project=desktop-light` | PASS, 17 tests |

## Native OAuth Proof

| Platform | Result | Evidence |
|---|---|---|
| iOS simulator | PASS | `ios-native-oauth-after-google-maestro.png` shows `accounts.google.com` in `SafariViewService`; `launchctl list` showed `com.apple.SafariViewService` and not standalone MobileSafari |
| Android emulator | PASS with caveat | `dumpsys` shows `com.mirafactory.layers/com.capacitorjs.plugins.browser.BrowserControllerActivity`; screenshot shows Chrome first-run UI because the AVD Chrome profile was uninitialized |

## Remaining Blockers

- Full Google credential completion and deep-link return on real iOS/Android devices.
- Real microphone recording/finalize proof on Web, iOS, Android, and Electron.
- iOS TestFlight signing/provisioning/archive/upload.
- Android release signing/upload-key proof.
- Electron notarization for public macOS distribution.
- Repo cleanup, commit, PR review, and promotion through the branch flow.
