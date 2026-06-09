use std::sync::{Arc, Mutex};
use tauri::{State, AppHandle, Manager, Emitter};
use serde::Serialize;
use crate::core::models::{DeviceInfo, RecordConfig};
use crate::infra::{AudioAnalysis, AudioAnalyzer, CpalRecorder, LocalStorage};
use crate::core::traits::{AudioRecorder, AudioStorage};

/// Metadata for a single recording file.
#[derive(Debug, Clone, Serialize)]
pub struct RecordingInfo {
    pub path:            String,
    pub duration_secs:   f64,
    pub file_size_bytes: u64,
    /// Unix epoch (seconds) parsed from filename like `recording_<epoch>.wav`,
    /// or falls back to file-system modified time.
    pub created_at_secs: u64,
    pub analysis: Option<AudioAnalysis>,
}

/// Read lightweight metadata for a list of recording paths.
/// Uses `hound` to read only the WAV header (no full decode) for fast duration.
#[tauri::command]
pub async fn get_recordings_info(file_paths: Vec<String>) -> Vec<RecordingInfo> {
    tauri::async_runtime::spawn_blocking(move || {
        file_paths
            .into_iter()
            .filter_map(|path| {
                let fs_meta = std::fs::metadata(&path).ok()?;
                let file_size_bytes = fs_meta.len();

                // Duration from WAV header only — no full PCM decode here
                let duration_secs = hound::WavReader::open(&path)
                    .ok()
                    .map(|r| {
                        let spec = r.spec();
                        r.duration() as f64 / spec.sample_rate as f64
                    })
                    .unwrap_or(0.0);

                // Creation time: prefer epoch embedded in filename, else file mtime
                let created_at_secs = std::path::Path::new(&path)
                    .file_stem()
                    .and_then(|s| s.to_str())
                    .and_then(|s| s.strip_prefix("recording_"))
                    .and_then(|s| s.parse::<u64>().ok())
                    .unwrap_or_else(|| {
                        fs_meta.modified().ok()
                            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                            .map(|d| d.as_secs())
                            .unwrap_or(0)
                    });

                // analysis field is None — fetched separately via analyze_audio when needed
                Some(RecordingInfo { path, duration_secs, file_size_bytes, created_at_secs, analysis: None })
            })
            .collect()
    })
    .await
    .unwrap_or_default()
}

#[tauri::command]
pub async fn analyze_audio(file_path: String) -> Result<AudioAnalysis, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let storage = LocalStorage::new();
        let buffer = storage.load_file(&file_path).map_err(|e| e.to_string())?;
        Ok(AudioAnalyzer::analyze(&buffer))
    })
    .await
    .map_err(|e| e.to_string())?
}


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
    app: AppHandle,
    state: State<'_, RecorderState>,
    config: RecordConfig,
) -> Result<(), String> {
    let mut recorder = state.recorder.lock().map_err(|e| e.to_string())?;
    
    // Create Arc-wrapped closure callback to emit real-time amplitude events
    let app_clone = app.clone();
    let on_amplitude = Arc::new(move |amplitude: f32| {
        let _ = app_clone.emit("audio-amplitude", amplitude);
    });

    recorder.start_recording(&config, Some(on_amplitude))
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

#[tauri::command]
pub fn list_recorded_files(app: AppHandle) -> Result<Vec<String>, String> {
    let doc_dir = app.path().document_dir().map_err(|e| format!("Failed to find Documents dir: {}", e))?;
    let mut recordings_dir = doc_dir;
    recordings_dir.push("VoiceRecorder");

    if !recordings_dir.exists() {
        return Ok(Vec::new());
    }

    let entries = std::fs::read_dir(recordings_dir).map_err(|e| e.to_string())?;
    let mut files = Vec::new();
    for entry in entries {
        if let Ok(entry) = entry {
            let path = entry.path();
            if path.is_file() && path.extension().map(|s| s == "wav").unwrap_or(false) {
                files.push(path.to_string_lossy().to_string());
            }
        }
    }

    // Sort newer files (by name which contains timestamp) to the top
    files.sort_by(|a, b| b.cmp(a));
    Ok(files)
}

#[tauri::command]
pub fn pause_audio_recording(
    state: State<'_, RecorderState>,
) -> Result<(), String> {
    let mut recorder = state.recorder.lock().map_err(|e| e.to_string())?;
    recorder.pause_recording().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn resume_audio_recording(
    state: State<'_, RecorderState>,
) -> Result<(), String> {
    let mut recorder = state.recorder.lock().map_err(|e| e.to_string())?;
    recorder.resume_recording().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn discard_audio_recording(
    state: State<'_, RecorderState>,
) -> Result<(), String> {
    let mut recorder = state.recorder.lock().map_err(|e| e.to_string())?;
    let _ = recorder.stop_recording().map_err(|e| e.to_string())?;
    Ok(())
}

/// Delete a saved recording file from disk.
/// Also removes associated sidecar files: _preview.wav, _preview.json,
/// _vocals.wav, _accompaniment.wav if they exist.
#[tauri::command]
pub fn delete_recording(file_path: String) -> Result<(), String> {
    let path = std::path::Path::new(&file_path);
    if !path.exists() {
        return Err(format!("File not found: {}", file_path));
    }

    // Remove the main file
    std::fs::remove_file(path)
        .map_err(|e| format!("Failed to delete recording: {}", e))?;

    // Clean up associated sidecar files (best-effort, no error if missing)
    let base = file_path.trim_end_matches(".wav");
    let sidecars = [
        format!("{}_preview.wav",        base),
        format!("{}_preview.json",       base),
        format!("{}_vocals.wav",         base),
        format!("{}_accompaniment.wav",  base),
    ];
    for sidecar in &sidecars {
        let _ = std::fs::remove_file(sidecar); // ignore errors
    }

    Ok(())
}
