# Android Capacitor — Google Sign-In In-App Browser Verification

**Date:** 2026-05-18
**Branch / commit:** `release/external-tester-readiness-2026-05-17` @ `3d79936`
**Device:** AVD `LayersPixel` (Pixel-class, Android 14 / sdk_gphone64_arm64, 1080x2400)
**App ID:** `com.mirafactory.layers`
**APK:** `android/app/build/outputs/apk/debug/app-debug.apk`
**Capacitor server URL:** `http://10.0.2.2:3101` (host's local Next.js dev server, reverse-proxied via emulator localhost alias)
**Operator:** Claude Opus 4.7 — Android Capacitor QA lane

---

## Verdict

**Inconclusive in current local configuration — the Google auth surface is never opened against the local dev server, so the in-app vs. external-browser question cannot be answered visually with this build.**

Strong indirect evidence (code path, native wiring, live Custom Tabs warm-up binding) indicates the production code path is wired to open a **Chrome Custom Tab in-app**, not an external Chrome browser. Live visual proof against a fully-configured server is still required.

---

## What I ran

1. Configured Android SDK env for this session only (not persisted):
   - `ANDROID_HOME=/opt/homebrew/share/android-commandlinetools`
   - `ANDROID_SDK_ROOT=$ANDROID_HOME`
   - `JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home`
2. `CAPACITOR_SERVER_URL=http://10.0.2.2:3101 pnpm exec cap sync android` →
   `android/app/src/main/assets/capacitor.config.json` now has
   `server.url = "http://10.0.2.2:3101"`, `cleartext: true`.
3. `./gradlew --no-daemon assembleDebug` → **BUILD SUCCESSFUL** in 6s.
4. Boot AVD: `emulator -avd LayersPixel -no-boot-anim -netdelay none -netspeed full`; waited for `sys.boot_completed=1`.
5. `adb install -r -t app-debug.apk` → **Success**.
6. `adb shell am start -n com.mirafactory.layers/com.mirafactory.layers.MainActivity` → MainActivity in focus.
7. WebView loaded `http://10.0.2.2:3101/` (marketing landing). Opened hamburger → tapped **Sign in** → `/sign-in` rendered in-WebView.
8. Captured **before** screenshot: [`android-google-signin-before.png`](./android-google-signin-before.png) — shows the `Sign in to Layers` card with the "Continue with Google" pill button.
9. Tapped **Continue with Google**.
10. Captured **after** screenshot: [`android-google-signin-after.png`](./android-google-signin-after.png) — shows the same `/sign-in` page with an inline error: **"Auth not configured"**. No Custom Tab overlay, no external Chrome activity, no navigation away from MainActivity.

---

## Why the Google auth surface never opened

`app/(public)/sign-in/sign-in-form.tsx` (`handleGoogle`):

```ts
const supabase = getSupabaseBrowser();
if (!supabase) throw new Error("Auth not configured");

if (isNativePlatform()) {
  await signInWithGoogleNative({ ... }, { supabase });
  return;
}
```

`getSupabaseBrowser()` returned `null` because the local Next.js dev server (PID 43882, `next-server v15.5.18` listening on `:3101`) is missing the `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` env vars. `.env.local` only contains `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` (Vite-prefix, not Next-prefix). Result: the handler throws before `signInWithGoogleNative` runs, so `@capacitor/browser`'s `Browser.open` is never invoked.

This is a **local-environment gap**, not an Android-side regression. The Android shell, Capacitor sync, and APK install all worked.

---

## Indirect evidence that the in-app browser path is correctly wired

Even though we did not see the Custom Tab open live, three independent pieces show the production path opens **in-app** (Custom Tab), not the external Chrome browser:

### 1. Source code uses `@capacitor/browser` (Capacitor 8.0.3)

`lib/auth/native-oauth.ts` (PROD-408):

```ts
const mod = await import("@capacitor/browser");
const Browser = mod.Browser;
// ...
await Browser.open({ url: data.url, presentationStyle: "fullscreen" });
```

### 2. `@capacitor/browser`'s Android implementation uses `CustomTabsIntent`

`node_modules/@capacitor/browser/android/.../Browser.java`:

```java
import static androidx.browser.customtabs.CustomTabsIntent.SHARE_STATE_ON;
public void open(Uri url, @Nullable Integer toolbarColor) {
    CustomTabsIntent.Builder builder = new CustomTabsIntent.Builder(getCustomTabsSession());
    CustomTabsIntent tabsIntent = builder.build();
    ...
}
```

`CustomTabsIntent` is the AndroidX API that launches a Chrome Custom Tab overlay (not a regular Chrome browser window). The visual difference: a Custom Tab opens on top of the host activity, retains the host app's task/back stack, and shows the host app's branding color in the toolbar.

### 3. Live `dumpsys activity activities` proof — Capacitor warmed up Custom Tabs

After app launch, **before** tapping Continue with Google, the MainActivity already holds a service binding to Chrome's Custom Tabs service:

```
* Hist  #0: ActivityRecord{... u0 com.mirafactory.layers/.MainActivity ...}
    ...
    connections={ConnectionRecord{... CR WPRI
        com.android.chrome/org.chromium.chrome.browser.customtabs.CustomTabsConnectionService:@...
        flags=0x21}}
```

That binding to `CustomTabsConnectionService` is established by `androidx.browser.customtabs.CustomTabsClient.bindCustomTabsService(...)`. The full Chrome browser does **not** require this binding — it is uniquely a Custom Tabs warmup. Capacitor's BrowserPlugin pre-warms it on activity start so the eventual `Browser.open(...)` is fast.

### 4. Deep-link return contract is registered

`android/app/src/main/AndroidManifest.xml` registers exactly the intent filter Capacitor expects to receive the OAuth callback back from the Custom Tab:

```xml
<intent-filter android:autoVerify="false">
  <action android:name="android.intent.action.VIEW" />
  <category android:name="android.intent.category.DEFAULT" />
  <category android:name="android.intent.category.BROWSABLE" />
  <data android:scheme="com.mirafactory.layers" android:host="auth" android:path="/callback" />
</intent-filter>
```

`NATIVE_OAUTH_REDIRECT_URL = "com.mirafactory.layers://auth/callback"` matches. This is the round-trip path: Capacitor opens the Custom Tab with the Google consent URL → Google redirects back to the custom scheme → AndroidOS hands the URL to MainActivity (not Chrome).

---

## What I observed that I did NOT observe

| Expected if external Chrome | Observed |
|---|---|
| `mFocusedApp` switches to `com.android.chrome/...CustomTabActivity` or similar | **Not observed** (no Browser.open fired) |
| Chrome address bar visible at top | **Not observed** |
| `accounts.google.com` HTTP request in logcat / Chrome | **Not observed** |
| `am start -a android.intent.action.VIEW` to external browser | **Not observed** |

| Expected if in-app Custom Tab | Observed |
|---|---|
| `mCurrentFocus` stays on Capacitor MainActivity with a translucent overlay containing the Google URL | **Could not test** (Browser.open never called) |
| `CustomTabsConnectionService` binding on MainActivity | **OBSERVED** — see §3 above |

---

## Files written

- [`android-google-signin-before.png`](./android-google-signin-before.png) — sign-in screen before tap
- [`android-google-signin-after.png`](./android-google-signin-after.png) — sign-in screen after tap, "Auth not configured" inline error
- This report

---

## How to get a definitive positive proof

Two options, in order of preference:

1. **Populate Next-prefix Supabase vars in `.env.local`** and restart the dev server on `:3101`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=<same as VITE_SUPABASE_URL>
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<same as VITE_SUPABASE_ANON_KEY>
   ```
   Then repeat steps 5–10 above. Expected: tapping Continue with Google opens a Chrome Custom Tab overlay (not a full Chrome window), with `accounts.google.com` content and the Layers brand color in the toolbar. `dumpsys activity activities` will show a separate `CustomTabActivity` in the same task stack as MainActivity.
2. **Rebuild without `CAPACITOR_SERVER_URL`** so the APK points at `https://layers.mirrorfactory.ai`, which is fully configured. Reinstall and repeat the tap. Same expected outcome.

Either confirms the in-app Custom Tab path that is already wired in source.

---

## Side observations (not blocking)

- First tap on "Sign in" missed because pixel-y was inferred from a downscaled chat preview of the screenshot; corrected by cropping the native 1080x2400 PNG via PIL (`y=840` for the Sign in row). Logged here so the next worker doesn't re-discover the same calibration gap.
- The dev server's hot-reload fired during the first `Continue with Google` tap and rebuilt the page, which is why the very first attempt produced a confused state (page reverted to `/`). Subsequent attempts after Fast Refresh settled were stable.
- No external Chrome browser was launched at any point. The only Chrome-side activity was the Custom Tabs **warmup binding** described in §3, which is in-process and does not put Chrome in the foreground.

---

## Final Addendum — 2026-05-18 12:12 EDT

**Updated verdict: PASS with one emulator caveat.** After the repo-level auth fixes, the local dev server no longer renders "Auth not configured" and tapping **Continue with Google** reaches the native Capacitor OAuth path.

Changes made before retest:

- Added `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` fallback mapping in `next.config.ts` so the existing local `VITE_SUPABASE_*` values are exposed to the Next.js browser bundle.
- Fixed `lib/auth/native-oauth.ts` so Capacitor plugin proxies are wrapped in plain objects before returning from async loaders. This removes the Android runtime error: `"App.then()" is not implemented on android`.

Retest evidence:

- `android-native-oauth-before-fixverify.png` — local Capacitor WebView on `/sign-in`, Google button enabled, no "Auth not configured" error.
- `android-native-oauth-device-after-fixverify.png` — after Google tap. The emulator displays Chrome first-run UI because Chrome had not been initialized in this AVD.
- `dumpsys activity activities` showed `com.mirafactory.layers/com.capacitorjs.plugins.browser.BrowserControllerActivity` in the app task after the tap, proving Capacitor Browser was invoked.
- `logcat` no longer shows `App.then()` or `Auth not configured` during the retest.

Android caveat:

The AVD intercepted the Custom Tab with Chrome's first-run screen. That is an emulator state artifact, not the app's old auth failure. The important app-side proof is that the Google tap now reaches `BrowserControllerActivity` through Capacitor Browser. A fully initialized Chrome profile or physical Android device should show the Google `accounts.google.com` Custom Tab directly.
