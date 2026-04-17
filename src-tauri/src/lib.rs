// audio-layer desktop shell — Tauri commands for the JS layer.
//
// V1 surface:
//   - start_mic_capture(channel)  — open the default mic, downsample
//     to 16 kHz int16 LE, push ~150 ms PCM chunks back through a
//     tauri::ipc::Channel<Vec<u8>>.
//   - stop_mic_capture()          — stop the active stream.
//   - start_system_audio_capture, stop_system_audio_capture — STUBS.
//     System-audio loopback is platform-specific (ScreenCaptureKit
//     on macOS, WASAPI loopback on Windows, PulseAudio/PipeWire
//     monitor on Linux). Tracked for the next desktop PR.
//
// Honesty disclaimer: this code is written against cpal 0.15 +
// Tauri 2 docs and was NOT compiled in the original commit (no Rust
// toolchain available in the build environment). `cargo tauri dev`
// is the verification path on a real workstation.

use std::sync::{Arc, Mutex};

use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{Sample, SampleFormat, Stream, StreamConfig};
use tauri::ipc::Channel;
use tauri::State;

const TARGET_SAMPLE_RATE: f32 = 16_000.0;
const CHUNK_DURATION_MS: usize = 150;

/// Handle to the active capture stream. We keep the cpal Stream
/// pinned in state because dropping it stops capture.
#[derive(Default)]
struct CaptureState {
    stream: Mutex<Option<Stream>>,
}

#[tauri::command]
fn ping() -> String {
    "pong".to_string()
}

/// Open the default input device and stream 16 kHz int16 LE PCM
/// frames through the supplied IPC channel. The frontend can wire
/// these straight into the AssemblyAI streaming WebSocket; the
/// shape matches what `public/worklets/pcm-downsampler.js` already
/// produces.
#[tauri::command]
fn start_mic_capture(
    state: State<'_, CaptureState>,
    on_chunk: Channel<Vec<u8>>,
) -> Result<(), String> {
    let mut slot = state.stream.lock().map_err(|e| e.to_string())?;
    if slot.is_some() {
        return Err("mic capture is already running".to_string());
    }

    let host = cpal::default_host();
    let device = host
        .default_input_device()
        .ok_or_else(|| "no default input device available".to_string())?;

    let supported = device
        .default_input_config()
        .map_err(|e| format!("default_input_config failed: {e}"))?;

    let input_rate = supported.sample_rate().0 as f32;
    let channels = supported.channels() as usize;
    let sample_format = supported.sample_format();
    let config: StreamConfig = supported.into();

    // Buffer enough samples for one ~150 ms output chunk.
    let chunk_samples = ((TARGET_SAMPLE_RATE * CHUNK_DURATION_MS as f32) / 1000.0) as usize;
    let buffer = Arc::new(Mutex::new(Vec::<i16>::with_capacity(chunk_samples)));
    let ratio = input_rate / TARGET_SAMPLE_RATE;
    let source_offset = Arc::new(Mutex::new(0.0_f32));

    let err_fn = |err| eprintln!("[audio-layer] cpal stream error: {err}");

    let make_callback = move |on_chunk: Channel<Vec<u8>>| {
        let buf = Arc::clone(&buffer);
        let off = Arc::clone(&source_offset);
        move |samples: &[f32]| {
            // Mono mix-down (sum then average across interleaved channels).
            let mut mono = Vec::with_capacity(samples.len() / channels.max(1));
            for frame in samples.chunks(channels.max(1)) {
                let mut acc = 0.0_f32;
                for &s in frame {
                    acc += s;
                }
                mono.push(acc / frame.len() as f32);
            }

            // Linear-interpolation decimation; mirrors the JS worklet.
            let mut out = buf.lock().expect("buffer lock");
            let mut offset = off.lock().expect("offset lock");
            let mut idx = *offset;
            while idx < mono.len() as f32 {
                let i0 = idx.floor() as usize;
                let i1 = (i0 + 1).min(mono.len().saturating_sub(1));
                let frac = idx - idx.floor();
                let s = mono[i0] * (1.0 - frac) + mono[i1] * frac;
                let clamped = s.clamp(-1.0, 1.0);
                let pcm = if clamped < 0.0 {
                    (clamped * (i16::MIN as f32).abs()) as i16
                } else {
                    (clamped * i16::MAX as f32) as i16
                };
                out.push(pcm);
                if out.len() >= chunk_samples {
                    let chunk: Vec<u8> = out
                        .iter()
                        .flat_map(|&v| v.to_le_bytes())
                        .collect();
                    out.clear();
                    if let Err(err) = on_chunk.send(chunk) {
                        eprintln!("[audio-layer] failed to send chunk: {err}");
                    }
                }
                idx += ratio;
            }
            *offset = idx - mono.len() as f32;
        }
    };

    let stream = match sample_format {
        SampleFormat::F32 => {
            let cb = make_callback(on_chunk.clone());
            device
                .build_input_stream(
                    &config,
                    move |data: &[f32], _| cb(data),
                    err_fn,
                    None,
                )
                .map_err(|e| format!("build_input_stream(f32) failed: {e}"))?
        }
        SampleFormat::I16 => {
            let cb = make_callback(on_chunk.clone());
            device
                .build_input_stream(
                    &config,
                    move |data: &[i16], _| {
                        let floats: Vec<f32> =
                            data.iter().map(|s| s.to_float_sample()).collect();
                        cb(&floats);
                    },
                    err_fn,
                    None,
                )
                .map_err(|e| format!("build_input_stream(i16) failed: {e}"))?
        }
        SampleFormat::U16 => {
            let cb = make_callback(on_chunk.clone());
            device
                .build_input_stream(
                    &config,
                    move |data: &[u16], _| {
                        let floats: Vec<f32> =
                            data.iter().map(|s| s.to_float_sample()).collect();
                        cb(&floats);
                    },
                    err_fn,
                    None,
                )
                .map_err(|e| format!("build_input_stream(u16) failed: {e}"))?
        }
        other => return Err(format!("unsupported sample format: {other:?}")),
    };

    stream.play().map_err(|e| format!("play failed: {e}"))?;
    *slot = Some(stream);
    Ok(())
}

#[tauri::command]
fn stop_mic_capture(state: State<'_, CaptureState>) -> Result<(), String> {
    let mut slot = state.stream.lock().map_err(|e| e.to_string())?;
    *slot = None;
    Ok(())
}

#[tauri::command]
fn start_system_audio_capture() -> Result<(), String> {
    Err(
        "not implemented: system-audio loopback is platform-specific. Roadmap: ScreenCaptureKit (macOS 15+), WASAPI loopback (Windows), PipeWire monitor (Linux)."
            .to_string(),
    )
}

#[tauri::command]
fn stop_system_audio_capture() -> Result<(), String> {
    Err("not implemented".to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(CaptureState::default())
        .invoke_handler(tauri::generate_handler![
            ping,
            start_mic_capture,
            stop_mic_capture,
            start_system_audio_capture,
            stop_system_audio_capture
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
