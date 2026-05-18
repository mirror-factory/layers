# Self-Hosted Build And Native Proof

Layers can build and test on our own infrastructure instead of Codespaces.
GitHub remains the source of truth for PRs, checks, artifacts, and releases,
but the expensive compute can run on owned runners.

## Current Server Capability

The current Linux server has CPU virtualization flags visible, but this checkout
does not currently expose `/dev/kvm` and does not have Android SDK tools,
emulator, ADB, or Maestro available in PATH. That means:

- Linux/web proof can run here.
- Static native config proof can run here.
- Android emulator/native-device proof needs a Proxmox VM/host runner with KVM
  or a device cloud.
- iOS/macOS proof needs a Mac runner or device cloud.

Run:

```bash
pnpm runner:doctor
```

It writes `.evidence/runner-capability.json`.

## GitHub Runner Labels

The opt-in workflow `.github/workflows/server-proof.yml` expects:

| Label | Purpose |
| --- | --- |
| `layers-web` | Linux web proof: feature proof, tier 0-2, optional Expect |
| `layers-android` | Android proof: Android SDK, emulator/KVM, Gradle, Maestro |
| `layers-ios` | Future macOS iOS proof: Xcode, simulator/TestFlight |
| `layers-macos` | Future macOS desktop proof: Electron signing/notarization |

## Workflow Triggers

The self-hosted runner workflow does not run on every PR by default. Trigger it
with:

- manual workflow dispatch
- PR label `server:run`
- PR label `expect:run`
- PR label `proof:required`
- PR label `android:run`
- PR label `native:run`

This avoids stuck PR checks before the runners exist.

## Android Proof Path

Android native proof requires a runner where all of these are true:

- Linux runner
- `/dev/kvm` exists
- CPU virtualization flags are visible
- Android command-line tools installed: `adb`, `emulator`, `sdkmanager`
- Java 21 available
- Maestro installed

When ready, run:

```bash
ANDROID_EMULATOR_REQUIRED=1 pnpm runner:doctor
pnpm test:native:config
NATIVE_BUILD_RUN=1 NATIVE_REQUIRED=1 \
  WEB_BUILD_COMMAND="pnpm build" \
  ANDROID_BUILD_COMMAND="npx cap sync android && cd android && ./gradlew assembleDebug" \
  pnpm build:native
NATIVE_REQUIRED=1 MAESTRO_RUN=1 pnpm test:native:smoke
pnpm test:proof
```

## iOS And macOS Hold

iOS Simulator, TestFlight, and macOS Electron signing cannot run on this Linux
server. They remain blocked until a macOS self-hosted runner or device-cloud
service is connected.
