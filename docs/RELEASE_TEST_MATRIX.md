# Layers Release Test Matrix

Owner: QA orchestration
Last updated: 2026-05-18
Scope: required feature and platform testing before TestFlight, Android internal testing, Electron sharing, or web release promotion.

This matrix is the release-gate view. It consolidates:

- `docs/FEATURE_TEST_PLAN.md` for product feature coverage.
- `docs/CROSS_PLATFORM_QA.md` for platform shell and responsive coverage.
- `docs/RECORDING_MANUAL_QA.md` for real microphone and recording reliability.
- `docs/NATIVE_RELEASE_READINESS.md` for iOS TestFlight and Android internal testing readiness.

Do not start a TestFlight upload until the Blocker rows below have either passed or have an explicit release-owner override.

## Platform Columns

| Platform | Target | Evidence expected |
| --- | --- | --- |
| Web | Vercel preview or production URL in Chrome/Safari | Playwright/Expect output, screenshots for public/auth/app surfaces |
| iOS | iPhone simulator for smoke, TestFlight or local signed app for OAuth/mic validation | Xcode build log, simulator screenshots, TestFlight/native OAuth notes when available |
| Android | Emulator for smoke, physical/internal build for OAuth/mic/background validation | Gradle build log, emulator screenshots, adb notes, physical-device notes when available |
| Electron/macOS | Packaged Electron app on macOS | package/build log, screenshots, mic permission/recording notes |

Legend:

- `Auto` means covered by an automated command.
- `Sim` means simulator/emulator/manual agent walk is acceptable.
- `Device` means real device or real distributed native build is required.
- `N/A` means the feature does not apply to that platform.

## Release Gate Matrix

| Gate | Feature / risk area | Web | iOS | Android | Electron/macOS | Required proof | Severity |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Branch, clean tree, version/build numbers | Auto | Auto | Auto | Auto | `git status`, app version/build checked before archive | Blocker |
| 2 | TypeScript, lint, compliance, deprecations | Auto | Auto | Auto | Auto | `pnpm typecheck`, `pnpm lint`, `pnpm compliance`, `pnpm check:deprecations` if available | Blocker |
| 3 | Unit/integration/contracts/tools/MCP | Auto | Auto | Auto | Auto | `pnpm test`, `pnpm test:mcp`, `pnpm test:tools`, `pnpm test:contracts` | Blocker |
| 4 | API smoke and auth-gated route behavior | Auto | Auto | Auto | Auto | `pnpm test:api`; route smoke proves unauthenticated paths fail safely | Blocker |
| 5 | Public homepage brand, no serif drift, no support email drift | Auto + screenshots | Sim | Sim | Sim | Desktop/mobile light/dark screenshots; `admin@mirafactory.ai`; no unintended serif fonts | Blocker |
| 6 | Light/dark mode and responsive layout | Auto + screenshots | Sim | Sim | Sim | Playwright mobile/desktop light/dark plus native screenshots | Blocker |
| 7 | Sign-in/sign-up UI | Auto + screenshots | Sim | Sim | Sim | Email/password fields, invite/alpha copy, Google button placement, no overflow | Blocker |
| 8 | Google OAuth web callback | Device/browser | N/A | N/A | N/A | Complete consent/callback to signed-in state in browser | Blocker |
| 9 | Google OAuth native return | N/A | Device | Device | N/A | In-app/browser OAuth opens correctly and returns to `com.mirafactory.layers` without stranding the user | Blocker |
| 10 | App shell navigation | Auto | Sim | Sim | Sim | Meetings, Chat/Ask, Record, Search, Settings/Profile reachable; back/close behavior sane | Blocker |
| 11 | Recording permission prompt | Device/browser | Device | Device | Device | Start recording triggers mic prompt only after user action; deny path gives usable recovery | Blocker |
| 12 | Live recording and transcript | Device/browser | Device | Device | Device | 30s recording creates transcript chunks and final transcript; no stuck recording state | Blocker |
| 13 | Stop/finalize meeting flow | Device/browser | Device | Device | Device | Stop -> processing -> completed meeting detail; summary/action items render when providers are configured | Blocker |
| 14 | Upload existing audio | Auto/manual | Sim | Sim | Sim | File upload accepts valid audio, rejects oversized/invalid file cleanly, polling completes or errors clearly | P1 |
| 15 | Meeting list/detail UX | Auto | Sim | Sim | Sim | Empty state, completed meeting, transcript, notes package, cost details, copy/export controls | P1 |
| 16 | Search / Ask / Chat | Auto/manual | Sim | Sim | Sim | Search handles empty/results; Ask returns grounded answer or graceful local/provider fallback | P1 |
| 17 | Model selectors and routing | Unit/manual | Sim | Sim | Sim | Settings defaults persist; unsupported provider/env produces clear error, not silent failure | P1 |
| 18 | MCP server and tools | Auto/manual | N/A | N/A | Manual | Initialize, tools/list, authenticated tool call, bad token behavior | P1 |
| 19 | Settings / integrations / API keys | Auto/manual | Sim | Sim | Sim | Integrations page, PAT creation/masking, webhook delivery status, recipes/reminders where available | P1 |
| 20 | Billing/pricing/admin pricing | Auto/manual | Sim | Sim | Sim | Public pricing, plan labels, admin pricing config, checkout path in test mode if enabled | P1 |
| 21 | Legal/account deletion/download/docs | Auto/screenshots | Sim | Sim | Sim | Privacy, Terms, Account Deletion, Download, Docs/MCP/API render and use correct contact email | P1 |
| 22 | Native safe areas and window chrome | N/A | Sim | Sim | Sim | iOS notch/home indicator; Android cutout; macOS traffic lights; no banner/content collision | Blocker |
| 23 | Native build/install/launch | N/A | Auto | Auto | Auto | Xcode simulator/device build, Gradle debug build, Electron pack; launch visible in under 5s | Blocker |
| 24 | iOS archive/TestFlight readiness | N/A | Auto/manual | N/A | N/A | App Store Connect signing, build number increment, archive validation, privacy manifest lint | Blocker for TestFlight |
| 25 | Android internal release readiness | N/A | N/A | Auto/manual | N/A | `bundleRelease` with signing env or documented missing signing; package name confirmed before first upload | Blocker for Play |
| 26 | Electron distribution readiness | N/A | N/A | N/A | Auto/manual | Packaged app opens, mic permission works, app menu/window behavior is acceptable | P1 |
| 27 | Security and secrets | Auto | Auto | Auto | Auto | dependency audit/Dependabot review, secret scan if available, route auth/cross-tenant checks | Blocker |
| 28 | Performance smoke | Auto/manual | Sim | Sim | Sim | Build size/budget, first paint/load sanity, no severe jank on landing/auth/recording | P1 |
| 29 | Offline/error states | Manual | Sim | Sim | Sim | expired session, no network, provider/API error, upload too large, OAuth cancel | P1 |
| 30 | Remotion/video/brand assets | Auto/manual | N/A | N/A | N/A | Remotion render succeeds, uses app-style visual system and approved font/contact assets | P2 |

## Minimum TestFlight Go/No-Go

For a first internal TestFlight build, these rows must be green:

- Gates 1-13.
- Gate 22.
- Gate 23 for iOS.
- Gate 24.
- Gate 27.

Rows 14-21 and 28-30 can be accepted as P1/P2 follow-ups only if the exact gap is documented in the build notes and no core recording/auth path is affected.

## Recommended Run Order

1. Confirm repo state and build metadata:
   `git status --short --branch`, inspect `ios/App/App.xcodeproj/project.pbxproj`, inspect `capacitor.config.ts`.
2. Run low-risk gates:
   `pnpm typecheck`, `pnpm lint`, `pnpm compliance`, `pnpm check:deprecations` when present.
3. Run automated product coverage:
   `pnpm test`, `pnpm test:mcp`, `pnpm test:tools`, `pnpm test:contracts`, `pnpm test:api`.
4. Run browser proof:
   targeted smoke, feature checklist, mobile/desktop light/dark, and screenshots for homepage/auth/app shell.
5. Run native smoke:
   `pnpm exec cap sync ios`, Xcode simulator build/install/launch, Android debug build/install/launch, Electron pack/launch.
6. Run manual/native-critical proof:
   Google OAuth return and real microphone recording on iOS/Android/Electron/Web.
7. Only after the above, archive and upload TestFlight:
   increment iOS build number, archive Release, validate/export/upload to App Store Connect.

## Evidence Folder Standard

Use one evidence folder per release pass:

`docs/evidence/YYYY-MM-DD-release-test-matrix/`

Required files:

- `command-summary.md` with commands, pass/fail, and important output snippets.
- `web-home-light.png`, `web-home-dark.png`, `web-auth-google.png`.
- `ios-home.png`, `ios-auth-google-return.png`, `ios-recording.png`.
- `android-home.png`, `android-auth-google-return.png`, `android-recording.png`.
- `electron-home.png`, `electron-recording.png`.
- Native build logs or links to CI artifacts.

## Current Status Snapshot

As of this matrix creation, the repo already has broad QA docs, but the release-critical unresolved proof is still native end-to-end behavior:

- iOS/Android Google OAuth return must be proven in the native shell or distributed build.
- Real microphone recording/finalization must be walked on native shells, not only browser tests.
- iOS TestFlight archive/upload has not started from this matrix.
- Android signed internal release requires signing variables or explicit owner setup.
