// Hide the Windows console window in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    audio_layer_lib::run()
}
