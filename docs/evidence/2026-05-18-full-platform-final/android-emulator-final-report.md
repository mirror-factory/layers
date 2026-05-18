# Android Emulator Final Report

Date: 2026-05-18
Platform: Android emulator `LayersPixel`
App ID: `com.mirafactory.layers`
Verdict: PASS for debug build/install/launch and OAuth-surface proof, PARTIAL for recording and full native release readiness

## What Was Checked

| Area | Status | Evidence |
| --- | --- | --- |
| Android manifest lint | PASS | `xmllint --noout android/app/src/main/AndroidManifest.xml` |
| Capacitor local sync | PASS | `logs/android-cap-sync-local.log` |
| Debug APK build | PASS | `logs/android-gradle-local-assembleDebug.log` |
| Debug APK install and launch | PASS/PARTIAL | `logs/android-install-local.log`, `android/16-local-home-after-rebuild.png`, `android/claude-android-latest-home.png`, `android/21-local-home-after-back-from-black.png` |
| Local branch homepage | PASS | `android/16-local-home-after-rebuild.png` shows current homepage copy and confirms the emulator was no longer using stale production |
| Google button opens Custom Tab | PASS | `android/18-local-google-after-chrome-dismiss.png` shows `accounts.google.com` in Chrome Custom Tab; top activity was `org.chromium.chrome.browser.customtabs.CustomTabActivity` |
| Native OAuth callback completion | BLOCKED | Google password/2FA/manual session was required; Chrome first-run had to be initialized |
| Record route | PARTIAL | `android/19-record-after-start-click.png` reaches `/record/live`; `android/20-record-start-or-permission.png` shows WebView microphone unavailable over local `http://10.0.2.2:3101` |
| Release AAB signing | BLOCKED | No Play upload-key signing proof was attempted or provided in this pass |

## Important Finding

An earlier Android screenshot was using live production and showed stale support copy. The local debug app was then rebuilt with:

```bash
CAPACITOR_SERVER_URL=http://10.0.2.2:3101 pnpm exec cap sync android
cd android && ./gradlew :app:assembleDebug
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

The valid release-branch Android proof is the local set beginning at `android/16-local-home-after-rebuild.png`.

Latest rerun note: after the local debug APK was rebuilt and launched again, the first captured screenshot was a black WebView (`android/claude-android-latest-home.png`) even though logcat showed Capacitor loading `http://10.0.2.2:3101`. Pressing Android Back returned the WebView to the current release-branch homepage (`android/21-local-home-after-back-from-black.png`).

Follow-up fix: native auth cleanup was hardened so stale Capacitor Browser/Custom Tab surfaces are closed on app startup and browser cancel/finish is disposed through the native OAuth helper. After narrowing the cleanup to avoid closing Browser on every app resume:

- Cold launch returned directly to the styled homepage: `android/28-cleanup-narrowed-cold-launch.png`.
- Google still opens in Chrome Custom Tab: `android/31-narrowed-google-custom-tab-cdp-input.png`.
- Back from the Custom Tab returns to the app. The immediate return can briefly repaint in local Next dev mode, but the styled sign-in page settles correctly: `android/33-after-custom-tab-back-wait.png`.

Treat Android as improved for emulator debug QA. Real-device OAuth return and HTTPS/prod build proof are still required before store release.

## Blockers

- Full Google callback could not be marked PASS without completing Google credential and 2FA.
- Microphone recording cannot be proven in Android WebView over local non-secure `http://10.0.2.2:3101`; it needs HTTPS/native production or real-device proof.
- Play Store/internal testing signing remains unproven.
- Real-device OAuth return should be checked because local Next dev mode briefly repainted after Custom Tab close before settling back into the styled page.
