# iOS Simulator QA Report — 2026-05-17

- **Worker:** Claude Opus 4.7 (1M context) — bounded iOS QA worker
- **Branch:** `release/external-tester-readiness-2026-05-17` (clean)
- **Date:** 2026-05-17
- **Sim:** iPhone 16 Pro (`CD658077-5378-49B2-8A17-7068111DD447`), iOS 18.3, Xcode 26.0.1
- **Bundle id:** `com.mirafactory.layers`
- **Layers app:** loads live `https://layers.mirrorfactory.ai`
- **Maestro:** 2.5.1 with `JAVA_HOME=/opt/homebrew/opt/openjdk@21`
- **Evidence folder:** `docs/evidence/2026-05-18-claude-cross-platform-qa/ios/`

> **Headline:** Build / install / launch all PASS, but I'm filing a **ship-blocker**: vertical scroll is broken in the iOS Capacitor shell — explicit upward swipes do not advance the page past the hero. The same URL scrolls correctly in Mobile Safari on the same simulator, isolating the cause to `ios.scrollEnabled: false` in the checked-in `capacitor.config.ts:25`. With scroll broken, every below-the-fold marketing surface (pricing, MCP section, footer) and every authed screen reachable by scroll is effectively unreachable. **Do not ship to TestFlight as currently configured.**

---

## 1. What was checked

Mapped against `docs/CROSS_PLATFORM_QA.md` categories.

| Cat. | Row(s) | Surface |
|------|--------|---------|
| A | A1 A2 A3 A4 A5 A6 | Build, install, launch, app-icon, Dynamic Island clearance, relaunch |
| B | B1 B5 B10 | TestingBanner clearance, type rendering, dark mode coverage |
| C | C1 C1a C2 C3 | Hamburger drawer (public-only labels), theme toggle + persistence, system-pref dark mode (PROD-482) |
| D | D1 D2 D3 D5 | Landing / Pricing / Sign-in / Download via Maestro |
| E | E1 (blocked) | Meetings list — gated by sign-in regression |
| F | F1 F3 F5 (blocked) | Recording flow — gated by sign-in regression |
| K | K1 K2 K6 | Safe-area Dynamic Island, home-indicator, status-bar contrast |
| native scroll | n/a (new finding) | Vertical scroll of WebView content |

## 2. Passed (with evidence)

| Check | Note | Evidence |
|---|---|---|
| **A1 Build** | `xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Debug -destination "id=<UDID>" CODE_SIGNING_ALLOWED=NO` → `** BUILD SUCCEEDED **`. No new warnings beyond known noise (CopySwiftLibs strip-bitcode note, AppIntents skip). | terminal log inline |
| **A2 Install** | `xcrun simctl install booted /tmp/layers-ios-dd/.../App.app` → 0 exit. | inline |
| **A3 Launch** | Cold launch via `simctl launch booted` rendered the hero within ~6s. | `ios-A3-launch.png` |
| **A6 Relaunch** | Maestro killApp → relaunch retained dark theme; initial frame after killApp took >6s (note caveat in §5). | `ios-walk-C2-relaunch.png`, `ios-A6-relaunch-after-extra-wait.png` |
| **B1 TestingBanner** | "WE'RE IN INVITE-ONLY ALPHA…" banner clears the Dynamic Island. Light text on dark band → status-bar icons remain readable. | every screenshot |
| **B5 Type fallback** | Renders Bricolage Grotesque (display) + Geist Sans (body) cleanly. Note: italic "Decisions that move work forward." is **sans-serif italic Bricolage Grotesque** (see `app/(public)/landing.tsx:60`), *not* a serif regression. The QA prompt's "no serif fonts" rule holds. | `ios-A3-launch.png` |
| **B10 Dark mode** | Toggling moon icon flips theme; mint accent, white text, near-black background — all tokens render. No fully-black panels. Live transcript card retains gradient backdrop. | `ios-walk-C2-post.png` |
| **C1 Public drawer** | Hamburger opens drawer, X closes. **Authed links correctly hidden** when signed out — only Download / Pricing / Sign in visible. | `ios-walk-D-drawer-public.png` |
| **C1a / C1b** | (Not exercisable — drawer-content check passes; sign-in redirect blocked by §3 regression.) | partial |
| **C2 Theme toggle + persistence** | `tapOn "Switch to dark mode"` flips theme; killApp + relaunch retains dark. | `ios-walk-C2-pre/post/relaunch.png` |
| **D1 Landing** | Loads hero, Recording-workspace card, Live-transcript snippet. | `ios-D1-landing.png` |
| **D2 Pricing** | Loads `Pay for the meeting memory you actually use.` headline + Core $20 card (most popular). Pro card below-fold but not scrollable (§3). | `ios-walk-D2-pricing.png` |
| **D3 Sign-in form** | Renders correctly: "Sign in to Layers", Google OAuth, email/password, mailto-support link, "Create an account →" link. | `ios-walk-D3-signin.png`, `ios-signin-empty-form.png` |
| **D5 Download** | Renders `DOWNLOAD LAYERS` page with "Wherever your meetings happen, Layers is quietly listening." + "RELEASE LINE" card "v0.1.120". | `ios-walk-D5-download-clean.png` |
| **K1 Dynamic Island clearance** | All public pages show TestingBanner content + nav clear of the island. | every screenshot |
| **K2 Bottom home-indicator** | No bottom-overlap observed on captured surfaces (visible home indicator clear of CTA strip). | `ios-D1-landing.png`, `ios-walk-D5-download-clean.png` |
| **K6 Status-bar contrast** | StatusBar plugin configured `style: LIGHT`; banner dark behind it → text legible. | every screenshot |

## 3. Failed / regressions

### 3.1 SHIP-BLOCKER — vertical scroll disabled on iOS

- **Symptom:** Three explicit upward swipes (`50%, 85%` → `50%, 15%`, 800 ms each) in the Capacitor app produced **zero** scroll movement. Hero stays anchored.
- **Comparison:** Same URL in Mobile Safari on the same booted sim scrolls normally — three identical swipes reveal "SEARCH THAT FINDS ANSWERS / Find the decision without reopening every transcript." content.
- **Root cause:** `ios.scrollEnabled: false` in `capacitor.config.ts:25` (mirrored into `ios/App/App/capacitor.config.json`). `scrollEnabled` controls `WKWebView.scrollView.isScrollEnabled`; setting it false disables both bounce *and* content scroll. The marketing site relies on native page-level scroll, not an internal scroll container.
- **Blast radius:** Every below-the-fold marketing surface is unreachable: Pro pricing card, FAQ, MCP section, footer with legal links (Privacy / Terms / Support). Equally affects every authed screen reached via scrolling once signed in.
- **Evidence:** `ios-scroll-after-manual-swipes.png` (Capacitor, post-swipes, still at top) vs `ios-safari-landing-scrolled.png` (Safari, post-swipes, well past hero).
- **Recommendation:** Flip `scrollEnabled` to `true` (or remove the key — default is true). Re-test the scroll matrix across landing/pricing/download/authed screens before TestFlight.

### 3.2 SHIP-BLOCKER (sign-in usability) — password field unreachable while soft keyboard is up

- **Symptom:** Running `tests/maestro/ios-signin-test-user.yml` succeeded for all command steps yet sign-in failed. The screenshot shows the **email field contains the concatenated password**: `…@mirrorfactory.aiLayersQA2026!Walkthrough`. The "Tap on Your password" command landed somewhere that did not transfer focus to the password input — the `inputText` then went into the still-focused email input.
- **Why this matters:** The `Keyboard` plugin is configured `resize: "body"` (`capacitor.config.ts:34`), so the soft keyboard overlays the form rather than resizing the layout. The password input sits below the email input — when the email keyboard is up, the password input is hidden behind it and the form does not auto-scroll to expose it.
- **Retry attempt:** Added `hideKeyboard` between fields — Maestro reported "Couldn't hide the keyboard. This can happen if the app uses a custom input or doesn't expose a standard dismiss action." — i.e. the WebView soft keyboard does not expose a dismiss accessor.
- **Blast radius:** Every iOS user attempting email/password sign-in (and presumably sign-up) on a real device will hit the same hidden-target problem. Google OAuth (PROD-408 already tracks the deep-link return) is the only working sign-in path, and even that is `❓` in the matrix.
- **Evidence:** `ios-signin-success.png.png` (filename retained as written by Maestro — concatenated credentials visible in email field), `ios-signin-keyboard-overlap-issue.png`.
- **Recommendation:** Either (a) switch `Keyboard.resize` to `"native"` or `"ionic"` so the layout resizes when the keyboard appears, or (b) wire the sign-in form to scroll the focused input into view (`element.scrollIntoView({ block: "center" })` on focus). Re-test the Maestro `ios-signin-test-user.yml` flow.

## 4. Blocked / skipped

| Area | Why blocked |
|---|---|
| **E1–E7** Meetings list, notes editor, chat, delete, waveform | Sign-in regression (§3.2) prevents reaching authed surfaces. |
| **F1–F5** Recording flow | Same — `/record` requires auth; `tests/maestro/ios-recording-flow.yml` would assert-fail on "Start recording". |
| **F-real-mic** AssemblyAI streaming over real microphone | iOS simulator has no real mic by default. Sim mic toggle would expose host Mac's mic; not enabled in this run. Per `docs/CROSS_PLATFORM_QA.md` and `docs/RECORDING_MANUAL_QA.md` this needs a physical device or `Simulator → Device → Microphone` toggle plus a signed-in session. **Real-mic recording on simulator is correctly marked blocked.** |
| **G2–G7** Ask / find / agent-builder | Auth-gated. |
| **H1–H6** Settings / account / billing | Auth-gated. Stripe checkout already `⏭` in matrix. |
| **I1 / I2** Google OAuth web + native deep-link | PROD-408 already tracks the native deep-link round-trip. Not re-walked. |
| **D6 Changelog / D7 Docs via menu** | Public drawer correctly does not surface these in the signed-out state. `tests/maestro/ios-public-walk-clean.yml` failed at "Tap on Changelog" — this is a **test-script staleness issue** vs the current product, not a regression. The menu intentionally surfaces only Download / Pricing / Sign in when signed out. Recommendation: update the test fixture. |
| **A4 App-icon home-screen render** | Would require home-screen screenshot via `simctl io booted screenshot` after `simctl ui booted appearance`, taken outside the app. Skipped — non-blocker, icon assets are wired and the launch sequence shows the splash. |

## 5. Notable observations (not pass / not fail)

- **A3 cold-paint timing:** Because the app loads the live `https://layers.mirrorfactory.ai`, cold-launch first-paint depends on the network. After `killApp` + relaunch the WebView returned a blank black frame for ~6 s before content rendered. Initial install + launch was ~6 s as well. This is within tolerance for development-via-WAN but worth noting if Apple Review uses a high-latency network — consider a bundled static fallback or splash with progress indicator.
- **C3 system-pref dark mode:** Setting `xcrun simctl ui booted appearance dark` had no effect on the in-app page — but as documented in PROD-482, the site intentionally ignores `prefers-color-scheme` on first load (brand calls for paper-calm-v1). Behavior matches the open product question, not a regression.
- **`scrollEnabled: false` rationale:** I did not find a comment justifying the flag. May have been added to suppress overscroll bounce; if so, the right fix is `disallowOverscroll: true` (a separate flag) rather than blanket `scrollEnabled: false`. Cross-check with whoever added the line before flipping.

## 6. Commands run (representative)

```bash
# Boot + verify
xcrun simctl boot CD658077-5378-49B2-8A17-7068111DD447
xcrun simctl list devices booted

# Build (Debug, no signing) — *did not* run pnpm cap:sync; tree was already in sync
xcodebuild -project ios/App/App.xcodeproj -scheme App \
  -configuration Debug -destination "id=CD658077-..." \
  CODE_SIGNING_ALLOWED=NO -derivedDataPath /tmp/layers-ios-dd build
# → ** BUILD SUCCEEDED **

# Install + launch
xcrun simctl install booted /tmp/layers-ios-dd/Build/Products/Debug-iphonesimulator/App.app
xcrun simctl launch booted com.mirafactory.layers
# → com.mirafactory.layers: 98759

# Public walk (host had android emulator-5554 running too — had to pin --device)
JAVA_HOME=/opt/homebrew/opt/openjdk@21 \
  maestro --device CD658077-... test tests/maestro/ios-public-walk-clean.yml
# → 5 of 6 nav targets passed; "Changelog" tap failed because that
#   link is intentionally not in the public drawer (test stale).

# Theme toggle + persistence
maestro --device CD658077-... test tests/maestro/ios-theme-toggle.yml
# → pre/post/relaunch screenshots captured; dark mode persists.

# Sign-in attempt
maestro --device CD658077-... test tests/maestro/ios-signin-test-user.yml
# → all steps "COMPLETED" but credentials concatenated in email field —
#   see §3.2.

# Scroll regression confirmation
maestro --device CD658077-... test /tmp/ios-scroll-check.yml  # zero scroll
xcrun simctl openurl booted "https://layers.mirrorfactory.ai/"
maestro --device CD658077-... test /tmp/ios-safari-scroll.yml # scrolls fine
```

Cleanup performed: `/tmp/layers-ios-dd` build derived-data and stale `~/.maestro/tests/` artifacts were removed because the volume hit "No space left on device" mid-session.

## 7. Evidence index

All files live in `docs/evidence/2026-05-18-claude-cross-platform-qa/ios/`.

| File | What it shows |
|---|---|
| `ios-A3-launch.png` | Cold launch — landing hero in light mode. |
| `ios-K1-launch-light.png` | Same after re-launch — Dynamic Island + banner clearance. |
| `ios-A6-relaunch-current.png` / `ios-A6-relaunch-after-extra-wait.png` | Black frame immediately after killApp → content paints ~6 s later. |
| `ios-B10-dark-system-landing.png` | `simctl ui appearance dark` shown in Safari — confirms PROD-482 (site ignores OS pref). |
| `ios-C2-light-mode-landing.png` | Light baseline. |
| `ios-D1-landing.png` | Landing without any chrome. |
| `ios-walk-D-drawer-public.png` | Public drawer — Download / Pricing / Sign in only. |
| `ios-walk-D2-pricing.png` | Pricing page above the (broken) fold. |
| `ios-walk-D3-signin.png` | Sign-in form, all elements render. |
| `ios-walk-D5-download-clean.png` | Download page renders RELEASE LINE block with v0.1.120 link. |
| `ios-walk-C2-pre.png` / `-post.png` / `-relaunch.png` | Theme toggle proof: light → dark → relaunch-still-dark. |
| `ios-c2-before.png` / `ios-c2-after-toggle-1.png` / `-2.png` | Earlier coordinate-based toggle attempt (failed before switching to `tapOn: "Switch to dark mode"`). |
| `ios-signin-empty-form.png` | Sign-in form (dark mode) before input. |
| `ios-signin-keyboard-overlap-issue.png` | Keyboard up, password input hidden behind it. |
| `ios-signin-success.png.png` | Misnamed by Maestro — actually post-submit, showing credentials concatenated into email field (§3.2 evidence). |
| `ios-scroll-after-manual-swipes.png` | Capacitor app after three deliberate upward swipes — still at top. |
| `ios-safari-landing-top.png` / `ios-safari-landing-scrolled.png` | Same URL in Mobile Safari — scrolls past hero. |
| `ios-rec-blocked-unauthed-landing.png` | Recording flow gate — fresh relaunch bounces to landing. |
| `ios-K2-footer-safe-area.png` | Attempted bottom-scroll — also stuck because of §3.1. |
| `maestro-public-walk/` (folder) | Per-step screenshots from `ios-public-walk-clean.yml` + Maestro log + failure screenshot. |
| `maestro-public-walk.xml`, `maestro-public-walk.log` | Maestro structured outputs. |
| `maestro-failure-open-menu.png` | Initial Maestro run (before pinning `--device`) — host had Android emulator-5554 booted, Maestro picked Android, failed. |

## 8. Release recommendation

**Do not promote to TestFlight or external testers as built.**

Two ship-blockers gate this build:

1. **§3.1 native scroll disabled** — users cannot see anything below the hero. This invalidates the entire below-the-fold UX on every page. Single-line config fix (`ios.scrollEnabled: true` in `capacitor.config.ts`) plus a re-walk.
2. **§3.2 sign-in password unreachable while keyboard is up** — email/password sign-in is functionally broken on iOS. Google OAuth path is not exercised in this run (PROD-408). Without either path, no iOS user can reach the authed product.

Once both are fixed:

- Re-run `tests/maestro/ios-public-walk-clean.yml` (and update it so the Changelog/Docs taps either route via `/changelog`/`/docs` directly or are removed).
- Re-run `tests/maestro/ios-signin-test-user.yml`. Capture proof that the password input is focusable / focuses correctly.
- Re-run `tests/maestro/ios-recording-flow.yml` with a signed-in session and the host Mac's microphone enabled in Simulator.
- Verify Cat-E (`/meetings`, `/meetings/[id]`, notes auto-save, per-meeting AI chat) and Cat-G (`/chat`, `/ask`, floating Ask pill) on the real authed session.
- Bump `CURRENT_PROJECT_VERSION` per `docs/NATIVE_RELEASE_READINESS.md` before archiving, and reconcile `PrivacyInfo.xcprivacy` against final App Privacy answers.

Until §3.1 and §3.2 are addressed and re-walked, the iOS build is **TestFlight-blocked**.
