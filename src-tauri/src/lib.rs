// audio-layer desktop shell.
//
// V1 just hosts the Next.js webapp inside the OS webview. The Tauri
// commands below are stubs — they document the surface the browser
// will call once we wire native system-audio capture.
//
// Roadmap:
//   - macOS:   ScreenCaptureKit (system audio loopback) + AVFoundation (mic)
//   - Windows: WASAPI loopback + WaveIn for mic
//   - Linux:   cpal + PulseAudio / PipeWire loopback monitor
//
// All three feed PCM int16 LE @ 16 kHz back to the JS layer via
// `tauri::ipc::Channel`, which the existing /record/live UI can consume
// alongside the browser-mic AudioWorklet path.

#[tauri::command]
fn ping() -> String {
    "pong".to_string()
}

#[tauri::command]
fn start_system_audio_capture() -> Result<(), String> {
    Err("not implemented: system audio capture is staged for the next PR".to_string())
}

#[tauri::command]
fn stop_system_audio_capture() -> Result<(), String> {
    Err("not implemented: system audio capture is staged for the next PR".to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            ping,
            start_system_audio_capture,
            stop_system_audio_capture
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
