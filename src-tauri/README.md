# src-tauri — desktop shell

The macOS / Windows / Linux native shell for audio-layer. V1 is a
**scaffold only**: it wraps the hosted Next.js app in an OS webview.
System-audio capture (the real Granola differentiator) is staged for
a separate PR — the Rust `start_system_audio_capture` command currently
returns a "not implemented" error, intentionally, so the browser
fallback (mic-only via AudioWorklet on `/record/live`) keeps working.

## Why Tauri (not Electron)

- **Bundle size**: ~10 MB (Tauri) vs ~120 MB (Electron). Important for
  desktop-app downloads.
- **Memory**: uses the OS webview, no duplicate Chromium.
- **Native bridge**: Rust is a cleaner home for Core Audio /
  ScreenCaptureKit / WASAPI than Node native modules.

## Prerequisites

You need the Rust toolchain plus platform-specific deps:

- macOS: Xcode Command Line Tools (`xcode-select --install`)
- Windows: WebView2 + the C++ build tools
- Linux: webkit2gtk + libssl-dev (see Tauri docs for your distro)

Then install the Tauri CLI:

```bash
cargo install tauri-cli --version "^2.0"
```

## Develop

From the repo root:

```bash
cargo tauri dev
```

This runs `pnpm dev` (Next.js on :3000) and opens a native window
pointed at it. The window's webview is the same Chromium-based runtime
as the browser, so `/record/live`, AudioWorklet, and the AssemblyAI
streaming WebSocket all work unchanged.

## Build

```bash
cargo tauri build
```

Produces signed installers in `src-tauri/target/release/bundle/`.

## Native audio status

**Implemented (this commit):**

- `start_mic_capture(channel)` / `stop_mic_capture()` — opens the
  default input device via `cpal` (CoreAudio on macOS, WASAPI on
  Windows, ALSA / PulseAudio / PipeWire on Linux), sums to mono,
  decimates to 16 kHz with the same linear interpolator the JS
  worklet uses, packs to int16 LE, and ships ~150 ms chunks back
  through a `tauri::ipc::Channel<Vec<u8>>`.
- The browser-side `LiveRecorder` component (`components/
  live-recorder.tsx`) detects `window.__TAURI__` and prefers this
  channel over the AudioWorklet path. It still falls back to
  `getUserMedia` automatically in any normal browser.

**Honest disclaimer:** this Rust code was authored against the
cpal 0.15 + Tauri 2 docs; it has NOT been compiled or run from
this environment (no Rust toolchain available). `cargo tauri dev`
on a real workstation is the verification path.

**Not yet implemented — system-audio loopback:**

- **macOS** (15+): `screencapturekit` crate. Requires Screen
  Recording permission declared in `Info.plist`.
- **Windows**: `wasapi` crate (loopback flag).
- **Linux**: PipeWire monitor source (or PulseAudio `monitor`
  device exposed via `cpal`).

The plumbing on the JS side is ready — the `LiveRecorder` mixes
whatever PCM the channel emits, so adding system-audio capture
later is a Rust-only change (start/stop_system_audio_capture
currently return an explicit "not implemented" error).

## Icons

Tauri requires platform-specific icon sizes in `src-tauri/icons/`.
Generate them once when we have a brand:

```bash
cargo tauri icon path/to/source-1024x1024.png
```
