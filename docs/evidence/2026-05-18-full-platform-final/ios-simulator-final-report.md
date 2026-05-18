# iOS Simulator Final Report

Date: 2026-05-18
Platform: iPhone 16 Pro simulator, UDID `CD658077-5378-49B2-8A17-7068111DD447`
App ID: `com.mirafactory.layers`
Verdict: PASS for simulator OAuth-surface proof, PARTIAL for full native release readiness

## What Was Checked

| Area | Status | Evidence |
| --- | --- | --- |
| iOS config lint | PASS | `plutil -lint ios/App/App/Info.plist ios/App/App/PrivacyInfo.xcprivacy` |
| Xcode project visibility | PASS | `xcodebuild -project ios/App/App.xcodeproj -list`, scheme `App` |
| Launch and sign-in route | PASS | `ios/01-launch.png`, `ios/03-app-signin.png`, latest rebuilt homepage `ios/claude-ios-latest-home.png` |
| Google button opens native in-app browser | PASS | `ios/08-post-maestro-google.png` shows `accounts.google.com` inside SFSafariViewController with a `Done` control, not standalone Safari |
| Native OAuth callback completion | BLOCKED | Google password/2FA/manual session was required; credential completion was intentionally not automated into reports/logs |
| Record route visual smoke | PARTIAL | `ios/12-record-page.png` and follow-up setup screenshots exist, but real-device microphone/background behavior remains unproven |
| Safe-area/notch layout | PASS/PARTIAL | Simulator screenshots show usable layout; real-device physical notch/background behavior remains unproven |

## Commands

```bash
JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home \
PATH=/opt/homebrew/opt/openjdk@21/bin:$PATH \
maestro --device CD658077-5378-49B2-8A17-7068111DD447 \
  test tests/maestro/ios-i2-google-oauth.yml
```

## Blockers

- Full Google callback could not be honestly marked PASS without completing Google credential and 2FA in the simulator session.
- TestFlight, archive signing, App Store upload, and real-device microphone/background proof remain out of scope for this simulator-only pass.

## Latest Rerun

After the shared web UI fixes, the iOS shell was synced, rebuilt, installed, and launched again against `CAPACITOR_SERVER_URL=http://127.0.0.1:3101`. The latest screenshots show:

- `ios/claude-ios-latest-home.png` -- current release-branch homepage loading inside the iPhone 16 Pro simulator.
- `ios/17-after-native-oauth-cleanup-launch.png` -- iOS launch still works after the native OAuth cleanup hardening.
- `ios/18-after-native-oauth-cleanup-google.png` -- Google still opens in SFSafariViewController after the native OAuth cleanup hardening.

This rerun proves the shell still launches and OAuth still opens in the native browser surface after the shared native cleanup changes; it does not upgrade real-device microphone/background or full OAuth callback status.
