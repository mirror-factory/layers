# Platform builds

Every build target end-to-end: prerequisites → dev build → production build → distribute → test. Bundle identifier is `com.mirrorfactory.audiolayer` across all shells.

## Overview

| Platform | Shell | Source dir | First-build command | Output |
|---|---|---|---|---|
| Web | Next.js | `app/`, `lib/`, `components/` | `pnpm build && pnpm start` | Vercel deploy |
| macOS | Tauri | `src-tauri/` | `cargo tauri dev` | `.dmg` + `.app` |
| Windows | Tauri | `src-tauri/` | `cargo tauri dev` | `.msi` + `.exe` |
| Linux | Tauri | `src-tauri/` | `cargo tauri dev` | `.AppImage` + `.deb` |
| iOS | Capacitor | `ios/` (generated) | `npx cap open ios` | `.ipa` |
| Android | Capacitor | `android/` (generated) | `npx cap open android` | `.apk` + `.aab` |
| PWA | — | n/a | `pnpm build` | Same as web |

The web app is the **single backend**. Every shell loads it via `server.url` (Capacitor) or `frontendDist` URL (Tauri). Only the audio-capture code differs per platform.

## Prerequisites

Per-platform toolchain. Install only the ones you'll build for.

### All platforms
```bash
# Node 22+ + pnpm
node --version   # should be v22+
pnpm --version   # 10+ recommended; install with: npm i -g pnpm
```

### Tauri (macOS / Windows / Linux desktop)
```bash
# Rust toolchain
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup update
rustc --version   # must be 1.77+

# Tauri CLI
cargo install tauri-cli --version "^2.0"

# Platform-specific native deps:

# macOS:
xcode-select --install

# Windows:
# - Install Visual Studio 2022 Build Tools with "Desktop development with C++"
# - Install WebView2 runtime (ships with Windows 11; download from Microsoft for Win10)

# Linux (Debian/Ubuntu):
sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file libxdo-dev \
  libssl-dev libayatana-appindicator3-dev librsvg2-dev
```

### iOS (Capacitor)
```bash
# Xcode 15+ from Mac App Store
xcode-select --install
xcodebuild -version    # should be 15.0+

# cocoapods
sudo gem install cocoapods
pod --version

# Apple Developer account (free for dev; $99/yr for App Store)
```

### Android (Capacitor)
```bash
# JDK 17 (Temurin recommended)
brew install --cask temurin@17      # macOS
# or download from adoptium.net

java -version          # should be 17+

# Android Studio: https://developer.android.com/studio
# Install Android SDK Platform 34, Build-Tools 34+, Command-line Tools

# ~/.zshrc (or .bashrc):
export ANDROID_HOME=$HOME/Library/Android/sdk              # macOS
# export ANDROID_HOME=$HOME/Android/Sdk                    # Linux
export PATH=$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator
```

---

## macOS (Tauri desktop)

The flagship desktop target. System-audio loopback via ScreenCaptureKit is the real differentiator here.

### Develop

```bash
# From repo root
cargo tauri dev
```

This starts `pnpm dev` in parallel (Next.js on :3000) and opens a native window pointed at it. Code reloads hit both processes.

### First-run permissions

On first `start_system_audio_capture` call, macOS prompts for:
- **Microphone** access → granted via the standard dialog (uses `NSMicrophoneUsageDescription` from `src-tauri/Info.plist`)
- **Screen Recording** access → granted in System Settings → Privacy & Security → Screen & System Audio Recording → enable your app

You have to restart the app after granting Screen Recording — macOS caches the decision per-launch.

### Production build

```bash
cargo tauri build
```

Produces `src-tauri/target/release/bundle/macos/audio-layer.app` and `.dmg`. Unsigned by default — macOS Gatekeeper will warn users on first launch.

### Signing + notarization (for distribution)

Required if you want Mac users to launch without Gatekeeper warnings.

1. Apple Developer account → enroll as an organization ($99/yr).
2. In Xcode or Apple Developer portal, create:
   - **Developer ID Application** certificate
   - An App Store Connect API key (for notarization)

3. Add to `src-tauri/tauri.conf.json`:
   ```json
   "bundle": {
     "macOS": {
       "signingIdentity": "Developer ID Application: Your Name (TEAMID)",
       "providerShortName": "TEAMID",
       "entitlements": "entitlements.plist",
       "minimumSystemVersion": "14.0"
     }
   }
   ```

4. Entitlements — create `src-tauri/entitlements.plist`:
   ```xml
   <?xml version="1.0" encoding="UTF-8"?>
   <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
   <plist version="1.0">
   <dict>
     <key>com.apple.security.cs.allow-jit</key><true/>
     <key>com.apple.security.cs.allow-unsigned-executable-memory</key><true/>
     <key>com.apple.security.device.audio-input</key><true/>
     <key>com.apple.security.device.screen-capture</key><true/>
   </dict>
   </plist>
   ```

5. Notarize — set these env vars and run build:
   ```bash
   export APPLE_ID=you@example.com
   export APPLE_PASSWORD=<app-specific-password>
   export APPLE_TEAM_ID=TEAMID
   cargo tauri build
   ```
   Tauri submits the build to Apple's notary service and staples the result.

### Test

- Developer: the dev build is enough — `cargo tauri dev` opens a window, you can exercise `/record/live` and verify the native mic + system audio paths.
- Beta testers: ship the notarized `.dmg` via any file-sharing service (Dropbox, GitHub Release, etc.).
- App Store: eventually, but Tauri 2 App Store submission is newer — use the Mac App Store target in `tauri.conf.json` when ready. Requires additional sandboxing entitlements.

### Known gotchas

- **First cargo build is slow** (~5–10 min). Subsequent builds cache heavily.
- **Rust compile errors** on the first run — the ScreenCaptureKit code in `src-tauri/src/lib.rs` was written without compile verification (see `VERIFICATION_GAPS.md` #1 and #12). Expect real errors; fix and re-run.
- **M1 vs Intel binaries** — `cargo tauri build` targets the host architecture. For universal builds, use `cargo tauri build --target universal-apple-darwin`.

---

## Windows (Tauri desktop)

System-audio capture via WASAPI loopback is stubbed — the `start_system_audio_capture` command returns "not implemented" on Windows today. Mic capture via cpal works.

### Develop

```bash
cargo tauri dev
```

Same as macOS but opens a native Windows window.

### Production build

```bash
cargo tauri build
```

Produces `.msi` (installer) and `.exe` (standalone) in `src-tauri/target/release/bundle/`.

### Signing

For SmartScreen to stop warning users:
1. Acquire a code-signing certificate from DigiCert / Sectigo / ssl.com ($200–500/yr).
2. Install via `certmgr.msc` or configure `signtool.exe`.
3. Add to `tauri.conf.json`:
   ```json
   "bundle": {
     "windows": {
       "certificateThumbprint": "YOUR_CERT_THUMBPRINT",
       "digestAlgorithm": "sha256",
       "timestampUrl": "http://timestamp.digicert.com"
     }
   }
   ```

### Test

- Windows 11 and Windows 10 both supported. WebView2 runtime is bundled with Windows 11; download + install for Win10 if missing.
- Mic permission: standard Windows runtime permission dialog fires on first `getUserMedia`.

### Known gotchas

- **WebView2 missing on Win10** — users see a blank window. Bundle the WebView2 Evergreen installer with the `.msi` if you care about Win10 parity.
- **MSVC required** — `cargo build` fails without the VS 2022 Build Tools' C++ workload.

---

## Linux (Tauri desktop)

System-audio capture via PipeWire / PulseAudio monitor source is stubbed. Mic capture works.

### Develop

```bash
cargo tauri dev
```

### Production build

```bash
cargo tauri build
```

Produces `.AppImage` (universal Linux) and `.deb` (Debian/Ubuntu) in `src-tauri/target/release/bundle/`.

### Distribute

- `.AppImage`: runs on most distros without install. Upload to GitHub Releases.
- `.deb`: install via `sudo dpkg -i audio-layer_*.deb`. For broader reach, publish to a PPA or Flatpak.
- Flatpak / Snap: separate packaging; not scoped in this repo.

---

## iOS (Capacitor mobile)

Mic-only via the WebView's `getUserMedia`. System-audio is structurally limited on iOS (see mobile/README.md).

### First-time setup

On a Mac with Xcode + cocoapods installed:

```bash
# From repo root
bash mobile/setup.sh
```

This runs `npx cap add ios`, patches `ios/App/App/Info.plist` with `NSMicrophoneUsageDescription` + `UIBackgroundModes[audio]` + the localhost ATS exception, and runs `npx cap sync`.

### Develop

```bash
# Terminal 1 — run the web backend locally
pnpm dev

# Terminal 2 — open Xcode
npx cap open ios
```

In Xcode:
1. Select the App target → Signing & Capabilities → pick your Apple ID as the signing team.
2. Pick a simulator (iPhone 15 Pro recommended) or a physical device.
3. Click Run (⌘R).

The WebView loads `http://localhost:3000` (via `capacitor.config.ts` server.url) and every route works. The mic prompt fires on first `/record` use.

### Physical device builds

Free Apple Developer account lets you install on one device for 7 days. For unlimited + TestFlight, pay $99/yr.

1. Plug in the iPhone.
2. Xcode → device dropdown → your phone.
3. Run. First launch: Settings → General → VPN & Device Management → trust your dev cert.

### Production build (App Store)

1. Xcode → Product → Archive.
2. Distribute via Organizer → App Store Connect → Upload.
3. App Store Connect (appstoreconnect.apple.com):
   - Create app (bundle ID `com.mirrorfactory.audiolayer`).
   - Fill in screenshots, description, privacy info (mic usage explained).
   - TestFlight tab → add internal + external testers.
4. Submit for review.

For **TestFlight only** (skip store review): just upload the archive; within hours it's testable.

### Icons + splash

```bash
# After placing a 1024×1024 source at public/icons/icon-source.png:
npm i -D @capacitor/assets
npx @capacitor/assets generate --ios --icon-background "#0a0a0a"
```

### Known gotchas

- **Magic-link sign-in fails on first device build** — Supabase doesn't know your iOS app's URL scheme yet. Either use email + universal links (preferred), or sign in on the web first and let the cookie session carry.
- **Mic prompt doesn't appear** — likely `NSMicrophoneUsageDescription` missing from Info.plist. Re-run `python3 mobile/patches/apply-ios-plist.py ios/App/App/Info.plist`.
- **ATS blocks localhost** — the patcher adds the exception, but if Xcode has the plist cached in a previous build, clean (`Product → Clean Build Folder`) and rebuild.

---

## Android (Capacitor mobile)

Mic via the WebView's `getUserMedia`. The `apply-mainactivity.sh` patch adds the `onPermissionRequest` override without which `getUserMedia` silently rejects.

### First-time setup

```bash
# Ensure ANDROID_HOME is set (see Prerequisites)
bash mobile/setup.sh
```

This runs `npx cap add android`, patches `AndroidManifest.xml` with `RECORD_AUDIO` + `MODIFY_AUDIO_SETTINGS`, sets `usesCleartextTraffic=true` on `<application>` (dev only), patches `MainActivity` with the WebChromeClient override, and runs `npx cap sync`.

### Develop

```bash
# Terminal 1 — run web backend
pnpm dev

# Terminal 2 — open Android Studio
npx cap open android
```

In Android Studio:
1. Wait for Gradle sync (first time: ~5 min).
2. Tools → Device Manager → create an AVD (Pixel 8 API 34 recommended) or plug in a physical device with USB debugging enabled.
3. Click Run (▶).

The WebView loads localhost via the dev-mode cleartext exception.

### Physical device build

```bash
# Enable USB debugging: Settings → About → tap Build Number 7 times → Developer options → USB debugging on
# Plug in device, accept the host key prompt

npx cap run android --target=<device-id>
# Or click the device in Android Studio's dropdown and Run
```

### Production build (Play Store)

1. Android Studio → Build → Generate Signed Bundle → Android App Bundle (.aab).
2. First time: create a new keystore — KEEP THE KEYSTORE FILE + PASSWORD SAFE. Losing it means you can never update the app.
3. Build: Android Studio produces `app-release.aab`.
4. Play Console (play.google.com/console):
   - Create app (package name `com.mirrorfactory.audiolayer`).
   - Fill in store listing, privacy policy, data safety (declare mic usage).
   - Upload the `.aab` to Internal Testing first, then promote.

### Release signing

Play Store requires signed builds. After generating the keystore:
```
android/keystore.properties:
  storeFile=../keystore.jks
  storePassword=...
  keyAlias=upload
  keyPassword=...
```
Add `android/keystore.properties` to `.gitignore`. Reference it in `android/app/build.gradle`.

### Icons + splash

```bash
npx @capacitor/assets generate --android --icon-background "#0a0a0a"
```

### Known gotchas

- **Gradle sync fails with "SDK location not found"** — `ANDROID_HOME` isn't exported, or `android/local.properties` is missing. Android Studio will offer to create the file on first open.
- **"Couldn't find com.android.tools.build:gradle"** — update Android Studio's Gradle plugin to the version Capacitor 8 expects.
- **Cleartext traffic blocked in release** — our patcher sets `usesCleartextTraffic=true` for dev. For release, point `capacitor.config.ts` server.url at HTTPS.
- **getUserMedia still rejects after patch** — the WebView itself needs the permission. Verify `android.permission.RECORD_AUDIO` is in the manifest AND `MainActivity` has the `onPermissionRequest` override.

---

## PWA

The app is a PWA out of the box via `public/manifest.webmanifest` + Next.js metadata.

### Install — Desktop (Chrome, Edge, Arc)

Visit the live URL → URL bar → install icon → "Install audio-layer". Runs in its own window.

### Install — iOS Safari

Visit the URL → Share → Add to Home Screen. Launches fullscreen without the Safari chrome.

**iOS PWA limitations:**
- Push notifications require iOS 16.4+.
- Mic access via `getUserMedia` works.
- Background audio does NOT work — iOS suspends PWAs when backgrounded.

### Install — Android Chrome

Visit → Chrome offers an install banner → tap. Runs like a native app.

---

## CI / automated builds

Not yet wired. Recommended next step:

GitHub Actions matrix that builds all three desktop targets per release:

```yaml
# .github/workflows/release.yml (sketch)
jobs:
  release:
    strategy:
      matrix:
        include:
          - platform: macos-latest
          - platform: ubuntu-latest
          - platform: windows-latest
    runs-on: ${{ matrix.platform }}
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: dtolnay/rust-toolchain@stable
      - run: pnpm install
      - run: cargo tauri build
      - uses: softprops/action-gh-release@v1
        with:
          files: src-tauri/target/release/bundle/**/*
```

iOS + Android CI need hosted Mac (for Xcode) + JDK setup — typically run on a dedicated Mac mini or a service like EAS Build (for Expo) / Codemagic / Bitrise. Worth setting up once there's enough platform-specific churn to justify it.

---

## When each platform is ready

| Platform | Status | Blocker |
|---|---|---|
| Web | ✅ Ready for production | — |
| macOS | 🟡 Code written, not compiled here | Needs `cargo tauri dev` on a Mac; `extract_float_samples` TODO in VERIFICATION_GAPS #12 |
| Windows | 🟡 Code written, not compiled | Rust compile verification + WASAPI loopback not implemented yet |
| Linux | 🟡 Code written, not compiled | Rust compile verification + PipeWire monitor not implemented yet |
| iOS | 🟡 Scaffold only | `bash mobile/setup.sh` on a Mac with Xcode |
| Android | 🟡 Scaffold only | `bash mobile/setup.sh` with Android SDK |
| PWA | ✅ Ready | — |

Green = tested end-to-end in the build environment. Yellow = code in place, needs platform-specific toolchain to verify.
