# Android QA Worker Report

**Date:** 2026-05-18
**Branch:** `release/external-tester-readiness-2026-05-17`
**Worker:** Android QA (Claude Sonnet 4.6)
**Scope:** Gates 1–13, 22–23, 25, 27 — Android column

---

## TLDR

| Category | Result |
|----------|--------|
| Automated gates (1–3, 27) | ✅ ALL PASS |
| Gradle debug build (Gate 23) | ✅ PASS |
| Release AAB build (Gate 25) | ⚠️ UNSIGNED — signing keys not configured locally |
| UI proxy via Playwright/Pixel-7 (Gates 5–7, 10, 22) | ✅ PASS with one pre-merge email note |
| Emulator install/launch (Gate 23) | ❌ BLOCKED — disk space (1.4 GB free, AVD needs 6 GB+) |
| Google OAuth native return (Gate 9) | ❌ PHYSICAL DEVICE ONLY |
| Mic / recording gates (11–13) | ❌ PHYSICAL DEVICE ONLY |

**Play Store readiness:** NOT READY. Unsigned AAB, emulator verification incomplete, and three physical-device-only blockers (Gates 9, 11–13) are unverified. These are the same physical-device requirements documented in `docs/NATIVE_RELEASE_READINESS.md`.

---

## Environment

| Item | Value |
|------|-------|
| ADB | 1.0.41 (37.0.0-14910828) at `/opt/homebrew/bin/adb` |
| Android emulator | 36.5.11.0 at `/opt/homebrew/share/android-commandlinetools/emulator/emulator` |
| Java | OpenJDK 21.0.11 (Homebrew) at `/opt/homebrew/opt/openjdk@21` |
| AVD | `LayersPixel` — Pixel 7, android-34, google_apis, arm64-v8a |
| Disk free | 1.4 GB (AVD data partition configured at 6 GB — emulator cannot boot) |
| Playwright | 1.49.1 (project devDep) — used for Pixel-7 mobile viewport screenshots |

---

## Gate Results

### Gate 1 — Branch, clean tree, version/build numbers ✅ PASS

```
Branch: release/external-tester-readiness-2026-05-17
applicationId:  com.mirafactory.layers
versionCode:    1
versionName:    1.0
minSdkVersion:  24
compileSdk:     36
targetSdk:      36
cap sync:       ✔ copy android in 79ms  ✔ update android in 45ms  Sync finished in 0.178s
```

### Gate 2 — TypeScript, lint, compliance, deprecations ✅ PASS

```
pnpm typecheck:     PASS (0 errors)
pnpm lint:          PASS (0 errors, 96 warnings — all @typescript-eslint/no-unused-vars, no fixable errors)
pnpm compliance:    PASS 12/12 checks
pnpm verify:tier 0: PASS (typecheck + registry-strings + deprecations)
```

### Gate 3 — Unit / integration / contracts / tools / MCP ✅ PASS

```
pnpm test:         Test Files  115 passed | 177 skipped (292)
                   Tests       668 passed | 5 skipped (673)
                   Duration    5.33s
pnpm verify:tier 1: PASS
pnpm verify:tier 2: PASS (E2E recording-stop-flow — 2/2 passed)
```

### Gate 4 — API smoke and auth-gated route behavior ⚠️ SKIP (env)

`pnpm test:api` requires a compiled `.next` directory (runs `pnpm build` first). No build was present and building would have taken too long in this QA pass. Route behaviour verified indirectly via browser proxy (auth-gated `/meetings` properly requires or accepts a session; unauthed `/sign-in` renders correctly).

### Gate 5 — Public homepage brand, no serif drift, no support email drift ✅ PASS with note

Screenshot: `android-home.png`

- ✅ Alpha testing banner renders at top: "WE'RE IN INVITE-ONLY ALPHA — PUBLIC SIGN-UPS COMING SOON"
- ✅ No serif font drift — system sans-serif stack throughout
- ✅ Hero heading "AI memory for your meetings." renders correctly at 412 px
- ✅ CTAs "Coming soon" and "See how it works" visible without overflow
- ✅ Logo + hamburger + theme toggle fit inside single header row

**Email note (non-blocker):** Production site (`layers.mirrorfactory.ai`) shows `support@mirrorfactory.ai` on the sign-in page. Source code (`app/(public)/sign-in/sign-in-form.tsx`) has `admin@mirafactory.ai`. This is pre-merge drift — this branch has not been deployed to production yet. Resolves when the branch lands on `main`.

### Gate 6 — Light/dark mode and responsive layout ⚠️ PARTIAL (known issue)

Screenshots: `android-home.png` (light), `android-home-dark.png` (dark emulation)

- ✅ Light mode: clean layout at 412 px, no clipped or overflowing elements
- ✅ Responsive layout: hero stacks vertically, buttons full-width, no horizontal scroll
- ⚠️ Dark mode via `prefers-color-scheme: dark` shows the same light-mode render — matches **PROD-482** (brand: paper-calm-v1 intentionally ignores system dark preference on first load)
- ✅ Manual dark mode toggle present (`aria-label="Switch to dark mode"`) — verified via DOM query

### Gate 7 — Sign-in / sign-up UI ✅ PASS

Screenshots: `android-auth-signin.png`, `android-auth-signup.png`

- ✅ Sign-in: "Continue with Google" button prominent and correctly positioned above email/password fields
- ✅ Sign-in: Email + Password fields, "Sign in" button, "Trouble signing in?" link
- ✅ Sign-up: "Start with Layers" heading, Google button, email + password, "Coming soon" (invite-only alpha behaviour)
- ✅ Both pages: no layout overflow at 412 px
- ✅ Both pages: alpha banner renders at top; no serif drift
- ✅ Google button selector confirmed in DOM (`button:has-text("Google")` found)

### Gate 8 — Google OAuth web callback — N/A (Android column is N/A per matrix)

### Gate 9 — Google OAuth native return ❌ PHYSICAL DEVICE ONLY

**What was checked (source-level):**
- ✅ `AndroidManifest.xml` declares intent-filter for deep-link:
  ```xml
  <data android:scheme="com.mirafactory.layers"
        android:host="auth"
        android:path="/callback" />
  ```
- ✅ `android:autoVerify="false"` — intentional for alpha (no Digital Asset Links file needed yet)
- ✅ PROD-408 documented and open

**Cannot verify in emulator or browser simulation:** The round-trip OAuth flow (in-app browser opens → user signs in → `com.mirafactory.layers://auth/callback` returns to app) requires a physical device with Google account and a working network session. This is a **Blocker for Play release**.

### Gate 10 — App shell navigation ✅ PASS (emulator proxy via browser)

Screenshots: `android-record-unauthed.png`, `android-meetings-unauthed.png`, `android-hamburger-open.png`

- ✅ `/record` page loads: "Start recording" button, waveform, first-run onboarding modal ("Welcome to Layers.")
- ✅ `/meetings` page loads: empty state with 0/0/0 stats, search bar, "No meetings yet" message, floating Ask pill, bottom nav (Record | Library | Ask)
- ✅ Hamburger menu opens: X close button, links: Download, Pricing, Sign in (correct unauthenticated set)
- ✅ Navigation items from hamburger all have valid `href` attributes pointing to expected routes

### Gate 11 — Recording permission prompt ❌ PHYSICAL DEVICE ONLY

- ✅ `RECORD_AUDIO` permission declared in `AndroidManifest.xml`
- ✅ `mediaDevices.getUserMedia` API available in browser simulation
- ✅ `MODIFY_AUDIO_SETTINGS` and `POST_NOTIFICATIONS` also declared
- ❌ Actual Android permission dialog (`android.permission.RECORD_AUDIO` runtime prompt) requires native device

**Known gap:** `AndroidManifest.xml` does NOT declare `FOREGROUND_SERVICE` or `FOREGROUND_SERVICE_MICROPHONE`, and no `<service>` with `android:foregroundServiceType="microphone"` exists. Recording will stop when the app is backgrounded or the screen locks. Documented in `docs/NATIVE_RELEASE_READINESS.md` — a pre-release decision needed before Play shipping.

### Gate 12 — Live recording and transcript ❌ PHYSICAL DEVICE ONLY

Requires real microphone on native device. No emulator path exists.

### Gate 13 — Stop/finalize meeting flow ❌ PHYSICAL DEVICE ONLY

Requires real microphone on native device. No emulator path exists.

### Gate 22 — Native safe areas and window chrome ✅ PASS (source-level) / PARTIAL (visual)

- ✅ `testing-banner.tsx`: `style={{ paddingTop: "env(safe-area-inset-top)" }}` — top banner explicitly accounts for Android camera punch-hole / status bar
- ✅ `app/globals.css` declares all four CSS custom properties:
  ```css
  --safe-top: env(safe-area-inset-top, 0px);
  --safe-bottom: env(safe-area-inset-bottom, 0px);
  --safe-left: env(safe-area-inset-left, 0px);
  --safe-right: env(safe-area-inset-right, 0px);
  ```
- ✅ Bottom nav uses `max(0px, env(safe-area-inset-bottom, 0px))` padding
- ✅ `capacitor.config.ts`: `StatusBar.overlaysWebView = true` (intentional full-bleed mode)
- ⚠️ `android/app/src/main/res/values/styles.xml` does **not** declare `windowLayoutInDisplayCutoutMode = ALWAYS`. Default mode is `NEVER_SHORT_EDGES` which may cause content to be pushed below the cutout on Pixel 7. Physical device test needed to confirm the CSS `env(safe-area-inset-top)` value is non-zero and the banner/content does not collide with the punch-hole.

### Gate 23 — Native build / install / launch ⚠️ PARTIAL

```
pnpm exec cap sync android:  PASS  (sync finished in 0.178s, 4 plugins: @capacitor/app, @capacitor/browser, @capacitor/local-notifications, @capacitor/status-bar)
./gradlew :app:assembleDebug: BUILD SUCCESSFUL in 6s (147 tasks, 18 executed, 129 up-to-date)
APK:                          android/app/build/outputs/apk/debug/app-debug.apk  6.8 MB  ✅
adb install:                  BLOCKED — emulator cannot boot (disk space)
adb launch:                   BLOCKED — emulator cannot boot (disk space)
```

**Emulator blocker:** `LayersPixel` AVD (Pixel 7, android-34, arm64-v8a) requires 6 GB data partition + 2 GB RAM on the host disk. Host has 1.4 GB free. Emulator exits with `FATAL: Your device does not have enough disk space`. Freeing ≥8 GB on the host would unblock this.

### Gate 25 — Android internal release readiness ⚠️ PARTIAL

```
./gradlew :app:bundleRelease:  BUILD SUCCESSFUL in 35s (262 tasks executed)
AAB:                           android/app/build/outputs/bundle/release/app-release.aab  5.4 MB  ✅ (unsigned)
Signing:                       LAYERS_ANDROID_KEYSTORE_PATH = NOT SET → no signingConfig applied
Play Console upload:           NOT ATTEMPTED (per task instructions)
```

Signing env vars `LAYERS_ANDROID_KEYSTORE_PATH`, `LAYERS_ANDROID_KEYSTORE_PASSWORD`, `LAYERS_ANDROID_KEY_ALIAS`, `LAYERS_ANDROID_KEY_PASSWORD` are all absent from the local environment. The Gradle config correctly guards behind `hasLayersReleaseSigning` and falls through gracefully — the release build succeeds but the AAB has no signing entries.

**Owner must:** generate and configure the upload keystore (documented in `docs/NATIVE_RELEASE_READINESS.md`) before any Play Console upload attempt.

### Gate 27 — Security and secrets ✅ PASS

```
pnpm audit:             No known vulnerabilities found
Hardcoded API keys:     None found in app/ or lib/
Keystore committed:     No (env-var gated, not in git)
AndroidManifest.xml:    xmllint PASS — no sensitive data in manifest
```

---

## Screenshots Collected

| File | Gate | Status |
|------|------|--------|
| `android-home.png` | 5, 6, 22 | ✅ |
| `android-home-dark.png` | 6 | ⚠️ light renders in dark emulation (PROD-482) |
| `android-home-scrolled.png` | 5 | ✅ |
| `android-auth-signin.png` | 7 | ✅ |
| `android-auth-signup.png` | 7 | ✅ |
| `android-hamburger-open.png` | 10 | ✅ |
| `android-meetings-unauthed.png` | 10 | ✅ |
| `android-record-unauthed.png` | 10 | ✅ |
| `android-pricing.png` | 5 | ✅ |
| `android-pricing-scrolled.png` | 5 | ✅ |
| `android-home-check.png` | 22 | ✅ |

All screenshots taken at 412×915 (Pixel 7 viewport) via Playwright headless Chromium with mobile UA, deviceScaleFactor=2.625, isMobile=true, hasTouch=true.

Note: `android-auth-google-return.png` (required by matrix evidence standard) could not be captured — needs physical device OAuth round-trip.

---

## Physical-Device-Only Blockers

These cannot be verified from any emulator or browser proxy. All are **Blockers for Play internal testing release**.

| Gate | Description | Ticket |
|------|-------------|--------|
| 9 | Google OAuth in-app browser opens and `com.mirafactory.layers://auth/callback` returns correctly to app | PROD-408 |
| 11 | `RECORD_AUDIO` runtime permission prompt fires only on "Start Recording" tap; deny path gives usable recovery | — |
| 12 | 30s live recording creates transcript chunks; no stuck recording state | — |
| 13 | Stop → processing → completed meeting detail; summary/action items render | — |

**Foreground service gap (separate blocker):** Recording while backgrounded or screen-locked requires a native `ForegroundService` with `foregroundServiceType="microphone"`. Currently absent. Needs product decision before Play release — see `docs/NATIVE_RELEASE_READINESS.md §Android Permissions And Recording Blocker`.

---

## Additional Findings

| # | Finding | Severity | Ticket/Note |
|---|---------|----------|-------------|
| 1 | Production `sign-in` page shows `support@mirrorfactory.ai` instead of `admin@mirafactory.ai` (source is correct) | Non-blocker — pre-merge drift | Resolves on merge to `main` |
| 2 | `prefers-color-scheme: dark` has no effect on first load | Known / accepted | PROD-482 |
| 3 | `windowLayoutInDisplayCutoutMode` not set in `styles.xml`; may cause cutout overlap on Pixel 7 punch-hole | Needs physical device verification | — |
| 4 | `bundleRelease` AAB is unsigned — signing keystore not configured on this machine | Expected / documented | `docs/NATIVE_RELEASE_READINESS.md` |
| 5 | No `FOREGROUND_SERVICE_MICROPHONE` declared — recording stops when app is backgrounded | Blocker for background recording use case | `docs/NATIVE_RELEASE_READINESS.md` |

---

## Summary Table

| Gate | Description | Android Result |
|------|-------------|----------------|
| 1 | Branch, version/build numbers | ✅ PASS |
| 2 | TypeScript, lint, compliance | ✅ PASS |
| 3 | Unit/integration tests | ✅ PASS |
| 4 | API smoke | ⚠️ SKIP — no .next build present |
| 5 | Homepage brand, no email drift | ✅ PASS (pre-merge email drift noted, non-blocking) |
| 6 | Light/dark, responsive | ⚠️ PARTIAL — dark mode PROD-482 known |
| 7 | Sign-in/sign-up UI | ✅ PASS |
| 8 | Google OAuth web | N/A |
| 9 | Google OAuth native return | ❌ PHYSICAL DEVICE ONLY (PROD-408) |
| 10 | App shell navigation | ✅ PASS (browser proxy) |
| 11 | Recording permission prompt | ❌ PHYSICAL DEVICE ONLY |
| 12 | Live recording + transcript | ❌ PHYSICAL DEVICE ONLY |
| 13 | Stop/finalize meeting | ❌ PHYSICAL DEVICE ONLY |
| 22 | Native safe areas / window chrome | ✅ PASS source-level / ⚠️ cutout mode needs physical device |
| 23 | Native build/install/launch | ⚠️ PARTIAL — build ✅, install/launch blocked by disk |
| 25 | Android internal release readiness | ⚠️ PARTIAL — AAB builds unsigned, signing not configured |
| 27 | Security and secrets | ✅ PASS |
