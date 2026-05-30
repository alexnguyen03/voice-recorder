use std::sync::Mutex;
use tauri::{State, AppHandle, Manager};
use crate::core::models::{AppError, DeviceInfo, RecordConfig};
use crate::infra::{CpalRecorder, LocalStorage};
use crate::core::traits::{AudioRecorder, AudioStorage};

// Thread-safe wrapper holding the CpalRecorder for Tauri IPC State management
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
    app: AppHandle,
    state: State<'_, RecorderState>,
) -> Result<String, String> {
    let mut recorder = state.recorder.lock().map_err(|e| e.to_string())?;
    
    // Stop cpal capture stream and harvest raw PCM float samples
    let buffer = recorder.stop_recording().map_err(|e| e.to_string())?;

    // Dynamically resolve target folder: standard User Documents/VoiceRecorder/
    let doc_dir = app.path().document_dir().map_err(|e| format!("Failed to find Documents dir: {}", e))?;
    let mut recordings_dir = doc_dir;
    recordings_dir.push("VoiceRecorder");

    // Ensure the folder exists on filesystem
    std::fs::create_dir_all(&recordings_dir).map_err(|e| format!("Failed to create folder: {}", e))?;

    // Draft unique file path using system timestamp
    let epoch = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    
    let file_path = recordings_dir.join(format!("recording_{}.wav", epoch));
    let file_path_str = file_path.to_string_lossy().to_string();

    // Persist raw WAV file instantly via standard LocalStorage hound specs
    let storage = LocalStorage::new();
    storage.save_file(&buffer, &file_path_str).map_err(|e| e.to_string())?;

    Ok(file_path_str)
}
