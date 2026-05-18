# Android Native Blocker QA Report — Continued Testing

Date: 2026-05-18
Branch: `release/external-tester-readiness-2026-05-17`
Version: `0.1.158`
Worker: Claude Sonnet Android worker, with Codex aggregation after the worker hung on an `adb ping`
Scope: retry Android emulator boot/install/launch after disk space was freed.

## TLDR

The prior Android disk-space blocker is resolved enough for emulator proof.

- `LayersPixel` emulator booted successfully.
- `com.mirafactory.layers` is installed on `emulator-5554`.
- Android package metadata reports `versionName=1.0`, `versionCode=1`, `targetSdk=36`.
- The app process was running as PID `5527`.
- Relaunch command delivered to the already-running `MainActivity`.
- Screenshots were captured for launch/home, hamburger/menu, sign-in, meetings, record, ask, and relaunch proof.

Remaining Android blockers are not emulator-disk blockers anymore:

- Google OAuth native return still requires real Google account/device flow.
- Microphone permission, live recording, and finalize still require physical-device proof.
- Play-ready release still requires Android upload-key signing env.
- Background/screen-locked recording still needs the foreground-service product decision described in `docs/NATIVE_RELEASE_READINESS.md`.

## Evidence

Screenshots in this folder:

- `android-launch.png`
- `android-home-emulator.png`
- `android-home-scrolled-emulator.png`
- `android-hamburger-emulator.png`
- `android-hamburger-open-emulator.png`
- `android-auth-signin-emulator.png`
- `android-meetings-emulator.png`
- `android-record-emulator.png`
- `android-ask-emulator.png`
- `android-current-emulator.png`
- `android-relaunch-proof.png`

## Commands / Results

Package metadata:

```text
versionCode=1 minSdk=24 targetSdk=36
versionName=1.0
lastUpdateTime=2026-05-18 11:06:28
firstInstallTime=2026-05-17 22:55:46
```

Runtime proof:

```text
adb devices
emulator-5554 device

adb -s emulator-5554 shell getprop sys.boot_completed
1

adb -s emulator-5554 shell pidof com.mirafactory.layers
5527

adb -s emulator-5554 shell am start -n com.mirafactory.layers/.MainActivity
Starting: Intent { cmp=com.mirafactory.layers/.MainActivity }
Warning: Activity not started, intent has been delivered to currently running top-most instance.
```

Artifacts present:

```text
android/app/build/outputs/apk/debug/app-debug.apk  6.8M
android/app/build/outputs/bundle/release/app-release.aab  5.4M
```

The AAB remains unsigned because local `LAYERS_ANDROID_*` signing variables are not configured.

## Gate Status

| Gate | Result | Notes |
| --- | --- | --- |
| 23 Android build/install/launch | Partial improved | Emulator boot and app runtime proof now exists; prior disk-space blocker is no longer the issue. |
| 25 Android internal release readiness | Partial | AAB exists but is not Play-ready until upload-key signing env is configured. |
| 9 Native OAuth return | Blocked | Requires real Google account/native callback proof. |
| 11 Mic permission | Blocked | Requires physical device or interactive native permission walk. |
| 12 Live transcript | Blocked | Requires real spoken audio/device proof. |
| 13 Stop/finalize | Blocked | Requires successful Gate 12 and completed meeting detail proof. |

## Next Action

For Android, the next useful test is not another emulator boot. It is a physical-device walk:

1. Install debug/signed build on a real Android device.
2. Run Google OAuth native return.
3. Tap Start Recording and verify `RECORD_AUDIO` runtime prompt.
4. Speak for 30 seconds.
5. Stop/finalize and open the completed meeting detail.
