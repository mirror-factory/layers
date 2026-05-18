# Release Verdict

Date: 2026-05-18
Branch: `release/external-tester-readiness-2026-05-17`
PR: https://github.com/mirror-factory/layers/pull/88

## Verdict

Safe for external tester debug QA only.

Do not market this as store/TestFlight/public production release-ready yet.

## Why

The web app, API route checks, MCP/tools/contracts/evals, focused browser smoke, mobile polish, feature checklist, visual regression, onboarding safe-area regression, and native configuration gates are green. iOS and Android simulator/emulator proof now confirms the Google button opens the correct native in-app auth surface. Electron/macOS launches, renders, reaches Google OAuth, exercises the recording UI/API path, and has a fresh packaged-app resmoke proving home/sign-in/privacy render from `layers.mirrorfactory.ai` with sans-only computed fonts.

The remaining gaps are distribution and device-trust gaps, not broad app-functional gaps:

- PR #88 is still blocked by required review.
- Full Google OAuth callback completion on iOS, Android, and Electron still needs manual Google credential/2FA completion.
- Real-device microphone, background behavior, and native OAuth return remain unproven because this pass used simulator/emulator only.
- Android local WebView microphone cannot be proven over non-secure `http://10.0.2.2:3101`.
- TestFlight/App Store signing, Play release signing, and Electron notarization were not exercised.
- Electron recording finalization logged a server-component digest after successful token/finalize responses and should be investigated if reproducible.
- Onboarding popup cutoff is now covered by a targeted mobile regression test, but physical-device notch proof is still recommended before store distribution.
- Android latest local debug launch briefly captured a black WebView until Android Back resumed the current homepage. A native OAuth cleanup hardening patch now closes stale browser surfaces on native startup and handles browser cancel/finish; cold launch and Custom Tab proof reran cleanly. Real-device OAuth return should still verify there is no repaint/jank outside local Next dev mode.
- Final slim rerun passed: `pnpm typecheck`, `pnpm lint --quiet`, `pnpm exec vitest run tests/native-oauth.test.ts tests/onboarding-emails.test.ts --passWithNoTests`, mobile onboarding/mobile polish Playwright 12/12, desktop feature checklist 7/7, and `pnpm test:native:config`.
- Fresh Electron packaged-app resmoke passed: `dist-electron/mac-arm64/Layers.app` loaded `https://layers.mirrorfactory.ai/`; home, sign-in, and privacy screenshots plus computed-font evidence were captured under `docs/evidence/2026-05-18-full-platform-final/electron/`.

## Next Recommended Action

1. Get PR #88 reviewed and approved.
2. Complete one manual Google login callback proof on iOS simulator, Android emulator, and Electron, or explicitly accept OAuth-surface-only proof for debug testers.
3. Run a real-device mic/background/OAuth-return check before TestFlight or Play distribution.
4. Recheck Android OAuth return on a real device or HTTPS production/preview build to confirm local dev repaint does not appear outside `next dev`.
5. Investigate the Electron post-finalize server-component digest if it reproduces.
6. After approval, promote through `release/external-tester-readiness-2026-05-17 -> development -> staging -> main` using the documented release flow.
