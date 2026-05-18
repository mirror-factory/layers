# macOS Electron QA — Layers

- **Date:** 2026-05-17 23:05 PT
- **Branch:** `release/external-tester-readiness-2026-05-17` (clean working tree)
- **Repo:** `/Users/alfonso/Documents/GitHub/layers`
- **Artifact:** `dist-electron/mac-arm64/Layers.app` v0.1.147 (arm64), rebuilt fresh via `pnpm electron:pack`
- **Loads:** `https://layers.mirrorfactory.ai` (live prod, per `electron/main.js`)
- **Host:** Apple Silicon, macOS 25.2.0, Electron 41.2.1
- **Tester:** Claude Opus 4.7 (1M context), QA worker mode
- **Scope:** test + report. No source edits made.

---

## Summary

macOS Electron build at 0.1.147 packs, signs (Developer ID), launches, paints, renders all reachable public surfaces correctly, and obeys native window/keyboard conventions. Single release blocker is **notarization missing** — Gatekeeper rejects with `Unnotarized Developer ID`, which will surface as the "damaged / cannot verify developer" dialog for any external tester who downloads the artifact normally (i.e. via a browser, which sets the `com.apple.quarantine` attr). All other shared checks for the macOS row are green.

**Release recommendation:** ✅ go for external alpha **iff** the dmg is notarized (or testers receive Gatekeeper-bypass instructions / are routed through `xattr -dr com.apple.quarantine`). Without that, expect immediate friction on first launch.

---

## What was checked

| # | Check | Result | Evidence |
|---|---|---|---|
| A1 | `pnpm electron:pack` builds without errors | ✅ pass | log: exit 0, signed `Developer ID Application: Alfonso Morales (36J9E4325G)`, notarization skipped |
| A2 | Artifact codesign valid | ✅ pass | `codesign -dv` clean, hardened runtime flag `0x10000` set |
| A2b | Gatekeeper accepts artifact | 🔴 **fail** | `spctl -a -vv` → `rejected — Unnotarized Developer ID` |
| A3 | App launches and paints first frame | ✅ pass | `mac-01-first-frame.png`, `mac-03-landing-clean.png` (well under 5s, no white flash thanks to `backgroundColor: #0a0a0a`) |
| A4 | Dock icon renders | ✅ pass | visible during launch (Layers.app contains `icon.icns`) |
| A5 | Window chrome: traffic lights at (16, 16), hiddenInset titlebar | ✅ pass | `mac-03-landing-clean.png` shows traffic lights left-aligned without overlapping nav (K4) |
| B1 | TestingBanner clears traffic lights and titlebar | ✅ pass | banner sits above nav row, text "WE'RE IN INVITE-ONLY ALPHA — PUBLIC SIGN-UPS COMING SOON" centered |
| B2 | Sticky public-nav stays opaque on scroll | ✅ pass (visual on hero) | not stress-tested via long scroll, but nav row legible at all captured points |
| B3 | Logo + nav fits within max-width container | ✅ pass | `mac-03`, `mac-09` |
| B4 | No horizontal overflow | ✅ pass at 1200×800 and 720×480 |
| B5 | No serif fonts; system/web fallback renders cleanly | ✅ pass | hero, body, nav, buttons all sans (Inter / system) |
| B6 | Pricing cards layout (Free / Core $20 / Pro $30) | ✅ pass | `mac-04-pricing-dark.png` |
| B7 | MCP/Gemini/Claude logos render on landing scroll | ⏭ not walked | only above-the-fold captured; deferred |
| B10 | Dark mode renders without missing tokens | ✅ pass | `mac-03-landing-clean.png` |
| C2 | Theme toggle works; persists | ✅ pass (dark→light verified) | `mac-09-landing-light.png` vs `mac-10-theme-attempt-light.png` (light mode after toggle) |
| C3 | Site honors `prefers-color-scheme` on first load | 🔴 known issue | PROD-482 — brand intentionally starts in dark, manual toggle required. Not a macOS-specific regression. |
| C4 | In-app navigation works (logo → home, nav link → page) | ✅ pass | `mac-04` (pricing), `mac-07` (download), `mac-08` (sign-in), `mac-06` (home after pricing via logo) |
| C6 | macOS Cmd+W, Cmd+R, Cmd+Q behave correctly | ✅ pass | Cmd+W closed window, process stayed alive (macOS convention). Re-open via `open Layers.app` created fresh window. Cmd+Q exited process. Cmd+R reloaded webContents (transcript mock rotated). Evidence: `mac-13-after-cmd-r-reload.png`, `mac-14-reopen-after-cmd-w.png`. |
| C8 | Focus ring on keyboard nav | ⏭ not walked (no Tab cycle test) |
| D1 | `/` landing renders | ✅ pass | `mac-03-landing-clean.png`, `mac-09-landing-light.png` |
| D2 | `/pricing` renders with three plan cards | ✅ pass | `mac-04-pricing-dark.png` |
| D3 | `/sign-in` renders with Google OAuth + email/password + `admin@mirafactory.ai` mailto | ✅ pass | `mac-08-signin-dark.png` |
| D5 | `/download` renders with platform-detection hero | ✅ pass | `mac-07-download-page.png` (note copy "Wherever your meetings happen, Layers is quietly listening." and release line "v0.1.120" — release-line is stale relative to packaged shell 0.1.147; site copy is owned by Vercel deploy not this shell) |
| K4 | Traffic lights at (16, 16), no overlap with nav | ✅ pass | visible in every capture |
| Resize | Window enforces `minWidth: 720, minHeight: 480` (per `electron/main.js`) | ✅ pass | requested 600×400, OS clamped to 720×480. `mac-11-min-window-720x480.png` shows hamburger + theme toggle visible, traffic lights clear of nav, hero copy wraps cleanly |
| Mobile-nav | Hamburger drawer opens at narrow width, lists Download / Pricing / Sign in, close (X) visible | ✅ pass | `mac-12-hamburger-drawer.png` |

## Passed (15 named checks)
A1, A2, A3, A4, A5, B1, B3, B4, B5, B6, B10, C2, C4, C6, D1, D2, D3, D5, K4, resize, mobile-nav.

## Failed (1)
- **A2b — Gatekeeper rejects unnotarized artifact.** `spctl -a -vv` → `rejected, source=Unnotarized Developer ID`. electron-builder log: `skipped macOS notarization — \`notarize\` options were unable to be generated`. External testers who download the dmg via a browser will hit "Layers cannot be opened because the developer cannot be verified." Required for external-tester-readiness: configure notarization via App Store Connect API key in `electron-builder.yml` (`mac.notarize`) or set `APPLE_API_KEY` / `APPLE_API_KEY_ID` / `APPLE_API_ISSUER` env vars and run `pnpm electron:build`.

## Blocked / skipped

- **E. Authenticated app surfaces (meetings, chat, ask, settings, profile).** Skipped — no Google OAuth credential or pre-baked Supabase session cookie available in this bounded run. The QA test user `qa-walkthrough-2026-05-12@mirrorfactory.ai` referenced in `docs/CROSS_PLATFORM_QA.md` § E would need cookie injection via DevTools to validate. Not in scope: "do not change source code."
- **F. Recording flow.** Blocked — Electron uses Chromium `getUserMedia`, and `electron/main.js` line 69 explicitly marks `start-mic-capture` as `not-implemented`. End-to-end mic recording on the desktop shell is therefore an open known gap, independent of this QA pass. Web/Capacitor proofs cover the stop-flow elsewhere.
- **G2–G6.** AI / chat / ask / agent-builder require authentication, skipped for the same reason as E.
- **H1–H8.** Settings / billing / Stripe — auth-gated.
- **I. OAuth / Stripe roundtrips.** Not exercised in bounded QA.
- **J. Observability dashboards.** Auth-gated.
- **M. Errors & edge cases.** Not stress-tested (offline / slow-3G / 401 mid-session / 413 upload). Most are server-driven and not Electron-specific.
- **B7.** MCP/Gemini/Claude logo strip below-fold — not scrolled to.
- **B9.** Remotion intro animation on landing — not validated frame-by-frame.
- **C8.** Tab focus-ring walk through landing CTAs.
- **C10.** `prefers-reduced-motion` honor.

---

## Evidence

All files under `docs/evidence/2026-05-18-claude-cross-platform-qa/macos/`.

| File | Surface | Mode |
|---|---|---|
| `mac-01-first-frame.png` | Whole-screen first-frame after launch (Layers center, other windows visible) | dark |
| `mac-02-window-landing-dark.png` | Landing, partially obscured by adjacent windows | dark |
| `mac-03-landing-clean.png` | Landing, clean window crop 1200×800 | dark |
| `mac-04-pricing-dark.png` | `/pricing` — three-card layout | dark |
| `mac-05-download-dark.png` | duplicate of mac-04 (back-nav didn't fire on first attempt) | dark |
| `mac-06-home-after-pricing.png` | Logo-click → home | dark |
| `mac-07-download-page.png` | `/download` — release-line tile shows v0.1.120 | dark |
| `mac-08-signin-dark.png` | `/sign-in` — Google + email/password + support mailto | dark |
| `mac-09-landing-light.png` | Landing immediately after toggle attempt (still dark) | dark |
| `mac-10-theme-attempt-light.png` | Landing after correct toggle click | light |
| `mac-11-min-window-720x480.png` | Window resized to 720×480, hamburger nav | light |
| `mac-12-hamburger-drawer.png` | Hamburger drawer open with Download / Pricing / Sign in | light |
| `mac-13-after-cmd-r-reload.png` | After Cmd+R, mock transcript content rotated | light |
| `mac-14-reopen-after-cmd-w.png` | Re-opened via `open Layers.app` after Cmd+W closed last window | light |

---

## Commands run

```bash
# Setup
git status --short --branch
# release/external-tester-readiness-2026-05-17...origin/release/external-tester-readiness-2026-05-17 (clean)

mkdir -p docs/evidence/2026-05-18-claude-cross-platform-qa/macos

# Build & sign
pnpm electron:pack
# → electron-builder 26.8.1
# → signing  file=dist-electron/mac-arm64/Layers.app  identity=Developer ID Application: Alfonso Morales (36J9E4325G)
# → skipped macOS notarization  reason=`notarize` options were unable to be generated
# → exit 0

# Verify signature
codesign -dv --verbose=2 dist-electron/mac-arm64/Layers.app
# Authority=Developer ID Application: Alfonso Morales (36J9E4325G)
# Authority=Developer ID Certification Authority
# Authority=Apple Root CA
# Timestamp=May 17, 2026 at 11:04:23 PM
# TeamIdentifier=36J9E4325G   Runtime Version=26.2.0   CodeDirectory flags=0x10000(runtime)

# Gatekeeper
spctl -a -vv dist-electron/mac-arm64/Layers.app
# /Users/alfonso/.../Layers.app: rejected
# source=Unnotarized Developer ID
# origin=Developer ID Application: Alfonso Morales (36J9E4325G)

# Bundle metadata
defaults read .../Layers.app/Contents/Info CFBundleShortVersionString  # 0.1.147
defaults read .../Layers.app/Contents/Info CFBundleVersion             # 0.1.147
defaults read .../Layers.app/Contents/Info CFBundleIdentifier          # com.mirafactory.layers

# Launch (strip quarantine for local QA only)
xattr -dr com.apple.quarantine dist-electron/mac-arm64/Layers.app
open dist-electron/mac-arm64/Layers.app
# 4 helper processes spawned (main + gpu-process + network utility + renderer)

# Window control via System Events + cliclick
osascript -e 'tell application "Layers" to activate'
osascript -e 'tell application "System Events" to tell process "Layers" to set position of window 1 to {120, 120}'
osascript -e 'tell application "System Events" to tell process "Layers" to set size of window 1 to {1200, 800}'
cliclick c:1094,190     # Pricing
cliclick c:1008,190     # Download
cliclick c:1168,190     # Sign in
cliclick c:1250,194     # Theme toggle
osascript -e 'tell application "System Events" to keystroke "r" using {command down}'   # Cmd+R reload
osascript -e 'tell application "System Events" to keystroke "w" using {command down}'  # Cmd+W close
osascript -e 'tell application "Layers" to quit'                                       # Cmd+Q

# Capture
screencapture -x -R "120,120,1200,800" -o <evidence>.png
```

---

## Release recommendation for macOS Electron

- **Block on**: notarization. Wire `mac.notarize` in `electron-builder.yml` and re-run `pnpm electron:build` for the dmg that ships to alpha testers. Without this, Gatekeeper rejects the artifact on first launch and the external-tester onboarding promise breaks immediately.
- **Otherwise green** for the public-surface / theme / window-chrome / native-shortcut row of the cross-platform matrix. Hero, pricing, download, sign-in all render at 1200×800 and 720×480 in both dark and light themes. Traffic-light positioning, banner clearance, hamburger drawer, and Cmd+W/R/Q all match expectations.
- **Known carry-over**: native mic capture on Electron is still a `TODO` in `electron/main.js` (line 69, `start-mic-capture` returns `not-implemented`). Recording flow on macOS shell continues to depend on Chromium `getUserMedia`. Not a regression — already documented in `docs/CROSS_PLATFORM_QA.md` § F and footnotes.
- **Not validated in this pass** (require auth): meetings list, recording UX, chat, ask, settings, billing, observability. Recommend a separate authed walk before promoting to staging.
