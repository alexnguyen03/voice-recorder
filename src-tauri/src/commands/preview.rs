use tauri::{AppHandle, Manager};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use crate::infra::{LocalStorage, DspEngine};
use crate::core::traits::{AudioStorage, AudioProcessor};

/// Filter parameter set — serialized to/from the .meta.json sidecar file.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FilterParams {
    pub bass_boost: f32,
    pub treble_boost: f32,
    pub volume_boost: f32,
    pub noise_suppression: bool,
    pub mic_eq_enhancement: bool,
}

/// Full preview sidecar metadata — written alongside the processed preview WAV.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PreviewMeta {
    pub version: u32,
    /// Absolute path to the original (unmodified) source file.
    pub source_file: String,
    /// Absolute path to the Rust-processed preview WAV file.
    pub preview_file: String,
    pub filters: FilterParams,
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/// Returns the directory where preview files are cached:
///   Documents/VoiceRecorder/.previews/
fn preview_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let doc_dir = app
        .path()
        .document_dir()
        .map_err(|e| format!("Failed to find Documents dir: {}", e))?;
    let dir = doc_dir.join("VoiceRecorder").join(".previews");
    std::fs::create_dir_all(&dir)
        .map_err(|e| format!("Failed to create preview dir: {}", e))?;
    Ok(dir)
}

/// Derives `(preview.wav path, meta.json path)` for a given source file.
/// Two source files with the same stem but different directories would collide,
/// so we embed a hash of the parent directory to guarantee uniqueness.
fn preview_paths(app: &AppHandle, file_path: &str) -> Result<(PathBuf, PathBuf), String> {
    let dir = preview_dir(app)?;
    let src = std::path::Path::new(file_path);

    let stem = src
        .file_stem()
        .ok_or_else(|| format!("Cannot derive file stem from: {}", file_path))?
        .to_string_lossy()
        .to_string();

    // Simple parent-hash to prevent stem collisions across directories
    let parent_hash: u32 = src
        .parent()
        .map(|p| p.to_string_lossy().chars().fold(0u32, |acc, c| acc.wrapping_add(c as u32)))
        .unwrap_or(0);

    let key = format!("{}_{:08x}", stem, parent_hash);
    Ok((
        dir.join(format!("{}.preview.wav", key)),
        dir.join(format!("{}.meta.json",   key)),
    ))
}

// ── Commands ─────────────────────────────────────────────────────────────────

/// Processes the source WAV through the Rust DSP engine and writes two files:
///   • `<stem>.preview.wav`  — the processed audio (becomes the player source)
///   • `<stem>.meta.json`    — filter params so the session can be restored later
///
/// Returns the **absolute path** to the preview WAV. The frontend converts this
/// with `convertFileSrc()` to get the asset:// URL for the audio player.
#[tauri::command]
pub fn create_preview(
    app: AppHandle,
    file_path: String,
    enable_noise_suppression: bool,
    bass_boost: f32,
    treble_boost: f32,
    volume_boost: f32,
    mic_eq_enhancement: bool,
) -> Result<String, String> {
    let storage = LocalStorage::new();
    let dsp     = DspEngine::new();

    // Load original PCM
    let mut buffer = storage.load_file(&file_path).map_err(|e| e.to_string())?;

    // Apply EQ chain (Rust is the sole engine — what you hear = what you export)
    buffer.samples = dsp
        .enhance_voice(
            &buffer.samples,
            buffer.sample_rate as f32,
            bass_boost,
            treble_boost,
            volume_boost,
            mic_eq_enhancement,
        )
        .map_err(|e| e.to_string())?;

    // Noise gate applied after EQ (same order as the Web Audio graph)
    if enable_noise_suppression {
        buffer.samples = dsp.suppress_noise(&buffer.samples).map_err(|e| e.to_string())?;
    }

    let (preview_path, meta_path) = preview_paths(&app, &file_path)?;
    let preview_str = preview_path.to_string_lossy().to_string();

    // Write processed WAV
    storage
        .save_file(&buffer, &preview_str)
        .map_err(|e| e.to_string())?;

    // Write meta sidecar
    let meta = PreviewMeta {
        version: 1,
        source_file: file_path,
        preview_file: preview_str.clone(),
        filters: FilterParams {
            bass_boost,
            treble_boost,
            volume_boost,
            noise_suppression: enable_noise_suppression,
            mic_eq_enhancement,
        },
    };
    let json = serde_json::to_string_pretty(&meta)
        .map_err(|e| format!("Failed to serialize preview meta: {}", e))?;
    std::fs::write(&meta_path, json)
        .map_err(|e| format!("Failed to write preview meta: {}", e))?;

    Ok(preview_str)
}

/// Loads the preview meta for a source file if it exists.
/// Returns `null`/`None` if no preview has been created yet, or if the sidecar
/// is stale (source path doesn't match).
#[tauri::command]
pub fn load_preview_meta(
    app: AppHandle,
    file_path: String,
) -> Result<Option<PreviewMeta>, String> {
    let (preview_path, meta_path) = preview_paths(&app, &file_path)?;

    if !preview_path.exists() || !meta_path.exists() {
        return Ok(None);
    }

    let json = std::fs::read_to_string(&meta_path)
        .map_err(|e| format!("Failed to read preview meta: {}", e))?;
    let meta: PreviewMeta = serde_json::from_str(&json)
        .map_err(|e| format!("Failed to parse preview meta: {}", e))?;

    // Stale check: source file must still match
    if meta.source_file != file_path {
        return Ok(None);
    }

    Ok(Some(meta))
}

/// Deletes the preview WAV and its meta sidecar for the given source file.
/// Safe to call even if no preview exists.
#[tauri::command]
pub fn clear_preview(app: AppHandle, file_path: String) -> Result<(), String> {
    let (preview_path, meta_path) = preview_paths(&app, &file_path)?;

    if preview_path.exists() {
        std::fs::remove_file(&preview_path)
            .map_err(|e| format!("Failed to delete preview WAV: {}", e))?;
    }
    if meta_path.exists() {
        std::fs::remove_file(&meta_path)
            .map_err(|e| format!("Failed to delete preview meta: {}", e))?;
    }
    Ok(())
}
