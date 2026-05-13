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
pnpm native:evidence-index
pnpm test:proof
```

If `pnpm test:native:smoke` is skipped because `MAESTRO_RUN` is not set, the
resulting `.evidence/native-smoke.json` is intentionally marked
`status=pending`, `pass=false`, and `nativeProofSatisfied=false`. That file is
coordination evidence, not device proof. Use `pnpm native:record-smoke` after a
real device, emulator, simulator, or device-cloud run to write passing native
proof with device identity, screenshot, video, and run URL/log evidence.

Run `pnpm native:evidence-index` after native/release evidence changes. It
writes `.evidence/native-evidence-index.json`, which links each native/release
artifact to the command that produced it and makes blocked emulator attempts
visible without counting them as green proof.

`pnpm native:providers` is also honest about blocked readiness. On a server with
no runnable local or cloud provider configured, it writes
`.evidence/native-provider-readiness.json` with `status=blocked` and
`pass=false`, while still exiting successfully unless `NATIVE_PROVIDER_REQUIRED=1`
is set. This lets the control plane show the blocker without treating readiness
as device proof.

## iOS And macOS Hold

iOS Simulator, TestFlight, and macOS Electron signing cannot run on this Linux
server. They remain blocked until a macOS self-hosted runner or device-cloud
service is connected.
