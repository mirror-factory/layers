# iOS Capacitor — "Continue with Google" In-App Browser QA

**Date:** 2026-05-18
**Worker:** iOS Capacitor QA lane (Claude Opus 4.7)
**Branch:** `release/external-tester-readiness-2026-05-17`
**Simulator:** iPhone 16 Pro, UDID `CD658077-5378-49B2-8A17-7068111DD447`, iOS 18.3
**App bundle:** `com.mirafactory.layers`
**Web origin:** local release-branch dev server at `http://127.0.0.1:3101`
**Scope:** Prove whether tapping "Continue with Google" on `/sign-in` opens an in-app `SFSafariViewController` (via `@capacitor/browser`) instead of jumping to the standalone Safari app.

---

## TL;DR — Verdict

**INCONCLUSIVE (upstream-blocked).** In this environment, tapping "Continue with Google" does **not** open an `SFSafariViewController`, and it also does **not** launch the standalone `MobileSafari` app. Instead, the sign-in form surfaces an inline error: **"Auth not configured."**

- The native browser **never opens**, because the OAuth code path bails *before* reaching `Browser.open()`.
- Root cause is **not** a Capacitor Browser regression. It is a missing browser-side Supabase configuration in the local dev server: `getSupabaseBrowser()` returns `null`, and `handleGoogle()` throws "Auth not configured" upstream of `signInWithGoogleNative()`.
- The native plumbing itself (`lib/auth/native-oauth.ts` → `@capacitor/browser` `Browser.open({ presentationStyle: "fullscreen" })`) is correctly wired by code inspection and is unchanged since the prior iOS report — but **cannot be exercised end-to-end here**.

To prove the in-app browser surface end-to-end we need either:
1. The local dev server `.env.local` re-keyed to use `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` (currently keyed as `VITE_…`), or
2. A native build pointed at a Supabase-configured origin (staging / production), or
3. A signed device build (which is the only path that can also prove the round-trip back via `com.mirafactory.layers://auth/callback`).

---

## What Was Done

### 1. Capacitor sync against local dev server

```bash
CAPACITOR_SERVER_URL=http://127.0.0.1:3101/sign-in pnpm exec cap sync ios
```

Result: clean sync. 4 plugins resolved (`@capacitor/app@8.1.0`, `@capacitor/browser@8.0.3`, `@capacitor/local-notifications@8.0.2`, `@capacitor/status-bar@8.0.2`). `ios/App/App/capacitor.config.json` rewritten with:

```json
"url": "http://127.0.0.1:3101/sign-in",
"cleartext": true
```

Pointing the WebView straight at `/sign-in` avoided having to drive UI navigation (the marketing landing page has no programmatically-reachable sign-in entry without working AppleScript taps on the hamburger menu — see "Driving UI" below).

### 2. Simulator build

```bash
xcodebuild -project ios/App/App.xcodeproj -scheme App \
  -configuration Debug -sdk iphonesimulator \
  -destination 'platform=iOS Simulator,id=CD658077-5378-49B2-8A17-7068111DD447' \
  -derivedDataPath /tmp/layers-ios-build \
  CODE_SIGNING_ALLOWED=NO build
```

Result: `** BUILD SUCCEEDED **`. Output at `/tmp/layers-ios-build/Build/Products/Debug-iphonesimulator/App.app`.

### 3. Install + launch

```bash
xcrun simctl uninstall  CD658077-5378-49B2-8A17-7068111DD447 com.mirafactory.layers
xcrun simctl install    CD658077-5378-49B2-8A17-7068111DD447 /tmp/layers-ios-build/Build/Products/Debug-iphonesimulator/App.app
xcrun simctl launch     CD658077-5378-49B2-8A17-7068111DD447 com.mirafactory.layers
# → com.mirafactory.layers: 54650
```

App entered foreground, loaded `http://127.0.0.1:3101/sign-in` in the Capacitor WKWebView.

### 4. Before-tap screenshot

`ios-google-inapp-screens/before-tap.png` — 1206 × 2622 PNG (full retina device buffer). Shows the sign-in card titled "Sign in to Layers" with the "Continue with Google" button visible.

### 5. Driving the tap

`xcrun simctl` does not expose a tap primitive. Used `cliclick` (Homebrew) against the macOS Simulator window via screen coordinates:

```bash
osascript -e 'tell application "Simulator" to activate'
cliclick c:1600,620   # corresponds to the centre of "Continue with Google"
```

Window geometry: position `1370, 98`, size `456 × 972` (≈28 pt titlebar). Device area: 393 × 852 pt at scale 1.16. The button is centred horizontally and at roughly y = 50 % of device height in the rendered PNG.

The "before" screenshot already shows the white pill button. Compare with `04-after-google-tap.png`: same button is rendered with a faint green hover background — the tap landed. (The simulator does not render touch ripples on macOS clicks; the button's pressed-state style is the only visual cue that the click reached the WebView.)

### 6. After-tap state

`ios-google-inapp-screens/04-after-google-tap.png`:

- Same sign-in card, same form fields, still in foreground.
- A new amber alert pill is rendered just below the email/password "Sign in" button: **"Auth not configured."**
- No SFSafariViewController overlay, no fullscreen modal browser, no app switch.

### 7. Process snapshot (before vs after tap)

```bash
xcrun simctl spawn CD658077-5378-49B2-8A17-7068111DD447 launchctl list \
  | grep -iE "UIKitApplication|safari"
```

Both before and after the tap, only `UIKitApplication:com.mirafactory.layers` is present. `MobileSafari` (bundle `com.apple.mobilesafari`) is **never** launched. `com.apple.Safari.SafeBrowsing.Service` is running but this is a background daemon that Safari-Services-using apps share (including WKWebView), not Safari.app itself.

### 8. System log evidence

Streamed `xcrun simctl spawn … log stream` filtered on `App`, `Safari`, `SafariServices`, `WebKit`, `SFSafariViewController`, `Browser.open`, `MobileSafari` while the tap fired. Full capture at `/tmp/sim-log.txt` (1,918 lines). Notable entries around the tap (`11:47:17` – `11:47:18`):

```
App[54650:35aa6] [com.apple.WebKit:Loading] WebPageProxy::loadRequest:
App[54650:35aa6] [com.apple.WebKit:AppSSO] SOAuthorizationCoordinator::tryAuthorize
App[54650:35aa6] (AppSSO) canPerformAuthorizationWithURL
App[54650:35aa6] [com.apple.authkit:siwa] URL shouldn't be processed
App[54650:35aa6] [com.apple.WebKit:AppSSO]
  SOAuthorizationCoordinator::tryAuthorize:
  The requested URL is not registered for AppSSO handling. No further action needed.
```

What this tells us:
- All activity stayed inside the App's WebKit instance (PID 54650).
- AppSSO was queried (standard for every WebView navigation) and declined — Google's OAuth URL is not a Sign-In-with-Apple handler. Expected.
- **No** `SFSafariViewController` instantiation entries, **no** `presentSafariViewController:`, **no** `BrowserPlugin` log lines.

Conclusion: the Capacitor Browser plugin's native code was **never invoked**.

---

## Root Cause: Upstream "Auth not configured" Guard

`app/(public)/sign-in/sign-in-form.tsx:75-86` is the handler bound to "Continue with Google":

```ts
const handleGoogle = async () => {
  setGoogleLoading(true);
  setError(null);
  try {
    const supabase = getSupabaseBrowser();
    if (!supabase) throw new Error("Auth not configured");   // ← bails here

    if (isNativePlatform()) {
      await signInWithGoogleNative({ scopes: …, next: … }, { supabase });
      …
    }
    …
  } catch (err) {
    setError(err instanceof Error ? err.message : "Sign in failed");
  }
};
```

`getSupabaseBrowser()` (`lib/supabase/browser.ts:14-23`) reads:

```ts
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !anonKey) return null;
```

The local `.env.local` exposes the keys with the **wrong prefix**:

```
VITE_SUPABASE_URL=<…>
VITE_SUPABASE_ANON_KEY=<…>
```

There is no `NEXT_PUBLIC_SUPABASE_*` in `.env.local` or `.env.example`. Next.js only inlines variables prefixed `NEXT_PUBLIC_` into the client bundle, so `getSupabaseBrowser()` always returns `null` on this dev server, regardless of platform. The same error fires on web, Capacitor iOS, and Capacitor Android.

Because the guard fires before `if (isNativePlatform())`, the native code path — which is what would call into `lib/auth/native-oauth.ts → Browser.open(…)` — is unreachable.

---

## Why The Native Plumbing Is Still Believed Correct

`lib/auth/native-oauth.ts:213` adds the deep-link listener *before* opening the browser:

```ts
const registration = await App.addListener("appUrlOpen", handleUrl);
…
await beginBrowserOpen(
  Browser.open({ url: data.url, presentationStyle: "fullscreen" }),
  async () => {
    await dispose();
    navigate("/sign-in?error=native_browser_open_failed");
  },
);
```

`@capacitor/browser@8.0.3` on iOS implements `Browser.open` via `SFSafariViewController` presented modally on the front-most ViewController. `presentationStyle: "fullscreen"` is honoured. The plugin is bundled into `App.app/Frameworks/CapacitorBrowser.framework` (verified by Xcode resolved-packages list in the prior `ios-native-worker-report.md`, Check 5).

`lib/auth/native-oauth.ts` is unchanged between the prior iOS report and this one (no commits touch `lib/auth/**` or `components/native-auth-bridge.tsx` since `53ffaab`). Code review of the prior report (Check 9) verified PKCE, callback URL `com.mirafactory.layers://auth/callback`, listener-before-open ordering, cold-start handler, and error cleanup.

The native side is wired. The dev server just can't bring it to life.

---

## Evidence Files

All in `docs/evidence/2026-05-18-continued-claude-testing/ios-google-inapp-screens/`:

| File | What it shows |
|------|--------------|
| `01-app-launched.png` | First load with the default capacitor.config root (`/`). Marketing landing on the local dev server. Used to confirm sync + build + install worked. |
| `02-after-hamburger-tap.png`, `02b-after-hamburger-retry.png` | Two failed attempts at tapping the hamburger via `cliclick`. Documented here so the reader can see why we resorted to redirecting the dev server URL to `/sign-in` directly. |
| `03-sign-in-page.png` | Capacitor WebView landed on `/sign-in` after re-sync with `CAPACITOR_SERVER_URL=http://127.0.0.1:3101/sign-in`. |
| `before-tap.png` | Canonical "before" snapshot — duplicate of `03-sign-in-page.png` for clarity. |
| `04-after-google-tap.png` | Canonical "after" snapshot. Continue-with-Google button shows its hovered background (proving the tap landed), and the new amber pill "Auth not configured" is rendered below the email "Sign in" button. App still in foreground. No SafariViewController, no Safari.app. |

System log capture (raw): `/tmp/sim-log.txt` (1,918 lines, 11:47:17–11:47:32 window). Not copied into the repo (transient simulator log).

---

## What Would Make This Pass On The Next Run

Either of these unblocks the actual SFSafariViewController test in the simulator:

1. **Fix `.env.local`** so the Next.js dev server exposes Supabase to the browser bundle. Rename or duplicate the keys:

   ```
   NEXT_PUBLIC_SUPABASE_URL=<same value as VITE_SUPABASE_URL>
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<same value as VITE_SUPABASE_ANON_KEY>
   ```

   Restart `pnpm dev`. The local web app and the Capacitor WebView on top of it will both pick this up. The `handleGoogle()` guard will pass, `signInWithGoogleNative` will fire, `Browser.open(...)` will present `SFSafariViewController`, and the next QA run can grab a "Google consent screen presented as in-app overlay" screenshot.

2. **Point the Capacitor build at a Supabase-configured origin** (e.g. `https://staging.layers.mirrorfactory.ai`):

   ```bash
   CAPACITOR_SERVER_URL=https://staging.layers.mirrorfactory.ai/sign-in pnpm exec cap sync ios
   ```

   Same Xcode/install/launch flow.

3. **Real device + TestFlight build**, which is the only path that can *also* prove the round-trip back via `com.mirafactory.layers://auth/callback`. Carry-forward from the prior report's "Device-Only Blockers" section.

The native code, plugins, URL schemes (`layers://`, `com.mirafactory.layers://`), and `NSMicrophoneUsageDescription` were all verified clean in the prior `ios-native-worker-report.md` (this session is downstream of that one). Nothing in those gates regressed.

---

## Summary Table

| Step | Outcome |
|------|---------|
| `pnpm exec cap sync ios` (twice — once for `/`, once for `/sign-in`) | PASS |
| `xcodebuild … build` for simulator | PASS — `** BUILD SUCCEEDED **` |
| `xcrun simctl install` + `launch` | PASS — PID 54650 in foreground |
| WebView lands on `/sign-in` | PASS — see `03-sign-in-page.png` |
| Tap "Continue with Google" | PASS — button shows pressed-state background in `04-after-google-tap.png` |
| `SFSafariViewController` presented in-app | **NOT OBSERVED** — blocked upstream |
| Standalone `MobileSafari` launched | **NOT OBSERVED** — no Safari.app process appeared in `launchctl list` |
| Inline error on `/sign-in` | **"Auth not configured"** — `lib/supabase/browser.ts` returns `null` because `.env.local` only carries `VITE_*` Supabase keys, not `NEXT_PUBLIC_*` |

**Bottom line:** native Google OAuth surface could not be proven in this environment — the test was blocked one layer above Capacitor, in the Next.js dev server's browser-side Supabase config. Fix the env-var prefix, re-run, and the same iOS Simulator setup should be sufficient to prove `SFSafariViewController` opens in-app (cancel/return round-trip still requires a real device).

---

## Final Addendum — 2026-05-18 12:12 EDT

**Updated verdict: PASS for the requested simulator scope.** After the Supabase env alias fix and Capacitor plugin-loader fix, the iOS simulator flow was rerun with Maestro without taking over the user's screen.

Retest command:

```bash
JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home \
  maestro test --platform ios \
  --udid CD658077-5378-49B2-8A17-7068111DD447 \
  --debug-output /tmp/layers-maestro-ios-google \
  /tmp/layers-ios-google-flow.yaml
```

Maestro steps completed:

| Step | Result |
|---|---|
| Launch `com.mirafactory.layers` with clean state | PASS |
| Wait for `Continue with Google` | PASS |
| Capture before screenshot | PASS |
| Tap `Continue with Google` | PASS |
| Wait for animation to end | PASS |
| Capture after screenshot | PASS |

Final proof:

- `ios-native-oauth-before-google-maestro.png` — sign-in screen before tap.
- `ios-native-oauth-after-google-maestro.png` — in-app browser surface showing `accounts.google.com`.
- `ios-native-oauth-current-screen.png` — simulator screenshot after tap.
- `ios-maestro.log` and `ios-maestro-commands.json` — raw Maestro execution evidence.
- `launchctl list` showed `UIKitApplication:com.mirafactory.layers` and `UIKitApplication:com.apple.SafariViewService`; standalone `MobileSafari` was not launched.

This proves the requested behavior: tapping Google opens the iOS in-app Safari view, not a separate Safari app. The test intentionally stops before Gmail credential completion.
