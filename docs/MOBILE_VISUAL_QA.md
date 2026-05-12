# Mobile Visual QA Checklist

> Walked by a tester (or sim-driving agent) before every public-marketing push that ships changes to `app/(public)/**`, `components/public-site-nav.tsx`, `components/testing-banner.tsx`, `components/site-footer.tsx`, or shared layout/theme.
>
> Companion to `docs/RECORDING_MANUAL_QA.md` — that doc covers the in-app recording UX (camera/mic permissions, AssemblyAI streaming, etc.). This doc covers the **public marketing surfaces** as rendered inside the Capacitor iOS + Android shells (which both load `https://layers.mirrorfactory.ai`).

## Where evidence lives

Per session: `docs/evidence/YYYY-MM-DD-<slug>/`

- **Screenshots** — one PNG per row. Filename pattern: `{platform}-{step}.png` e.g. `ios-01-hero.png`, `and-route-pricing.png`.
- **Videos** — short MP4 per platform when interaction matters (scroll jank, animations).
  - iOS: `xcrun simctl io booted recordVideo --codec=h264 path.mp4` (Ctrl-C / SIGINT to stop)
  - Android: `adb shell screenrecord --time-limit 30 /sdcard/out.mp4 && adb pull /sdcard/out.mp4 path.mp4`
- **Linear tickets** — file `kind:bug` for anything not fixed in the same session. Attach the screenshot. Tag `owner:human` if it needs a brand/copy decision; `owner:agent` if it's purely an implementation fix.
- **PRs** — embed the pre-fix screenshot path under `## Evidence`; the next-session PR adds the post-fix screenshot alongside.

## Sim setup (one-time)

- iOS: Xcode + iPhone 16 Pro sim (`xcrun simctl boot CD658077-5378-49B2-8A17-7068111DD447`)
- Android: `openjdk@21` + `android-commandlinetools` + AVD `LayersPixel` (Pixel 7 profile, system-image `android-34;google_apis;arm64-v8a`)
- Build + install:
  - iOS: `pnpm cap:sync && xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Debug -destination "id=CD658077-..." CODE_SIGNING_ALLOWED=NO build && xcrun simctl install booted <App.app> && xcrun simctl launch booted com.mirrorfactory.audiolayer`
  - Android: `(cd android && ./gradlew :app:assembleDebug) && adb install -r android/app/build/outputs/apk/debug/app-debug.apk && adb shell am start -n com.mirrorfactory.layers/.MainActivity`

## Tap-coordinate cheatsheet (Pixel 7 emulator, 1080x2400 physical px)

- Hamburger menu icon: `adb shell input tap 1000 324`
- Theme toggle (sun/moon): `adb shell input tap 860 324`
- Menu items when drawer is open:
  - Download: `adb shell input tap 200 475`
  - Pricing: `adb shell input tap 200 682`
  - Sign in: `adb shell input tap 200 861`
- Scroll one screen: `adb shell input swipe 540 1800 540 400 300`

iOS sim: `xcrun simctl io booted tap` does **not** exist. Use `xcrun simctl openurl booted "https://layers.mirrorfactory.ai/<route>"` for direct navigation (opens in Mobile Safari, not the Capacitor app — same WebKit, useful for visual checks but doesn't exercise the native shell).

## Rows

| # | Surface | What to verify | Pre-fix evidence | Linear |
|---|---------|---------------|------------------|--------|
| 1 | Landing hero | TestingBanner clears Dynamic Island on iOS; no horizontal overflow; "Coming soon" + "See how it works" CTAs visible above fold. | `ios-pre-fix.png`, `and-01-hero.png` | PROD-460 |
| 2 | Landing mid-scroll | Sticky header stays fully opaque on mobile — bold section headlines and large pricing values should NOT bleed through. | `and-02-scroll-{1..5}.png` | PR #73 |
| 3 | Hamburger menu open | Three links (Download / Pricing / Sign in) visible, no overlap with banner, X icon swaps in for hamburger. | `and-03-menu-open.png` | — |
| 4 | Theme toggle (sun/moon) | Tapping switches `html.dark`/`html.light`; persists across reload. | `and-20-theme-attempt.png` | — |
| 5 | /pricing | Hero copy + Core $20 / Pro $30 cards render; pricing values do not bleed through sticky header on scroll. | `and-pricing.png`, `ios-route-pricing.png` | — |
| 6 | /sign-in | Google OAuth button + email/password form; support email link points to `support@mirrorfactory.ai`. | `and-signin.png` | PR #74 |
| 7 | /download | Platform recommendation card renders; download CTAs match the device. | `and-download.png`, `ios-route-download.png` | — |
| 8 | /changelog | Latest release shows at top; release type labels visible. | `ios-route-changelog.png` | — |
| 9 | /docs | TOC links render, no overflow. | `ios-route-docs.png` | — |
| 10 | Privacy/Terms/Account-deletion | Render without overflow; support email correct. | (run on demand) | — |
| 11 | Dark mode honors system pref | iOS sim with `xcrun simctl ui booted appearance dark` should auto-flip site to dark. **Currently does not** — site forces light default. | — | (file `kind:bug` if changing default policy) |
| 12 | iOS Capacitor OAuth deep-link | After Google OAuth, callback `com.mirrorfactory.layers://auth/callback` returns user to Layers app, not Safari. | run manually with real Google account | PROD-408 |

## Known limitations

- Capacitor Android **cannot deep-link https URLs** from `adb am start -d https://...` because the WebView has no https intent-filter. Navigate via the in-app menu instead.
- `xcrun simctl openurl https://...` opens **Mobile Safari**, not the Capacitor app, unless Universal Links (apple-app-site-association) are configured. Useful for parallel visual checks since WebKit is the same renderer.
- Theme system preference is intentionally ignored on first load — site defaults to light per brand design (`theme-design-version: layers-paper-calm-v1`). Toggle is manual.
