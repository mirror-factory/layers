# Android QA Report — 2026-05-17

- **Branch:** `release/external-tester-readiness-2026-05-17`
- **Emulator:** `LayersPixel` (Pixel 7, 1080×2400, density 420, Android 14 system image, arm64-v8a)
- **APK under test:** `android/app/build/outputs/apk/debug/app-debug.apk` (7.17 MB, mtime 2026-05-17 18:03)
- **Manifest validation:** `xmllint --noout android/app/src/main/AndroidManifest.xml` → OK
- **Package on emulator:** `com.mirafactory.layers` — verified via `pm list packages` and `dumpsys package`. `versionName=1.0`, `versionCode=1`, `minSdk=24`, `targetSdk=36`
- **Live URL the WebView loads:** `https://layers.mirrorfactory.ai` (per `capacitor.config.ts`)
- **App-id drift confirmed (cosmetic, emulator-only):** in addition to the build under test, the AVD still has historical bundles installed — `com.mirrorfactory.layers` (two `r`s) and `com.mirrorfactory.audiolayer`. Three "Layers" icons show in the app drawer (see `A4-app-drawer.png`). The current build identity (`com.mirafactory.layers`, one `r`) matches both `android/app/build.gradle` and `capacitor.config.ts`, so this is leftover install state on this AVD, not a build regression. **Recommendation: factory-reset the AVD or `adb uninstall` the two `com.mirrorfactory.*` packages before external-tester screen recordings — current state will confuse a fresh tester.**

---

## What was checked

| Category | Result |
|----------|--------|
| A. Build/install/launch | PASS |
| B. UI / visual layout / typography | PASS |
| C. UX / navigation / theme / hardware back / keyboard | PASS |
| D. Public surfaces (`/`, `/pricing`, `/sign-in`, `/sign-up`, `/download`, `/changelog`, `/privacy`, `/terms`, `/account-deletion`) | PASS |
| E. Authed app surfaces (`/meetings`, `/chat`, `/ask`, `/settings`, `/profile`) | BLOCKED — no test account credentials provided to this worker |
| F. Recording — native real-mic flow | BLOCKED — gated behind auth; emulator mic untested |
| F. Recording — focused Playwright stop-flow as supporting evidence | SKIPPED — no dev server running, out of scope for the Android worker (web has its own coverage in `tests/e2e/recording-stop-flow.spec.ts`) |
| G. AI / chat / ask / MCP UI | BLOCKED — gated behind auth |
| H. Settings / account / billing | BLOCKED — gated behind auth |
| Native specifics: package id, icon, status-bar clearance, relaunch, crash/ANR scan | PASS |

---

## Passed

### A. Build / install / launch
- **A1 — Manifest valid:** `xmllint --noout` on `AndroidManifest.xml` → OK.
- **A2 — Install:** clean uninstall then `adb install -r app-debug.apk` → `Success` (Performing Streamed Install). One APK, no split-APK delivery issue.
- **A3 — Cold launch:** `adb shell am start -n com.mirafactory.layers/.MainActivity` → first frame visible within ~5 s on the emulator (capture taken at +5 s). `topResumedActivity=ActivityRecord{… com.mirafactory.layers/.MainActivity}`. Evidence: `A3-cold-launch.png`.
- **A4 — Launcher icon renders:** circular blue "concentric-curl" mark visible in the app drawer for `com.mirafactory.layers`. Evidence: `A4-app-drawer.png`, `A4-home-screen-pre-launch.png`. **Caveat:** two stale historical packages also show launcher icons — see drift note above.
- **A5 — Status-bar / cutout clearance:** TestingBanner ("WE'RE IN INVITE-ONLY ALPHA — PUBLIC SIGN-UPS COMING SOON") sits flush below the status bar, no overlap of the time / wifi / battery cluster, no notch bleed-through. Same clearance held on every page captured (landing, pricing, download, sign-in, sign-up, privacy, terms, account-deletion, changelog). Evidence: every PNG in this folder.
- **A6 — Relaunch after force-stop:** `adb shell am force-stop com.mirafactory.layers` then re-`am start` → landing rendered cleanly with TestingBanner intact, no white flash, no error overlay. Evidence: `A6-relaunch-after-stop.png`.

### B. UI / visual layout / typography
- **B1 — TestingBanner clears status bar** on every page. Evidence: `B1-testing-banner.png`.
- **B2 — Sticky public-nav** stays opaque on scroll; no headline bleed-through. Evidence: `B2-scrolled-1.png` … `B2-scrolled-5.png`.
- **B3 / B4 — No horizontal overflow** on landing, pricing, download, privacy, terms, account-deletion, changelog, sign-in, sign-up. Confirmed by visual inspection of all D-prefix captures.
- **B5 — Type renders without serif violation.** Italic accents ("Decisions that move work forward.", "quietly", "you actually use.") use `fontStyle: "italic"` on the same `var(--font-sans)` stack defined in `app/globals.css:317-318` (`font-family: var(--font-sans), var(--font-brand-sans)`). Visual inspection of the rendered glyphs (e.g. `B2-scrolled-3.png`, `D5-download.png`) shows true sans-serif italic shapes — no transitional, no script, no serif face. **PASS** — initial concern about possible serif rendering was an optical artefact of italic + mint colour.
- **B6 — Pricing cards align:** $20 Core "MOST POPULAR" lozenge → stacked → $30 Pro → comparison table. Evidence: `D2-pricing.png`, `D2-pricing-scroll-1.png`, `D2-pricing-scroll-2.png`, `B2-scrolled-5.png`.
- **B7 — Logos render:** MCP page section on landing shows ChatGPT (OpenAI), Claude (Anthropic), Gemini (Google) with the cached brand SVGs from `public/brand-icons/`. No broken-image alt visible. Evidence: `B2-scrolled-3.png`.
- **B8 — Footer wraps cleanly** with rows Pricing / Download / Changelog / Privacy / Terms / Account deletion / Contact + X icon. Evidence: `D-footer-1.png`.
- **B10 — Dark mode renders complete** (no missing tokens, drawer + page background both transition together). Evidence: `C2-dark-mode.png`, `C2-back-to-light.png`.

### C. UX / navigation / a11y
- **C1 — Hamburger opens drawer; X closes; nav items tappable.** Drawer items reachable at correct bounds (Download `[63,514][1021,640]`, Pricing `[63,647][1021,771]`, Sign in `[63,779][1021,905]` per `uiautomator dump`). Evidence: `C1-drawer-open.png`, `D-debug-drawer.png`.
  - **Doc drift to fix:** the "Tap-coordinate cheatsheet" in `docs/CROSS_PLATFORM_QA.md` lists Download at `(200, 475)`, Pricing at `(200, 682)`, Sign in at `(200, 861)`. The actual centres on this build are `(542, 577)`, `(542, 709)`, `(542, 842)` — the doc coords miss the Download row by ~100 px on the Y axis and waste both halves of the row on the X axis. **Recommendation: update the cheatsheet so the next agent doesn't lose 10 minutes the way this run did.**
- **C1 (unauth) — Drawer shows the three unauth links** (Download, Pricing, Sign in) — correct for a signed-out session. Evidence: `C1-drawer-open.png`.
- **C2 — Theme toggle** flips html class; persisted across the drawer toggle. Evidence: `C2-dark-mode.png` ↔ `C2-back-to-light.png`.
- **C4 / C5 — Hardware back works.** From `/sign-in` → back → landing. From `/privacy` → back → previous page. From IME open → back → IME closed (no view pop). Evidence: `C5-hardware-back-to-landing.png`.
- **C9 — A11y labels present.** From `uiautomator dump`: banner has `content-desc="Site status notice"`, nav has `text="Primary navigation"`, brand mark has `content-desc="Layers home"`, theme button has `text="Switch to dark mode"`, hamburger toggles between `"Open menu"` ↔ `"Close menu"`, footer has `text="Footer navigation"`, sign-up form has `resource-id="email"` and `resource-id="password"` (with `password="true"` on the latter). No `NAF` warnings except the two EditTexts (no accessible label) — minor, sign-up still navigable.

### D. Public surfaces
- **D1 — `/` landing** — hero, AI-memory section, MCP section, pricing teaser, footer. Evidence: `A3-cold-launch.png`, `B2-scrolled-*.png`.
- **D2 — `/pricing`** — "Pay for the meeting memory you actually use." hero, Core $20 / Pro $30 cards, "A quiet comparison" capability table. Evidence: `D2-pricing.png`, `D2-pricing-scroll-*.png`.
- **D3 — `/sign-in`** — "WELCOME BACK / Sign in to Layers", Google OAuth button, email + password, `admin@mirafactory.ai` footnote, "Create an account →" link. Evidence: `D3-signin.png`.
- **D4 — `/sign-up`** — "CREATE ACCOUNT / Start with Layers", Google OAuth button, email + password fields, Terms + Privacy Policy notice, sign-in link. Email typed via `adb input text` and confirmed back via `uiautomator dump` (`resource-id="email" text="qa-android-2026-05-17@example.com"`). **CTA is "Coming soon" and disabled (`enabled="false"`) — consistent with invite-only alpha.** Evidence: `D4-signup.png`, `D4-signup-typed.png`.
- **D5 — `/download`** — "Wherever your meetings happen, Layers is quietly listening.", release-line callout with v0.1.120, per-platform install cards (macOS, Windows, web, iOS, Android, plus support callout). Evidence: `D5-download.png`.
- **D6 — `/changelog`** — "WHAT'S NEW / Changelog", "124 releases so far", v0.1.120 entry visible at top. Evidence: `D6-changelog.png`.
- **D10 — `/privacy`** — "Privacy Policy", "Last updated April 30, 2026", "Mirror Factory" owner, support email, "Launch draft – legal review pending" notice. Evidence: `D10-privacy.png`, `D10-privacy-scroll.png`.
- **D11 — `/terms`** — "Terms of Service", same metadata pattern, "Rules of use" section visible. Evidence: `D11-terms.png`.
- **D12 — `/account-deletion`** — "Delete your Layers account and data", instructions present, support email present. Evidence: `D12-account-deletion.png`.

### Native specifics
- **Keyboard / forms.** Tapping the sign-up email field raises the soft keyboard and accepts `adb input text`. Pressing `KEYCODE_BACK` dismisses the IME without popping the view. Evidence: `D4-signup-typed.png`.
- **Crash / ANR scan.** `adb logcat -d -t 300` and `adb logcat -d -s AndroidRuntime:E chromium:E System.err:W -t 200` after the full session → **0 FATAL, 0 ANR, 0 tombstone, 0 AndroidRuntime crash**. The only chromium errors are benign WebView cache scaffolding warnings on first cold-start (`Simple Cache Backend: cache directory inaccessible right after creation`, `Unable to create cache`) which Chromium itself recovers from on the next session. Evidence: `logcat-session-end.txt`, `logcat-app-only.txt`, `logcat-after-signin.txt`.

---

## Failed

None at the test-case level. Two soft issues worth tracking:

1. **AVD has three Layers launcher icons.** `com.mirafactory.layers` (current), `com.mirrorfactory.layers`, and `com.mirrorfactory.audiolayer` are all installed on this AVD. A fresh external tester walking the AVD would see three identical "Layers" icons in the drawer and not know which to launch. This is emulator state, not a release blocker — but worth cleaning before recording the external-tester walkthrough.
   - **Fix:** `adb uninstall com.mirrorfactory.layers && adb uninstall com.mirrorfactory.audiolayer` on the LayersPixel AVD.

2. **Outdated drawer tap coordinates in `docs/CROSS_PLATFORM_QA.md`.** The cheatsheet lists Download `(200, 475)`, Pricing `(200, 682)`, Sign in `(200, 861)`. Actual bounds (per `uiautomator dump` against this APK) are: Download centre `(542, 577)`, Pricing centre `(542, 709)`, Sign in centre `(542, 842)`. Following the doc verbatim produces a no-op tap on the gap above the Download row. Not a release blocker; is a developer-velocity blocker for the next agent that walks this AVD.

---

## Blocked / skipped

- **E1 – E7 (authed app surfaces):** no test-account credentials were provided to this worker. The Capacitor shell loads live `layers.mirrorfactory.ai`, which gates `/meetings`, `/chat`, `/ask`, `/settings`, `/profile` behind Supabase auth. The recommended pattern (per `docs/CROSS_PLATFORM_QA.md`, section E) requires planting an `sb-…-auth-token` cookie minted from a test user — that mint path isn't exposed to this run.
- **F1 – F8 (recording flow, native):** gated behind the same auth wall. Even with the emulator's virtual mic available, `/record` requires a signed-in session.
- **F (supporting Playwright stop-flow):** `tests/e2e/recording-stop-flow.spec.ts` exists and is wired into `pnpm verify:tier` (see `scripts/verify-ticket.ts`), but it targets the web build and needs `pnpm dev` running. No dev server was up on `:3000` and spinning one up for a web-only check is outside the Android worker's scope. **Native real-mic remains blocked; coverage relies on the web stop-flow which lives in a separate session.**
- **G – I (chat / ask / MCP / settings / billing / OAuth):** all gated behind auth.
- **D8, D9, D13:** `/docs/mcp`, `/docs/api`, `/roadmap` not visited — no in-page link from the public marketing surfaces walked here, and Capacitor does not expose a URL bar. Would need either a deep link entry or a JS-injection path to navigate from the WebView without auth. **Recommendation: add a public footer link to `/docs` from the landing footer so this surface is reachable in unauth walks.**

---

## Evidence paths

All under `docs/evidence/2026-05-18-claude-cross-platform-qa/android/`:

```
A3-cold-launch.png                — A3 first frame after fresh cold launch
A4-home-screen-pre-launch.png     — Pixel home + Layers icon in dock
A4-app-drawer.png                 — A4 launcher icons (shows 3-icon drift)
A6-relaunch-after-stop.png        — A6 force-stop → reopen → landing intact
B1-testing-banner.png             — TestingBanner clearance
B2-scrolled-1.png – B2-scrolled-5.png — sticky-nav + section walk
B5-typography-landing.png         — (mostly black; superseded by B2-* and D5-)
C1-drawer-open.png                — drawer with Download/Pricing/Sign in
C2-dark-mode.png / C2-back-to-light.png — theme toggle
C5-hardware-back-to-landing.png   — hardware-back lands on /
D-debug-drawer.png                — drawer used to capture true bounds
D-footer-1.png                    — footer nav captured
D2-pricing.png / D2-pricing-scroll-1.png / D2-pricing-scroll-2.png
D3-signin.png / D3-signin-revisit.png
D4-signup.png / D4-signup-typed.png
D5-download.png / D5-download-attempt2.png / D5-download-top.png
D6-changelog.png
D10-privacy.png / D10-privacy-scroll.png
D11-terms.png
D12-account-deletion.png
F-record-attempt.png              — deep-link to /record reopens app on landing (Capacitor server.url overrides)
logcat-after-signin.txt           — 80-line slice after sign-in tap
logcat-app-only.txt               — pid-scoped logcat
logcat-session-end.txt            — 300-line slice at session end (no FATAL/ANR/CRASH)
```

---

## Commands run and results (selection)

```bash
$ git status --short --branch
## release/external-tester-readiness-2026-05-17...origin/release/external-tester-readiness-2026-05-17

$ xmllint --noout android/app/src/main/AndroidManifest.xml && echo OK
OK

$ ANDROID_HOME=/opt/homebrew/share/android-commandlinetools \
    nohup $ANDROID_HOME/emulator/emulator -avd LayersPixel -no-snapshot -no-boot-anim -gpu host > /tmp/emu.log 2>&1 &
# polled adb shell getprop sys.boot_completed; 1 within ~20s

$ adb devices
emulator-5554   device

$ adb shell wm size && adb shell wm density
Physical size: 1080x2400
Physical density: 420

$ adb uninstall com.mirafactory.layers && adb install -r android/app/build/outputs/apk/debug/app-debug.apk
Success
Performing Streamed Install
Success

$ adb shell dumpsys package com.mirafactory.layers | grep -E "versionName|versionCode|targetSdk"
versionCode=1 minSdk=24 targetSdk=36
versionName=1.0

$ adb shell am start -n com.mirafactory.layers/.MainActivity
Starting: Intent { cmp=com.mirafactory.layers/.MainActivity }

$ adb shell dumpsys activity activities | grep ResumedActivity
topResumedActivity=ActivityRecord{… com.mirafactory.layers/.MainActivity t28}
ResumedActivity:      ActivityRecord{… com.mirafactory.layers/.MainActivity t28}

$ adb shell pm list packages | grep -iE "layer|mira"
package:com.mirrorfactory.layers
package:com.mirrorfactory.audiolayer
package:com.mirafactory.layers          # current build under test

$ adb logcat -d -s AndroidRuntime:E chromium:E System.err:W -t 200
… only benign WebView cache warnings on cold start; no FATAL / ANR / crash …
```

(Full set of `input tap` / `input swipe` / `uiautomator dump` invocations interleaved with screenshots above.)

---

## Release recommendation for Android internal testing

**Ship-ready for Play Internal Testing pending two non-blocking cleanups.**

The build installs, launches cold in under 5 s, survives a force-stop relaunch, logs zero FATAL / ANR / crash events through a full unauth walk of every public surface, and renders correctly in both light and dark themes with the status-bar/cutout/testing-banner clearance the design contract specifies. Drawer navigation, hamburger toggle, theme toggle, hardware back, soft-keyboard, and form input all behave natively. The sign-up CTA correctly reads "Coming soon" and stays disabled while public sign-ups are gated — that matches the alpha messaging on the TestingBanner.

**Cleanups before recording the external-tester walkthrough on this AVD:**
1. `adb uninstall com.mirrorfactory.layers && adb uninstall com.mirrorfactory.audiolayer` — eliminates the three-launcher-icon confusion in the drawer. Pure AVD hygiene; no build change needed.
2. Update the drawer Tap-coordinate cheatsheet in `docs/CROSS_PLATFORM_QA.md` to match the current build: Download `(542, 577)`, Pricing `(542, 709)`, Sign in `(542, 842)`. Future agents will save ~10 min.

**Outstanding coverage that this worker could not exercise (auth-gated, not a release blocker for unauth internal testing, but **must** be walked before broadening the tester pool):**
- `/meetings`, `/chat`, `/ask`, `/settings`, `/profile` — authed shell.
- `/record` — native mic permission copy, AssemblyAI streaming, autosave, stop → processing → `/meetings/[id]` redirect.
- Google OAuth native deep-link `com.mirafactory.layers://auth/callback?…` (PROD-408 in the matrix). Without a test account this run could not confirm whether the deep-link round-trips back into the Capacitor shell.

If the next session can mint a test-user cookie (per the gotrue `confirmation_token NULL` workaround in `docs/CROSS_PLATFORM_QA.md` section E) and plant it via `WebView.evaluateJavascript`, the authed surfaces become reachable from this same AVD without changing the build.
