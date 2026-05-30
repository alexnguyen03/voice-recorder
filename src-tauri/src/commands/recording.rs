use std::sync::Mutex;
use tauri::State;
use crate::core::models::{AppError, DeviceInfo, RecordConfig};
use crate::infra::CpalRecorder;
use crate::core::traits::AudioRecorder;

// State wrapper holding the CpalRecorder to manage its lifecycle via Tauri State
pub struct RecorderState {
    pub recorder: Mutex<CpalRecorder>,
}

#[tauri::command]
pub fn list_audio_devices(
    state: State<'_, RecorderState>,
) -> Result<Vec<DeviceInfo>, String> {
    let recorder = state.recorder.lock().map_err(|e| e.to_string())?;
    recorder.list_devices()
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn start_audio_recording(
    state: State<'_, RecorderState>,
    config: RecordConfig,
) -> Result<(), String> {
    let mut recorder = state.recorder.lock().map_err(|e| e.to_string())?;
    recorder.start_recording(&config)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn stop_audio_recording(
    state: State<'_, RecorderState>,
) -> Result<String, String> {
    let mut recorder = state.recorder.lock().map_err(|e| e.to_string())?;
    let _buffer = recorder.stop_recording()
        .map_err(|e| e.to_string())?;
    
    // SKELETON: Will chain call AudioStorage to encode and save WAV file,
    // then return the actual saved absolute file path string.
    Ok("path/to/recorded_voice.wav".to_string())
}
