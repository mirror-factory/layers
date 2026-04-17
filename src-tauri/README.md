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

## Native audio roadmap

The browser already gets mic via `getUserMedia`. What the desktop
shell adds is system-audio loopback so the user doesn't need to mix
mic + speaker output manually:

- **macOS** (13+): `screencapturekit-rs` for system audio,
  `cpal` for mic. Requires Microphone + Screen Recording permissions
  (declared in `Info.plist`).
- **Windows**: `wasapi` crate for loopback + mic. Mic permission only.
- **Linux**: `cpal` for mic + a PulseAudio / PipeWire monitor source
  for system audio.

Captured audio is downsampled to 16 kHz int16 LE in Rust (cleaner than
the JS AudioWorklet path) and emitted to the JS layer via a
`tauri::ipc::Channel`. The existing `LiveRecorder` component branches
on `window.__TAURI__` to feed the channel into `StreamingTranscriber`
in place of (or in addition to) the browser mic stream.

## Icons

Tauri requires platform-specific icon sizes in `src-tauri/icons/`.
Generate them once when we have a brand:

```bash
cargo tauri icon path/to/source-1024x1024.png
```
