# Layers Full Platform QA Command Summary

Date: 2026-05-18
Branch: `release/external-tester-readiness-2026-05-17`
Head SHA: `f438a439b7d80c29e0dbe261f0440a8ee6889ce3`
PR: https://github.com/mirror-factory/layers/pull/88

## Repo And CI State

| Check | Result | Notes |
| --- | --- | --- |
| `git status --short --branch` | PASS | Only intentional source, test snapshot, report, and evidence changes remain. |
| `gh pr view 88` | BLOCKED | Merge blocked by required review. |
| `gh pr checks 88 --watch=false` | PASS/PARTIAL | Vercel, Tier 0-1 Fast Gates, Tier 2 Focused Browser Proof passed. Broad browser, Android native, and self-hosted web jobs were skipped by workflow selection. |

## Low-Risk Gates

| Command | Result | Evidence |
| --- | --- | --- |
| `pnpm typecheck` | PASS | Re-run after source/test changes. |
| `pnpm lint` | PASS | 70 warnings, 0 errors. Generated `ios/App/build` noise was removed before final lint. |
| `pnpm compliance` | PASS | 12/12 checks. |
| `pnpm check:deprecations` | PASS | No release-blocking deprecation failure. |
| `pnpm test` | PASS | 116 files passed, 177 skipped; 671 tests passed, 5 skipped. |
| `pnpm test:mcp` | PASS | 22 tests. |
| `pnpm test:tools` | PASS | 8 tests. |
| `pnpm test:contracts` | PASS | 4 tests. |
| `pnpm test:eval` | PASS | 34 tests, 5 skipped. |
| `pnpm test:api` | PASS | Production build/start plus 83 route checks, 12 skipped. |

## Browser And Visual Gates

| Command | Result | Evidence |
| --- | --- | --- |
| `PLAYWRIGHT_DISABLE_VIDEO=1 pnpm exec playwright test tests/e2e/smoke.spec.ts --project=desktop-light --project=desktop-dark --project=mobile-light --project=mobile-dark` | PASS | 68/68. |
| `pnpm test:expect:coverage` | PASS | 22/22 registered routes have Expect specs. |
| `EXPECT_RUN=1 pnpm test:expect` | PARTIAL | Deterministic fallback passed and wrote `.evidence/expect-proof.json`; AI TUI subprocess timed out after 180s. |
| `PLAYWRIGHT_DISABLE_VIDEO=1 pnpm exec playwright test tests/e2e/feature-checklist.spec.ts --project=desktop-light` | PASS | 7/7 after updating stale homepage and invite-only sign-up expectations. |
| `PLAYWRIGHT_DISABLE_VIDEO=1 pnpm exec playwright test tests/e2e/mobile-polish.spec.ts --project=mobile-light` | PASS | 10/10 after updating stale invite-only sign-up expectations. |
| `PLAYWRIGHT_DISABLE_VIDEO=1 pnpm exec playwright test tests/e2e/visual-regression.spec.ts --project=desktop-light --project=desktop-dark --update-snapshots` | PASS | Intentional homepage snapshots updated. |
| `PLAYWRIGHT_DISABLE_VIDEO=1 pnpm exec playwright test tests/e2e/visual-regression.spec.ts --project=desktop-light --project=desktop-dark --project=mobile-light --project=mobile-dark` | PASS | 6 passed, 6 skipped by project/test rules. |
| `PLAYWRIGHT_DISABLE_VIDEO=1 pnpm exec playwright test tests/e2e/onboarding-safe-area.spec.ts --project=mobile-light` | PASS | New targeted regression for first-run welcome modal, all tour popovers, and mobile microphone/setup error states staying inside the viewport. Initially caught the welcome modal clipping below the viewport; fixed and reran green. |
| `PLAYWRIGHT_DISABLE_VIDEO=1 pnpm exec playwright test tests/e2e/onboarding-safe-area.spec.ts tests/e2e/mobile-polish.spec.ts --project=mobile-light` | PASS | 12/12 after the Android/iOS mobile consistency fixes. |
| `PLAYWRIGHT_DISABLE_VIDEO=1 pnpm exec playwright test tests/e2e/onboarding-safe-area.spec.ts tests/e2e/mobile-polish.spec.ts --project=mobile-light` | PASS | Final rerun after cleanup: 12/12. |
| `PLAYWRIGHT_DISABLE_VIDEO=1 pnpm exec playwright test tests/e2e/feature-checklist.spec.ts --project=desktop-light` | PASS | Final rerun after cleanup: 7/7. |
| `pnpm exec vitest run tests/native-oauth.test.ts tests/onboarding-emails.test.ts --passWithNoTests` | PASS | Final focused native OAuth/onboarding email rerun: 14/14. |

## Native Config And Platform Builds

| Command | Result | Evidence |
| --- | --- | --- |
| `pnpm test:native:config` | PASS | Native policy, app IDs, deeplinks, and release artifacts validated. |
| `plutil -lint ios/App/App/Info.plist ios/App/App/PrivacyInfo.xcprivacy` | PASS | iOS plist and privacy manifest parse cleanly. |
| `xcodebuild -project ios/App/App.xcodeproj -list` | PASS | Scheme `App` exists. |
| `xmllint --noout android/app/src/main/AndroidManifest.xml` | PASS | Android manifest parses cleanly. |
| `CAPACITOR_SERVER_URL=http://10.0.2.2:3101 pnpm exec cap sync android` | PASS | `logs/android-cap-sync-local.log`. |
| `cd android && ./gradlew :app:assembleDebug` | PASS | `logs/android-gradle-local-assembleDebug.log`. |
| `adb install -r android/app/build/outputs/apk/debug/app-debug.apk` | PASS | `logs/android-install-local.log`. |
| `maestro --device CD658077-5378-49B2-8A17-7068111DD447 test tests/maestro/ios-i2-google-oauth.yml` | PASS | iOS Google OAuth surface screenshot captured. |
| `CAPACITOR_SERVER_URL=http://127.0.0.1:3101 pnpm exec cap sync ios` | PASS | Latest iOS sync after shared UI fixes: `logs/ios-cap-sync-latest.log`. |
| `xcodebuild -project ios/App/App.xcodeproj -scheme App -destination id=CD658077-5378-49B2-8A17-7068111DD447 -derivedDataPath ios/App/build/latest-sim build` | PASS | Latest iOS simulator build after shared UI fixes: `logs/ios-xcodebuild-latest.log`. |
| `CAPACITOR_SERVER_URL=http://10.0.2.2:3101 pnpm exec cap sync android` | PASS | Latest Android sync after shared UI fixes: `logs/android-cap-sync-latest.log`. |
| `cd android && ./gradlew :app:assembleDebug` | PASS | Latest Android debug build after shared UI fixes: `logs/android-gradle-latest.log`. |
| `adb install -r android/app/build/outputs/apk/debug/app-debug.apk` | PASS | Latest Android debug install after shared UI fixes: `logs/android-install-latest.log`. |
| `pnpm test:native:config` | PASS | Final native config rerun after cleanup. |

## Electron Packaged Resmoke

| Command | Result | Evidence |
| --- | --- | --- |
| `pnpm exec node --input-type=module <Playwright Electron packaged-app resmoke>` | PASS | Launched `dist-electron/mac-arm64/Layers.app`, confirmed it loads `https://layers.mirrorfactory.ai/`, captured home/sign-in/privacy screenshots, and wrote computed-font evidence to `electron/logs/packaged-resmoke-2026-05-18.json`. |

Evidence:

- `electron/screenshots/30-packaged-resmoke-home.png`
- `electron/screenshots/31-resmoke-home.png`
- `electron/screenshots/31-resmoke-signin.png`
- `electron/screenshots/31-resmoke-privacy.png`
- `electron/logs/packaged-resmoke-2026-05-18.json`

## Android OAuth Cleanup Follow-Up

After Android briefly showed a black WebView on one local debug launch, native OAuth cleanup was hardened:

- `components/native-auth-bridge.tsx` now closes stale Capacitor Browser surfaces once on native startup before handling launch URLs.
- `lib/auth/native-oauth.ts` now listens for `browserFinished` during native Google OAuth and disposes the app-url listener/browser overlay on cancel.
- `tests/native-oauth.test.ts` now covers the browser cancel/cleanup path.

Evidence:

- `android/28-cleanup-narrowed-cold-launch.png` -- cold launch after patch, styled homepage.
- `android/31-narrowed-google-custom-tab-cdp-input.png` -- Google opens in Chrome Custom Tab.
- `android/32-narrowed-after-custom-tab-back.png` -- immediate app return after Custom Tab Back; local dev repainted briefly.
- `android/33-after-custom-tab-back-wait.png` -- styled sign-in page after the local dev repaint settled.

## iOS OAuth Cleanup Follow-Up

After the shared native OAuth cleanup hardening, iOS was rechecked:

- `xcrun simctl launch CD658077-5378-49B2-8A17-7068111DD447 com.mirafactory.layers` -- PASS.
- `JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home PATH=/opt/homebrew/opt/openjdk@21/bin:$PATH maestro --device CD658077-5378-49B2-8A17-7068111DD447 test tests/maestro/ios-i2-google-oauth.yml` -- PASS.

Evidence:

- `ios/17-after-native-oauth-cleanup-launch.png` -- iOS launch after patch.
- `ios/18-after-native-oauth-cleanup-google.png` -- Google opens in SFSafariViewController after patch.

## Claude Code Status

Attempted to restart Claude Code Opus with:

```bash
CLAUDE_CODE_NO_FLICKER=1 claude --model opus --fallback-model sonnet --dangerously-skip-permissions --permission-mode bypassPermissions --name layers-smoke-probe
```

Claude exited with `You've hit your org's monthly usage limit`, so the final fixes, reruns, cleanup, and report updates were completed directly by Codex instead of new Claude worker lanes.

## Source Fixes Made

| File | Change |
| --- | --- |
| `app/(public)/sign-up/sign-up-form.tsx` | Fixed stale invite-only footnote that still referenced creating an account or continuing with Google. |
| `components/onboarding/welcome-modal.tsx` | Fixed first-run modal safe-area/viewport clipping with fixed viewport sizing, safe-area padding, max-height, and small-screen stacked actions. |
| `components/onboarding/tour-popover.tsx` | Fixed tour popovers so they clamp to viewport and safe-area bounds vertically and horizontally. |
| `components/live-recorder.tsx` | Normalized failed microphone/provider setup states to show `Review setup`, short user-facing error copy, and no raw provider env variable leakage. |
| `app/recorder.tsx` | Renamed the empty-state CTA from `Start live recording` to `Start recording`. |
| `app/globals.css` | Fixed mobile recorder button contrast in light/dark mode, alert wrapping, and empty-state CTA styling so Android/iOS states align. |
| `tests/e2e/feature-checklist.spec.ts` | Updated stale homepage H1 and sign-up expectations to match current product and invite-only alpha state. |
| `tests/e2e/mobile-polish.spec.ts` | Updated sign-up mobile smoke to assert invite-only CTA instead of a removed Google sign-up button. |
| `tests/e2e/onboarding-safe-area.spec.ts` | Added regression coverage for onboarding popup cutoff/top-bar/notch issues and mobile recorder error containment. |
| `tests/e2e/visual-regression.spec.ts-snapshots/*.png` | Updated six intentional homepage visual snapshots for the redesigned page. |

## Key Evidence Paths

- Web screenshots: `docs/evidence/2026-05-18-full-platform-final/web/`
- Mobile recorder error screenshot: `docs/evidence/2026-05-18-full-platform-final/web/mobile-recorder-mic-error-fixed.png`
- iOS simulator screenshots: `docs/evidence/2026-05-18-full-platform-final/ios/`
- Android emulator screenshots and build logs: `docs/evidence/2026-05-18-full-platform-final/android/`, `docs/evidence/2026-05-18-full-platform-final/logs/`
- Electron screenshots and logs: `docs/evidence/2026-05-18-full-platform-final/electron/`
