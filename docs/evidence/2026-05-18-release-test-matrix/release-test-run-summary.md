# Release Test Matrix Run Summary

Date: 2026-05-18
Branch: `release/external-tester-readiness-2026-05-17`
Version: `0.1.154`
Orchestrator: Codex
Workers: Claude Sonnet via Claude Code (`--model sonnet --chrome --dangerously-skip-permissions`)
Matrix: `docs/RELEASE_TEST_MATRIX.md`

## Executive Summary

This run used four bounded Claude Sonnet workers for Web, iOS, Android, and Electron/macOS. Each worker wrote a platform report and screenshots under this evidence folder.

The repo is not ready for broad external release yet. The automated/codebase checks are mostly healthy, and native builds are much further along than before, but the release-critical gaps are still the same areas that cannot be honestly proven with unit tests alone:

- Google OAuth callback/return, especially iOS and Android native return.
- Real microphone permission, live recording, and stop/finalize on actual platform shells.
- iOS TestFlight signing/archive upload readiness.
- Android emulator/device install-launch proof and signed Play-ready AAB.
- Electron notarization and physical Mac mic walk.
- Local API smoke/dev environment issues that should be cleaned before final release gating.

No TestFlight, Play Console, Vercel production, GitHub merge, or publish action was attempted.

## Overall Gate Count

The release matrix has 30 gates.

| Status | Count | Meaning |
| --- | ---: | --- |
| Green | 7 | Fully passed for all applicable platforms in this run, or explicitly N/A elsewhere. |
| Partial | 19 | Some evidence exists, but at least one platform/env/manual step remains. |
| Blocked / Not Proven | 4 | No acceptable end-to-end proof yet. |

Green gates: 1, 2, 3, 5, 18, 27, 30.

Blocked/not-proven gates: 8, 9, 11, 12.

Everything else is partial because at least one platform still needs native/device/live-env proof.

## Platform Summaries

| Platform | Result | Evidence |
| --- | --- | --- |
| Web | Mostly green; not release-complete | `web-worker-report.md` |
| iOS | Simulator build/install/launch green; TestFlight not ready | `ios-worker-report.md` |
| Android | Debug and unsigned AAB builds green; emulator/device release proof blocked | `android-worker-report.md` |
| Electron/macOS | Pack/sign/launch green; notarization and physical mic proof pending | `electron-worker-report.md` |

## Worker Results

### Web

Passed:

- Typecheck, lint, compliance, deprecations.
- Unit/integration/contracts/tools/MCP/eval coverage: roughly 879 passing assertions across the worker's run.
- Homepage/sign-in/sign-up/settings/search/chat/pricing/legal/docs visual and route proof.
- Security audit showed no known vulnerabilities.
- MCP unauthenticated behavior returns expected OAuth guidance.

Not green:

- API smoke failed locally because HTTP API routes returned 500 or the smoke script could not find the expected Next build manifest.
- `.env.local` appears to be missing `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Two feature-checklist tests are stale after the homepage copy and alpha sign-up changes.
- Google OAuth callback, real microphone recording, and finalize flow still need live browser/device proof.

### iOS

Passed:

- `pnpm exec cap sync ios`.
- Xcode simulator Debug build.
- Simulator install and launch.
- App shell route screenshots for landing, sign-in, sign-up, record, meetings, chat, settings, search, and profile.
- iOS safe-area checks for Dynamic Island and home indicator.
- URL scheme registration: `com.mirafactory.layers://` opens the iOS "Open in Layers?" interstitial.
- Plists and privacy manifest lint clean.

Not green:

- No full Google OAuth native return proof.
- No real microphone permission prompt proof.
- No live recording/transcript/finalize proof.
- TestFlight archive/upload was not attempted.
- Worker reported no iOS Distribution cert/provisioning profiles available for archive/upload.
- Build number is still `1` and must be incremented before upload.
- Non-blocking icon warning: `AppIcon-512@2x.png` is unassigned in the asset catalog.

### Android

Passed:

- `pnpm exec cap sync android`.
- Gradle debug APK build.
- Gradle release AAB build completed.
- Mobile viewport visual proxy screenshots for homepage, sign-in, sign-up, pricing, hamburger, record, and meetings.
- Android manifest declares the expected package, version, permissions, and OAuth callback scheme.
- Local audit and source secret checks passed.

Not green:

- Emulator boot/install/launch blocked by local disk space: worker reported 1.4 GB free while the AVD needs 6 GB+.
- Release AAB is unsigned because `LAYERS_ANDROID_*` signing environment variables are not configured.
- No Google OAuth native return proof.
- No real microphone permission/recording/finalize proof.
- No foreground microphone service exists for background/screen-locked recording; this needs a product decision before Play release.

### Electron/macOS

Passed:

- `pnpm electron:pack`.
- Packaged app signs locally with Developer ID Application team `36J9E4325G`.
- App launches and loads production URL.
- Window chrome uses `hiddenInset`, traffic lights are positioned correctly, and first frame appears under 5s.
- MCP initialize and unauthenticated tool-list behavior checked against production.
- Settings/model selectors, integrations, record/upload, meetings, search, pricing, privacy, and download routes were walked.

Not green:

- Notarization skipped locally; Apple notary credentials are needed for public DMG distribution.
- Real Mac microphone permission/recording/finalize still needs a physical walk.
- Unauthenticated sign-in UI was not walked because the Electron app had an existing signed-in session.
- API smoke needs rerun after stale local port/process cleanup.
- Production privacy page still showed `support@mirrorfactory.ai` in Electron's production route walk; source may be fixed on this branch, but production has not received it yet.

## Blockers

| Blocker | Platforms | Release impact |
| --- | --- | --- |
| Google OAuth callback/return not proven | Web, iOS, Android | Blocks external auth confidence. |
| Real microphone permission not proven | Web, iOS, Android, Electron | Blocks recording release confidence. |
| Live recording/transcript/finalize not proven | Web, iOS, Android, Electron | Blocks core product release confidence. |
| iOS signing/archive/upload gap | iOS | Blocks TestFlight. |
| Android disk space prevents emulator install/launch | Android | Blocks emulator proof until disk is freed. |
| Android signing env missing | Android | Blocks signed Play-ready AAB. |
| Electron notarization missing | Electron/macOS | Blocks public DMG distribution. |
| Local API smoke env/port issues | Web/shared | Blocks clean final release gate, likely not production product bug. |

## Next Recommended Actions

1. Fix or document the local API smoke environment:
   - ensure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` exist locally;
   - stop stale Next servers before `pnpm test:api`;
   - rerun API smoke.
2. Update stale feature-checklist tests for the current homepage headline and alpha sign-up flow.
3. Free at least 8 GB of disk, then rerun Android emulator install/launch.
4. Resolve iOS signing/provisioning and increment build number.
5. Run a real-device/platform recording walk:
   - Google OAuth return;
   - mic permission allow/deny;
   - 30-second recording;
   - stop/finalize;
   - completed meeting detail.
6. Only after those are green, start the TestFlight archive/upload.

## Evidence Files

- `web-worker-report.md`
- `ios-worker-report.md`
- `android-worker-report.md`
- `electron-worker-report.md`
- Platform screenshots in this folder.
