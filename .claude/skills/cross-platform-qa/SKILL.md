---
name: cross-platform-qa
description: Cross-platform smoke testing playbook for Layers (Web / iOS / Android / macOS / Windows). Walks the rolling Linear suite (PROD-501 master + per-platform children), captures screenshots + videos, judges brand alignment against design.json tokens, and files real Linear bugs for anything that fails.
---

# Cross-Platform QA Skill

> **Trigger this skill when:** the user asks to "run QA", "smoke-test", "walk the checklist", "test on all platforms", "verify a release", or names a specific platform sub-issue (PROD-502 web, PROD-503 iOS, PROD-504 android, PROD-505 macos).
>
> **Always update the Activity Log** ([`docs/ACTIVITY_LOG.md`](../../docs/ACTIVITY_LOG.md)) with a `session-start` entry when you begin, `session-checkpoint` per platform completed, and `session-end` when you stop.

This file has two sections that say the same thing two ways:

1. **Agent procedure** — machine-runnable, what every LLM-driven QA pass executes
2. **Human runbook** — what a person opens on their laptop to do the same pass by hand

---

## Section 1 — Agent procedure

### Inputs

- **Platform** — one of `web`, `ios`, `android`, `macos`, `windows` (windows is deferred)
- **Scope** — `quick` (rows A–D only, ~10 min) or `full` (all rows, ~45 min)
- **Test user** — `qa-walkthrough-2026-05-12@mirrorfactory.ai` / `LayersQA2026!Walkthrough` (Supabase id `d0b8989a-4cc0-4fe0-aa22-61952f6da63b`, lives in the Audio Layer prod DB)
- **NTFY topic** — `layers-mf-08ebf1d1`

### Workflow

```
1. Read master PROD-501 to learn open findings + the platform's child issue.
2. Read the platform child's checklist (PROD-502/503/504/505).
3. Set up environment per platform (see "Environment setup" below).
4. For each row in the checklist:
     a. Drive the action (Maestro / adb / claude-in-chrome / osascript).
     b. Capture a screenshot to docs/evidence/YYYY-MM-DD-<slug>/<platform>-<row>.png
     c. Capture a short video if interaction matters (~10s, MP4).
     d. Read the screenshot. Judge:
          - Did the expected element render?
          - Are the colors / typography on-brand?
          - Is it a broken render (white page, default fonts, missing tokens)?
     e. Post a Linear comment on the platform child issue:
          - Row + status (✅ / ❌)
          - Screenshot path
          - Brand verdict (✓ on-brand / 🎨 off-brand / 🔴 broken)
          - One-line summary
     f. If failed AND it's a new bug, file kind:bug Linear issue with platform:* labels.
     g. If passed, tick the checkbox in the child issue body.
5. When all rows on the child are checked:
     a. Tick the child's checkbox on PROD-501.
     b. Append a session-checkpoint row to docs/ACTIVITY_LOG.md.
     c. Push NTFY notification to layers-mf-08ebf1d1.
6. Cleanup: leave evidence committed; videos local.
```

### Environment setup per platform

#### Web (`platform:web`)

- **Driver:** Claude-in-Chrome MCP — `mcp__claude-in-chrome__navigate`, `_tap`, `_get_page_text`, `_javascript_tool`, `_read_console_messages`, `_gif_creator`.
- **Base URL:** `https://layers.mirrorfactory.ai`
- **Auth cookie:** mint via `POST /auth/v1/token?grant_type=password` then set as `sb-psatqzrakxauktmzahfc-auth-token` (see `lib/supabase/user.ts` for cookie shape).
- **Brand check:** in the Chrome DevTools console, `getComputedStyle(document.body).backgroundColor` should be `oklch(0.982 0.012 168)` (paper). `font-family` should include `Inter`.
- **Video:** `mcp__claude-in-chrome__gif_creator` recording around the interaction.

#### iOS Capacitor (`platform:ios`)

- **Sim UDID:** `CD658077-5378-49B2-8A17-7068111DD447` (iPhone 16 Pro, iOS 18.3)
- **Boot:** `xcrun simctl boot <UDID> && open -a Simulator`
- **Build:** `pnpm cap:sync && xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Debug -destination "id=<UDID>" CODE_SIGNING_ALLOWED=NO build`
- **Install:** `xcrun simctl install booted /tmp/ios-build/Build/Products/Debug-iphonesimulator/App.app`
- **Driver:** Maestro CLI — `JAVA_HOME=/opt/homebrew/opt/openjdk@21 PATH=$JAVA_HOME/bin:$PATH maestro --device <UDID> test tests/maestro/<flow>.yml`
- **Pre-baked flows:**
  - `tests/maestro/ios-signin-test-user.yml` — sign-in
  - `tests/maestro/ios-authed-walk.yml` — /meetings, /chat, /settings, /profile
  - `tests/maestro/ios-record-meeting.yml` — recording flow (currently 🔴 PROD-500)
- **Screenshot:** `xcrun simctl io booted screenshot path.png`
- **Video:** `xcrun simctl io booted recordVideo --codec=h264 path.mp4` (SIGINT to stop)

#### Android Capacitor (`platform:android`)

- **AVD:** `LayersPixel` (Pixel 7, android-34 google_apis arm64-v8a)
- **Boot:** `JAVA_HOME=/opt/homebrew/opt/openjdk@21 ANDROID_HOME=/opt/homebrew/share/android-commandlinetools $ANDROID_HOME/emulator/emulator -avd LayersPixel -no-snapshot -no-boot-anim -gpu host &`
- **Wait for boot:** `until [ "$(adb shell getprop sys.boot_completed | tr -d '\r')" = "1" ]; do sleep 5; done`
- **Build:** `(cd android && ./gradlew :app:assembleDebug)` (needs JDK 21)
- **Install:** `adb install -r android/app/build/outputs/apk/debug/app-debug.apk`
- **Launch:** `adb shell am start -n com.mirrorfactory.layers/.MainActivity`
- **Driver:** `adb shell input tap X Y` / `input text "..."` / `input swipe x1 y1 x2 y2 duration`
- **Tap cheatsheet (Pixel 7, 1080×2400):**
  - Hamburger `(1000, 324)` · Theme toggle `(860, 324)`
  - Menu items: Meetings `(200, 500)`, Chat `(200, 615)`, Settings `(200, 725)`, Profile `(200, 840)`
  - Scroll one screen: `swipe 540 1800 540 400 300`
- **Screenshot:** `adb shell screencap -p > path.png`
- **Video:** `adb shell screenrecord --time-limit 30 /sdcard/out.mp4 && adb pull /sdcard/out.mp4 path.mp4`

#### macOS Electron (`platform:macos`)

- **Build:** `pnpm electron:pack` (unsigned-fast) or `pnpm electron:build` (signed DMG)
- **Path:** `dist-electron/mac-arm64/Layers.app` (Apple Silicon) or `mac/Layers.app` (Intel)
- **Launch:** `open dist-electron/mac-arm64/Layers.app`
- **Driver:** `osascript` + `cliclick` — requires **Accessibility permission** for the shell running Claude (System Settings → Privacy & Security → Accessibility → add Terminal).
- **Activate (when multiple apps share name):** `osascript -e 'tell application "/full/path/Layers.app" to activate'`
- **Screenshot whole screen:** `screencapture -x path.png`
- **Screenshot window:** find bounds via `osascript -e 'tell app "System Events" to tell process "Layers" to get {position, size} of front window'` then `screencapture -x -R x,y,w,h path.png`

#### Windows Electron (`platform:windows`)

Deferred — no host. See PROD-506.

### Brand-violation detection

After each screenshot, judge against `.ai-starter/manifests/design.json` tokens:

```
✓ on-brand   — uses Layers palette: violet/mint/blue gradients, paper bg,
                Inter font, rounded corners from token set, ink for text.
🎨 off-brand — default system fonts, plain white/black, no Layers accent
                colors. Likely a missing theme provider or unstyled state.
🔴 broken    — white-page-of-doom, "Something broke" boundary, blank
                WebView, missing CSS, JS error overlay.
```

A 🎨 verdict is a 🐛 to file. A 🔴 is a P1.

### Outputs the agent must produce

For every pass:

1. Linear comments on the platform child issue — one per row walked.
2. Screenshots committed to `docs/evidence/YYYY-MM-DD-<slug>/`.
3. `docs/ACTIVITY_LOG.md` `session-start`, `session-checkpoint` per platform, `session-end` entries with provider/model.
4. NTFY message to `layers-mf-08ebf1d1` titled `[QA <platform>] <N>/<total> rows pass`.
5. New `kind:bug` Linear tickets for every fail.

---

## Section 2 — Human runbook

For when you (a person) want to walk the suite by hand — no agent involved.

### 1. Pick a platform

Open Linear → search `QA: cross-platform smoke suite` → open PROD-501 master → click into the platform child you want to walk.

### 2. Set up

Use the platform-specific commands above. The shortest path:

- **Web:** open `https://layers.mirrorfactory.ai` in an Incognito Chrome window.
- **iOS:** open Simulator.app → boot iPhone 16 Pro → install Layers.app from `dist-electron/mac-arm64/` after running `pnpm cap:sync` + xcodebuild.
- **Android:** start `LayersPixel` AVD in Android Studio AVD Manager → install APK.
- **macOS:** `open dist-electron/mac-arm64/Layers.app`.

### 3. Walk the checklist

Top-down through the child issue's checkboxes. For each row:

1. Do the action (click, tap, navigate, type) on the live app.
2. Visually verify the expected outcome.
3. Look at the page — does it feel **Layers-branded**? (paper-calm bg, mint/violet accents, Inter type, rounded everything, calm spacing)
4. Cmd+Shift+4 (Mac) or screen capture tool — drop the screenshot somewhere.
5. Post a comment on the child issue: `Row X — ✅ / ❌ — [screenshot] — on-brand / off-brand / broken — note`.
6. Tick the checkbox.
7. If anything broke, click "Sub-issue" on the row's comment, file a `kind:bug` ticket with `platform:<x>` label.

### 4. Wrap up

When all rows ticked:

- Tick the platform's checkbox on PROD-501 (parent).
- Open `docs/ACTIVITY_LOG.md` and append a row stamping date / your name / "manual pass complete".
- Optional: post to NTFY `https://ntfy.sh/layers-mf-08ebf1d1` with the result.

### 5. Reference

- **Test user:** `qa-walkthrough-2026-05-12@mirrorfactory.ai` / `LayersQA2026!Walkthrough`
- **Brand tokens:** `.ai-starter/manifests/design.json` or `DESIGN.md`
- **Companion docs:**
  - `docs/CROSS_PLATFORM_QA.md` — the 80-row matrix
  - `docs/MOBILE_VISUAL_QA.md` — mobile-only legacy
  - `docs/ACTIVITY_LOG.md` — append-only log
  - `tests/maestro/*.yml` — iOS automation flows
- **Open bugs to keep in mind while walking:**
  - PROD-500 — recording crash on Stop (affects F5)
  - PROD-487 — anon sessions broke /sign-in (✅ shipped PR #80)
  - PROD-483 — migration apply gap (process)
  - PROD-482 — system dark-mode pref (brand call)
- **The 4 most common ways things break:**
  1. Auth state confusion (`getCurrentUserId` vs `getCurrentSignedInUserId` — see PROD-487)
  2. Public/authed nav split (PR #78)
  3. Capacitor `server.url` pin causing OAuth loops (Activity Log 2026-05-12 ~20:33)
  4. Missing prod migrations (PROD-483)
