# Cross-Platform QA Checklist

> Walked by a tester (or sim-driving agent) before every push that ships changes to public marketing surfaces, the authed app, the Capacitor shells, the Electron shell, or shared layout/theme.
>
> Companion to [`RECORDING_MANUAL_QA.md`](./RECORDING_MANUAL_QA.md) — that doc covers the **in-app recording UX in depth** (24-row × 5-device matrix for mic permissions, AssemblyAI streaming, autosave, etc.). This doc is **wider but shallower**: it covers every public + authed surface across **all five platforms** (iOS, Android, macOS, Windows, Web) so that a single pre-push pass surfaces visual + functional regressions wherever they appear.

## Platforms

| Code | Platform | Build | Bundle ID | Loads |
|------|----------|-------|-----------|-------|
| `ios` | Capacitor iOS WebView | Xcode + `pnpm cap:sync` | `com.mirafactory.layers` | live `layers.mirrorfactory.ai` |
| `and` | Capacitor Android WebView | `(cd android && ./gradlew :app:assembleDebug)` | `com.mirafactory.layers` | live `layers.mirrorfactory.ai` |
| `mac` | Electron (macOS) | `pnpm electron:pack` | `com.mirafactory.layers` | live URL (prod) / `localhost:3000` (dev) |
| `win` | Electron (Windows NSIS) | `pnpm electron:build` w/ Windows runner | same | same |
| `web` | Vercel + Chrome / Safari / Firefox | `pnpm build` | n/a | self-hosted |

Cell legend in the matrix below:

- `✓` — applies on this platform, walk it
- `⏭` — n/a (feature doesn't exist on this platform)
- `❓` — applies but not yet tested
- `🔴` — known bug, linked to Linear / PR
- `🟢` — last walk passed

## Evidence layout

Per session: `docs/evidence/YYYY-MM-DD-<slug>/`

- **Screenshots** — `{platform}-{category}-{row}-{slug}.png`. Example: `mac-ui-01-hero.png`, `ios-rec-03-mic-denied.png`.
- **Videos** — kept local (`docs/evidence/**/*.mp4` is gitignored). Attach to Linear tickets.
- **Linear tickets** — `kind:bug` for unfixed findings. Tag every platform that reproduces:
  - `platform:ios` `platform:android` `platform:macos` `platform:windows` `platform:web`
  - `owner:human` (brand/copy/legal decision) or `owner:agent` (implementation fix)
- **PRs** — body has `## Evidence` linking to specific files; next-session PR adds post-fix pair.

## Sim / runtime setup

### iOS (`ios`)
- Sim UDID: `CD658077-5378-49B2-8A17-7068111DD447` (iPhone 16 Pro, iOS 18.3)
- `xcrun simctl boot <UDID> && open -a Simulator`
- `pnpm cap:sync` regenerates `ios/App/App.xcodeproj`
- Build: `xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Debug -destination "id=<UDID>" CODE_SIGNING_ALLOWED=NO build`
- Install: `xcrun simctl install booted <path/to/App.app>`
- Launch: `xcrun simctl launch booted com.mirafactory.layers`
- Screenshot: `xcrun simctl io booted screenshot path.png`
- Video: `xcrun simctl io booted recordVideo --codec=h264 path.mp4` (SIGINT to stop)

### Android (`and`)
- AVD: `LayersPixel` (Pixel 7, system-image `android-34;google_apis;arm64-v8a`)
- Boot: `nohup $ANDROID_HOME/emulator/emulator -avd LayersPixel -no-snapshot -no-boot-anim -gpu host > /tmp/emu.log 2>&1 &`
- Wait: poll `adb shell getprop sys.boot_completed` until `1`
- Build: `(cd android && JAVA_HOME=/opt/homebrew/opt/openjdk@21 ./gradlew :app:assembleDebug)`
- Install: `adb install -r android/app/build/outputs/apk/debug/app-debug.apk`
- Launch: `adb shell am start -n com.mirafactory.layers/.MainActivity`
- Screenshot: `adb shell screencap -p > path.png`
- Video: `adb shell screenrecord --time-limit 30 /sdcard/out.mp4 && adb pull /sdcard/out.mp4 path.mp4`

### macOS Electron (`mac`)
- Build: `pnpm electron:pack` (unsigned dev, fast). For signed dmg: `pnpm electron:build`
- Launch: `open dist-electron/mac-arm64/Layers.app` (Apple Silicon) or `mac/Layers.app` (Intel)
- Dev mode (hot reload from localhost): `pnpm electron:dev` (requires `pnpm dev` running in another shell)
- Screenshot: `screencapture -x path.png` (whole screen) or window-only via `screencapture -l <window-id>` (find id via `osascript -e 'tell app "Layers" to id of window 1'`)

### Tap-coordinate cheatsheet (Pixel 7 emulator, 1080×2400)
- Hamburger: `(1000, 324)`
- Theme toggle: `(860, 324)`
- Menu items when drawer open: Download `(200, 475)`, Pricing `(200, 682)`, Sign in `(200, 861)`
- Scroll one screen up: `adb shell input swipe 540 1800 540 400 300`

iOS sim does **not** support tap via `simctl`. Use `xcrun simctl openurl booted "https://layers.mirrorfactory.ai/<route>"` for direct navigation — opens Mobile Safari (same WebKit as Capacitor, useful for visual parity).

---

# Categories

## A. Build, install, launch

Catches showstoppers before any visual walk.

| # | Check | ios | and | mac | win | web |
|---|-------|-----|-----|-----|-----|-----|
| A1 | Build succeeds with no warnings beyond the known whitelist | ✓ | ✓ | ✓ | ✓ | ✓ |
| A2 | Install onto sim / emulator / Applications folder works | ✓ | ✓ | ✓ | ✓ | ⏭ |
| A3 | App launches; first frame visible within 5s | ✓ | ✓ | ✓ | ✓ | ✓ |
| A4 | App icon renders correctly on home screen / dock | ✓ | ✓ | ✓ | ✓ | ⏭ |
| A5 | Window/scene chrome correct (Dynamic Island clearance, traffic lights, status bar) | ✓ | ✓ | ✓ | ✓ | ⏭ |
| A6 | App relaunches after crash without state loss | ✓ | ✓ | ✓ | ✓ | ⏭ |

## B. UI — visual layout & typography

Wherever any of these breaks: file `platform:<x>` ticket with pre-fix screenshot.

| # | Check | ios | and | mac | win | web |
|---|-------|-----|-----|-----|-----|-----|
| B1 | TestingBanner ("WE'RE IN INVITE-ONLY ALPHA…") clears notch / status bar / title bar | 🟢 PR#69 | 🟢 native | ❓ | ❓ | 🟢 |
| B2 | Sticky public-nav stays opaque on scroll; no bold-headline bleed-through | 🟢 PR#73 | 🟢 PR#73 | ❓ | ❓ | 🟢 |
| B3 | Logo + nav fits inside max-w-[1180px] container at every breakpoint | ✓ | ✓ | ✓ | ✓ | ✓ |
| B4 | No horizontal overflow / scrollbar on landing | ✓ | ✓ | ✓ | ✓ | ✓ |
| B5 | Type renders with system font fallbacks (no FOUT visible > 200ms) | ✓ | ✓ | ✓ | ✓ | ✓ |
| B6 | Pricing cards align: $20 Core left, $30 Pro right (or stacked on narrow) | ✓ | ✓ | ✓ | ✓ | ✓ |
| B7 | MCP/Gemini/Claude logos render (no broken-image alt) | ✓ | ✓ | ✓ | ✓ | ✓ |
| B8 | Footer links wrap cleanly; no text overflow | ✓ | ✓ | ✓ | ✓ | ✓ |
| B9 | Animations: Remotion intro and section reveals don't jank on first paint | ❓ | ❓ | ❓ | ❓ | ✓ |
| B10 | Dark mode renders complete (no missing color tokens, no fully-black or white panels) | ❓ | ✓ | ❓ | ❓ | ✓ |

## C. UX — navigation, gestures, keyboard, a11y

| # | Check | ios | and | mac | win | web |
|---|-------|-----|-----|-----|-----|-----|
| C1 | Hamburger opens drawer; X closes it; nav items tappable | ⏭ | 🟢 verified | ⏭ | ⏭ | ✓ |
| C1a | Hamburger menu shows AUTHED links when signed in (Meetings/Chat/Settings/Profile) | ⏭ | 🟢 PR#78 | ⏭ | ⏭ | ✓ PR#78 |
| C1b | `/sign-in` and `/sign-up` redirect to `/record` when already signed in | ⏭ | 🟢 PR#78 | ⏭ | ⏭ | ✓ PR#78 |
| C2 | Theme toggle (sun/moon) switches html class; persists across reload | ✓ | ✓ | ✓ | ✓ | ✓ |
| C3 | Site honors system `prefers-color-scheme` on first load | 🔴 PROD-482 | 🔴 PROD-482 | 🔴 PROD-482 | 🔴 PROD-482 | 🔴 PROD-482 |
| C4 | Browser back / swipe-back works inside the Capacitor / Electron shell | ✓ | ✓ | ✓ | ✓ | ✓ |
| C5 | Hardware back on Android exits app from landing (no infinite loop) | ⏭ | ✓ | ⏭ | ⏭ | ⏭ |
| C6 | macOS Cmd+W / Cmd+R / Cmd+Q behave normally | ⏭ | ⏭ | ✓ | ⏭ | ⏭ |
| C7 | Windows Alt+F4 / Ctrl+R / Ctrl+Shift+I (devtools) | ⏭ | ⏭ | ⏭ | ✓ | ⏭ |
| C8 | Focus ring visible on keyboard nav (Tab through landing CTAs) | ⏭ | ⏭ | ✓ | ✓ | ✓ |
| C9 | Screen-reader: page has `<h1>`; nav has `aria-label="Primary navigation"`; sign-in form fields labelled | ✓ | ✓ | ✓ | ✓ | ✓ |
| C10 | Reduced-motion: animations honor `prefers-reduced-motion: reduce` | ❓ | ❓ | ❓ | ❓ | ❓ |

## D. Public marketing surfaces

| # | Route | ios | and | mac | win | web |
|---|-------|-----|-----|-----|-----|-----|
| D1 | `/` landing — hero, AI memory section, search section, MCP section, pricing, CTA, footer | ✓ | ✓ | ❓ | ❓ | ✓ |
| D2 | `/pricing` — Core $20 + Pro $30 + FAQ | ✓ | ✓ | ❓ | ❓ | ✓ |
| D3 | `/sign-in` — Google OAuth button + email/password + footnote points to `admin@mirafactory.ai` | ✓ PR#74 | ✓ PR#74 | ❓ | ❓ | ✓ |
| D4 | `/sign-up` — email entry + verification flow | ❓ | ❓ | ❓ | ❓ | ❓ |
| D5 | `/download` — platform-detection card shows correct OS download | ✓ | ✓ | ❓ | ❓ | ✓ |
| D6 | `/changelog` — newest release at top; release type labels render | ✓ | ❓ | ❓ | ❓ | ✓ |
| D7 | `/docs` — TOC links render, no overflow | ✓ | ❓ | ❓ | ❓ | ✓ |
| D8 | `/docs/mcp` — quickstart for Claude Desktop / Cursor / Continue / ChatGPT | ❓ | ❓ | ❓ | ❓ | ❓ |
| D9 | `/docs/api` — REST endpoints documented; code snippets readable | ❓ | ❓ | ❓ | ❓ | ❓ |
| D10 | `/privacy` — full policy renders; support email correct | ❓ | ❓ | ❓ | ❓ | ❓ |
| D11 | `/terms` — full ToS renders; support email correct | ❓ | ❓ | ❓ | ❓ | ❓ |
| D12 | `/account-deletion` — instructions render; mailto link works | ❓ | ❓ | ❓ | ❓ | ❓ |
| D13 | `/roadmap` — public roadmap board | ❓ | ❓ | ❓ | ❓ | ❓ |

## E. Authenticated app — meetings & recording

Test user `qa-walkthrough-2026-05-12@mirrorfactory.ai` (`d0b8989a-…`) was minted via Supabase MCP on 2026-05-12 — created directly in `auth.users` (the gotrue `Scan error on column "confirmation_token": converting NULL to string is unsupported` gotcha required `COALESCE(... , '')` on all token columns). Cookie name: `sb-psatqzrakxauktmzahfc-auth-token`; build from `/auth/v1/token?grant_type=password` response with `base64-` prefix.

| # | Surface | ios | and | mac | win | web |
|---|---------|-----|-----|-----|-----|-----|
| E1 | `/meetings` list — empty state renders ("No meetings yet", New recording CTA, search bar, stats 0/0/0); floating Ask pill visible | ❓ | 🟢 verified | ❓ | ❓ | 🟢 200 |
| E2 | `/meetings/[id]` — not walked (test user has no meetings yet) | ❓ | ❓ | ❓ | ❓ | ❓ |
| E3 | Meeting notes editor auto-saves (1 s debounce) | ❓ | ❓ | ❓ | ❓ | ❓ |
| E4 | Meeting chat (per-meeting AI) streams responses | ❓ | ❓ | ❓ | ❓ | ❓ |
| E5 | Push notes to external tool (Linear / Notion / Slack) | ❓ | ❓ | ❓ | ❓ | ❓ |
| E6 | Delete meeting — confirmation prompt, soft-delete | ❓ | ❓ | ❓ | ❓ | ❓ |
| E7 | Audio waveform renders; click-to-seek works | ❓ | ❓ | ❓ | ❓ | ❓ |

## F. Recording flow

(Companion to `RECORDING_MANUAL_QA.md` — that doc has 24 rows × 5 devices. The rows below are the headline checks only; defer details to the companion.)

| # | Check | ios | and | mac | win | web |
|---|-------|-----|-----|-----|-----|-----|
| F1 | Preflight: requesting mic permission shows correct copy ("Layers needs your microphone to record meetings and transcribe what's said.") | ❓ | ❓ | ❓ | ❓ | ❓ |
| F2 | Permission denied path: clear error + link to Settings on each OS | ❓ | ❓ | ❓ | ❓ | ❓ |
| F3 | Live recording: transcript appears within 3 s; speaker labels populate | ❓ | ❓ | ❓ | ❓ | ❓ |
| F4 | Autosave on every chunk so a crash mid-recording doesn't lose audio | ❓ | ❓ | ❓ | ❓ | ❓ |
| F5 | Stop → processing → completed; redirect to `/meetings/[id]` | ❓ | ❓ | ❓ | ❓ | ❓ |
| F6 | Upload existing audio file → polling → transcript appears | ❓ | ❓ | ❓ | ❓ | ❓ |
| F7 | Multi-tab: lagging tab does not clobber leader's draft (PROD-475 regression) | ⏭ | ⏭ | ⏭ | ⏭ | ❓ |
| F8 | Local notification fires when scheduled reminder time hits | ❓ | ❓ | ❓ | ❓ | ⏭ |

## G. AI / chat / ask / MCP

| # | Surface | ios | and | mac | win | web |
|---|---------|-----|-----|-----|-----|-----|
| G1 | `/chat` — page returns 200; streaming not walked | ❓ | ❓ | ❓ | ❓ | 🟢 200 |
| G2 | `/ask` — "ask" mode returns RAG-grounded answer with sources | ❓ | ❓ | ❓ | ❓ | ❓ |
| G3 | `/ask` — "find" mode returns raw chunks with similarity scores + chunk-type filter | ❓ | ❓ | ❓ | ❓ | ❓ |
| G4 | Floating Ask pill (Cmd+K) opens sheet from anywhere; submits without losing scroll | ❓ | ❓ | ❓ | ❓ | ❓ |
| G5 | `/search` — page returns 200; suggested queries not walked | ❓ | ❓ | ❓ | ❓ | 🟢 200 |
| G6 | `/agent-builder` — UI loads; tool selection persists | ❓ | ❓ | ❓ | ❓ | ❓ |
| G7 | MCP server: `/api/mcp/mcp` responds 200 to `initialize` request with `Authorization: Bearer <PAT>` | ✓ | ✓ | ✓ | ✓ | ✓ |

## H. Settings / account / billing

| # | Surface | ios | and | mac | win | web |
|---|---------|-----|-----|-----|-----|-----|
| H1 | `/settings` — page returns 200; dropdown persistence not walked | ❓ | ❓ | ❓ | ❓ | 🟢 200 |
| H2 | `/settings/integrations` — list OAuth clients; revoke prompts confirm | ❓ | ❓ | ❓ | ❓ | 🟢 `/api/account/oauth-clients` 200 (empty for new user) |
| H3 | `/settings/integrations` — mint new PAT shows full key once; partial mask after | ❓ | ❓ | ❓ | ❓ | 🟢 `/api/account/api-keys` 200 (empty for new user) |
| H4 | `/settings/recipes` — CRUD; recipe rules persist | ❓ | ❓ | ❓ | ❓ | 🟢 `/api/account/recipes` 200 with 5 seeded starters (post-PROD-483) |
| H5 | Recording reminder schedule fires local notification | ❓ | ❓ | ❓ | ❓ | ⏭ |
| H6 | `/profile` — email, plan, sign out, account deletion | ❓ | ❓ | ❓ | ❓ | 🟢 200 |
| H7 | `/admin/pricing` (admin only) — pricing config + activate version | ⏭ | ⏭ | ⏭ | ⏭ | ❓ |
| H8 | Stripe checkout: hosted page loads; test card succeeds; webhook updates plan | ⏭ | ⏭ | ⏭ | ⏭ | ❓ |

## I. Integrations / OAuth

| # | Check | ios | and | mac | win | web |
|---|-------|-----|-----|-----|-----|-----|
| I1 | Google OAuth — web flow: redirect → consent → callback → signed in | ⏭ | ⏭ | ⏭ | ⏭ | ❓ |
| I2 | Google OAuth — native deep-link: in-app browser opens, `com.mirafactory.layers://auth/callback?...` returns to Layers app | ❓ PROD-408 | ❓ PROD-408 | ⏭ | ⏭ | ⏭ |
| I3 | Google Calendar connect → upcoming events show on dashboard | ❓ | ❓ | ❓ | ❓ | ❓ |
| I4 | Calendar disconnect — provider removed, no orphaned events | ❓ | ❓ | ❓ | ❓ | ❓ |
| I5 | MCP OAuth: external client (Claude Desktop) completes register → authorize → token → tool call | ⏭ | ⏭ | ✓ | ❓ | ⏭ |
| I6 | Stripe webhook updates user's plan within 10s of checkout success | ⏭ | ⏭ | ⏭ | ⏭ | ❓ |

## J. Observability / admin

| # | Surface | ios | and | mac | win | web |
|---|---------|-----|-----|-----|-----|-----|
| J1 | `/observability` — AI Calls log table loads | ⏭ | ⏭ | ❓ | ❓ | 🟢 200 |
| J2 | `/observability` — Errors panel surfaces stack traces | ⏭ | ⏭ | ❓ | ❓ | ❓ |
| J3 | `/observability` — Charts (cost/day, TTFT histogram) render | ⏭ | ⏭ | ❓ | ❓ | ❓ |
| J4 | `/usage` — page returns 200; tile values not verified | ❓ | ❓ | ❓ | ❓ | 🟢 200 |
| J5 | `/dev-kit` dashboards (status, overview, regressions, etc.) load without 5xx | ⏭ | ⏭ | ❓ | ❓ | ❓ |
| J6 | `/api/observability/health` returns sink status | — | — | — | — | 🟢 200 (stdout + langfuse configured) |
| J7 | `/api/observability/watchlist` returns alert-condition evaluation | — | — | — | — | 🟢 200 (4 conditions passing) |

## K. Native platform behaviors

| # | Check | ios | and | mac | win | web |
|---|-------|-----|-----|-----|-----|-----|
| K1 | iOS Dynamic Island clearance on every public page (banner + content) | ✓ PR#69 | ⏭ | ⏭ | ⏭ | ⏭ |
| K2 | iOS safe-area-inset-bottom respected (home indicator clearance on input bars) | ✓ | ⏭ | ⏭ | ⏭ | ⏭ |
| K3 | Android display cutouts (camera punch-hole) don't obscure content | ⏭ | ✓ | ⏭ | ⏭ | ⏭ |
| K4 | macOS traffic lights at correct position (16, 16) without overlapping nav | ⏭ | ⏭ | ❓ | ⏭ | ⏭ |
| K5 | Windows window controls (min/max/close) standard chrome | ⏭ | ⏭ | ⏭ | ❓ | ⏭ |
| K6 | Status bar text color (light on dark banner) readable on iOS | ✓ | ⏭ | ⏭ | ⏭ | ⏭ |
| K7 | App stays in foreground during long recording (>30 min) without OS killing it | ❓ | ❓ | ❓ | ❓ | ⏭ |
| K8 | Microphone access prompt fires only when user taps "Start Recording" (not on app open) | ❓ | ❓ | ❓ | ❓ | ❓ |
| K9 | Local notifications respect Do Not Disturb on each OS | ❓ | ❓ | ❓ | ❓ | ⏭ |

## L. Cron / background

| # | Check | ios | and | mac | win | web |
|---|-------|-----|-----|-----|-----|-----|
| L1 | `/api/cron/onboarding-emails` returns 200 with `Authorization: Bearer $CRON_SECRET` | server-only | server-only | server-only | server-only | server-only |
| L2 | `/api/cron/watchlist-tick` returns 200; no schema-export error on `pnpm build` | server-only PR#70 | — | — | — | — |
| L3 | `pnpm build` exits 0 on every push (deploy-blocker tripwire) | — | — | — | — | ✓ PR#70 |
| L4 | Numbered migrations under `supabase/migrations/` are actually applied to prod (caught 4 missing this run) | — | — | — | — | 🔴 PROD-483 |

## M. Errors & edge cases

| # | Check | ios | and | mac | win | web |
|---|-------|-----|-----|-----|-----|-----|
| M1 | Airplane mode / offline: clear "no connection" UI; no infinite spinner | ❓ | ❓ | ❓ | ❓ | ❓ |
| M2 | Slow 3G (Chrome DevTools throttle): first paint < 3 s, hero CTA usable | ⏭ | ⏭ | ⏭ | ⏭ | ❓ |
| M3 | Auth expired mid-session — 401 redirects to `/sign-in` cleanly | ❓ | ❓ | ❓ | ❓ | ❓ |
| M4 | API 500 mid-recording — local draft preserved; user sees retry option | ❓ | ❓ | ❓ | ❓ | ❓ |
| M5 | Rate-limited (`free_limit_reached` 402) — upgrade prompt with `/pricing` link | ❓ | ❓ | ❓ | ❓ | ❓ |
| M6 | OAuth bounce (user cancels Google) — returns to sign-in with no orphaned session | ❓ | ❓ | ❓ | ❓ | ❓ |
| M7 | Upload > 100 MB — 413 with friendly copy, not raw error | ❓ | ❓ | ❓ | ❓ | ❓ |
| M8 | Browser back from `/meetings/[id]` returns to list at same scroll position | ❓ | ❓ | ❓ | ❓ | ❓ |

---

# Known limitations of this checklist

- **Capacitor Android cannot deep-link `https://`** from `adb am start -d https://...` — no https intent-filter on the WebView. Navigate via the in-app menu instead.
- **`xcrun simctl openurl https://...`** opens Mobile Safari, not the Capacitor app, without Universal Links. Same WebKit so visual parity holds; native-shell-specific behavior (deep-link return, in-app browser plugin) needs a manual flow with a real OAuth round-trip.
- **Theme system pref** is intentionally ignored on first load (brand: paper-calm-v1 = light). Toggle is manual. See **PROD-482** for the open product question.
- **Windows row coverage** depends on having a Windows host or Parallels VM — most rows are `❓` until a Windows run happens.
- **macOS Electron `getUserMedia`** is browser-based (Electron uses Chromium); recording works but native mic capture is a `TODO` in `electron/main.js`.
