pub mod core;
pub mod infra;
pub mod commands;

use std::sync::Mutex;
use infra::CpalRecorder;
use commands::{RecorderState, list_audio_devices, start_audio_recording, stop_audio_recording, list_recorded_files, trim_audio, apply_voice_effects, pause_audio_recording, resume_audio_recording, discard_audio_recording};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        // Khởi tạo và quản lý State dùng chung cho Recorder
        .manage(RecorderState {
            recorder: Mutex::new(CpalRecorder::new()),
        })
        .invoke_handler(tauri::generate_handler![
            list_audio_devices,
            start_audio_recording,
            stop_audio_recording,
            list_recorded_files,
            trim_audio,
            apply_voice_effects,
            pause_audio_recording,
            resume_audio_recording,
            discard_audio_recording
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
