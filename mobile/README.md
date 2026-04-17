# mobile — Capacitor shell

Capacitor wraps the **live** hosted Next.js app (web URL via
`server.url` in `capacitor.config.ts`) into native iOS and Android
apps. There is no static export to bundle — the same backend that
serves web and Tauri serves mobile.

## Status

Only the JS-side scaffold is committed:

- `capacitor.config.ts` (repo root) — appId, appName, server.url
  per environment, sane iOS / Android defaults.
- `@capacitor/core`, `@capacitor/ios`, `@capacitor/android` deps,
  plus `@capacitor/cli` as a dev dep.

The native projects (`ios/` and `android/`) are NOT committed yet
because they require platform SDKs to generate (Xcode 15+ and the
Android SDK respectively). Run the steps below on a workstation
that has them.

## First-time setup

```bash
# 1. Generate the iOS project (requires Xcode + cocoapods)
npx cap add ios

# 2. Generate the Android project (requires Android Studio + JDK)
npx cap add android

# 3. Whichever you generated, sync once:
npx cap sync
```

`ios/` and `android/` should be added to .gitignore on first
generation if you prefer the "regenerate per machine" flow, or
committed if you want the team to share native plugin pin state.
We'll decide once a real mobile dev joins the project.

## Develop

```bash
# Terminal 1 — start Next.js
pnpm dev

# Terminal 2 — open the iOS simulator with the live web URL
npx cap run ios

# Or Android:
npx cap run android
```

The shell's WebView loads `http://localhost:3000` (or whatever
`CAPACITOR_SERVER_URL` is set to). All routes — `/record`,
`/record/live`, `/meetings`, `/sign-in`, `/pricing` — work as in
the browser.

## Native audio roadmap

Mobile mic capture inside the WebView works through `getUserMedia`
+ AudioWorklet — same path the regular browser uses. We get this
for free by virtue of the WebView strategy. **Constraint**: iOS
WKWebView and Android WebView require platform Mic permissions
declared in their respective manifests:

- iOS: add `NSMicrophoneUsageDescription` to `ios/App/App/Info.plist`.
- Android: ensure `android.permission.RECORD_AUDIO` is in
  `android/app/src/main/AndroidManifest.xml`.

System-audio capture from other apps is structurally limited:

- **iOS**: not possible from a normal app sandbox; ReplayKit can
  capture screen audio with user consent but is heavyweight.
  Granola's iPhone app deliberately targets in-person meetings only.
- **Android**: `MediaProjection` API (Android 10+) can capture
  some app audio with explicit screen-capture consent. Behavior
  varies by device — treat as best-effort.

When we wire these, the same pattern as the Tauri Rust bridge
applies: native plugin captures audio, decimates to 16 kHz int16
LE, posts chunks to JS, the existing `LiveRecorder` feeds them
into `StreamingTranscriber` instead of (or alongside) the
WebView mic.
