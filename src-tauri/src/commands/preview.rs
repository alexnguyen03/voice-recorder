use tauri::{AppHandle, Manager};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use crate::infra::{LocalStorage, DspPipelineBuilder, PipelineConfig, VoiceLayerEngine, VoiceLayerOptions};
use crate::core::traits::AudioStorage;

/// Filter parameter set — serialized to/from the .meta.json sidecar file.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FilterParams {
    pub bass_boost: f32,
    pub treble_boost: f32,
    pub volume_boost: f32,
    pub noise_suppression: bool,
    pub noise_gate_sensitivity: f32,
    pub mic_eq_enhancement: bool,
    #[serde(default)]
    pub ml_voice_layers_enabled: bool,
    #[serde(default)]
    pub reduce_sibilance: bool,
    #[serde(default)]
    pub reduce_breath: bool,
    #[serde(default)]
    pub breath_sensitivity: f32,
    #[serde(default)]
    pub reduce_plosive: bool,
    #[serde(default)]
    pub plosive_sensitivity: f32,
    #[serde(default)]
    pub smooth_voice_cutoff: bool,
    #[serde(default)]
    pub wind_suppression: bool,
    #[serde(default)]
    pub wind_intensity: f32,
    #[serde(default)]
    pub mid_cut_freq: f32,
    #[serde(default)]
    pub mid_cut_q: f32,
    #[serde(default)]
    pub mid_cut_gain_db: f32,
    #[serde(default)]
    pub de_hiss_enabled: bool,
}

/// Full preview sidecar metadata — written alongside the processed preview WAV.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PreviewMeta {
    pub version: u32,
    pub source_file: String,
    pub preview_file: String,
    pub filters: FilterParams,
}

// ── Helpers ──────────────────────────────────────────────────────────────────

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

fn preview_paths(app: &AppHandle, file_path: &str) -> Result<(PathBuf, PathBuf), String> {
    let dir = preview_dir(app)?;
    let src = std::path::Path::new(file_path);
    let stem = src
        .file_stem()
        .ok_or_else(|| format!("Cannot derive file stem from: {}", file_path))?
        .to_string_lossy()
        .to_string();
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

/// Processes the source WAV through the full 10-stage Rust DSP pipeline and writes:
///   • `<stem>.preview.wav`  — processed audio (becomes the player source)
///   • `<stem>.meta.json`    — filter params so the session can be restored later
///
/// Returns the absolute path to the preview WAV.
#[tauri::command]
pub fn create_preview(
    app: AppHandle,
    file_path: String,
    // Noise & Wind
    enable_noise_suppression: bool,
    noise_gate_sensitivity: f32,
    wind_suppression: bool,
    wind_intensity: f32,
    de_hiss_enabled: bool,
    // Breath & Plosive
    reduce_breath: bool,
    breath_sensitivity: f32,
    reduce_plosive: bool,
    plosive_sensitivity: f32,
    // EQ
    bass_boost: f32,
    treble_boost: f32,
    mid_cut_freq: f32,
    mid_cut_q: f32,
    mid_cut_gain_db: f32,
    // Volume & Mic
    volume_boost: f32,
    mic_eq_enhancement: bool,
    // Voice Layer (ML)
    ml_voice_layers_enabled: bool,
    reduce_sibilance: bool,
    smooth_voice_cutoff: bool,
) -> Result<String, String> {
    let storage = LocalStorage::new();
    let voice_layers = VoiceLayerEngine::new();

    // 1. Load original PCM
    let mut buffer = storage.load_file(&file_path).map_err(|e| e.to_string())?;
    let sample_rate = buffer.sample_rate as f32;
    let channels    = buffer.channels;

    // 2. Voice layer processing (ML vocal focus, sibilance, smooth cutoff)
    voice_layers.process(
        &app,
        &mut buffer,
        VoiceLayerOptions {
            ml_voice_layers_enabled,
            reduce_sibilance,
            reduce_breath: false,   // handled by BreathSuppressor in pipeline
            reduce_plosive: false,  // handled by PlosiveReducer in pipeline
            smooth_voice_cutoff,
        },
    )?;

    // 3. Build and run the full 10-stage DSP pipeline
    let config = PipelineConfig {
        sample_rate,
        channels,
        wind_suppression,
        wind_intensity,
        noise_suppression: enable_noise_suppression,
        noise_gate_sensitivity,
        de_hiss_enabled,
        reduce_breath,
        breath_sensitivity,
        reduce_plosive,
        plosive_sensitivity,
        mic_eq_enhancement,
        bass_boost,
        treble_boost,
        mid_cut_freq,
        mid_cut_q,
        mid_cut_gain_db,
        volume_boost,
    };

    let mut pipeline = DspPipelineBuilder::new(config).build_standard();
    buffer.samples = pipeline.process(&buffer.samples);

    // 4. Write processed WAV
    let (preview_path, meta_path) = preview_paths(&app, &file_path)?;
    let preview_str = preview_path.to_string_lossy().to_string();
    storage.save_file(&buffer, &preview_str).map_err(|e| e.to_string())?;

    // 5. Write meta sidecar (version bumped to 4 for new schema)
    let meta = PreviewMeta {
        version: 4,
        source_file: file_path,
        preview_file: preview_str.clone(),
        filters: FilterParams {
            bass_boost,
            treble_boost,
            volume_boost,
            noise_suppression: enable_noise_suppression,
            noise_gate_sensitivity,
            mic_eq_enhancement,
            ml_voice_layers_enabled,
            reduce_sibilance,
            reduce_breath,
            breath_sensitivity,
            reduce_plosive,
            plosive_sensitivity,
            smooth_voice_cutoff,
            wind_suppression,
            wind_intensity,
            mid_cut_freq,
            mid_cut_q,
            mid_cut_gain_db,
            de_hiss_enabled,
        },
    };
    let json = serde_json::to_string_pretty(&meta)
        .map_err(|e| format!("Failed to serialize preview meta: {}", e))?;
    std::fs::write(&meta_path, json)
        .map_err(|e| format!("Failed to write preview meta: {}", e))?;

    Ok(preview_str)
}

#[tauri::command]
pub fn load_preview_meta(
    app: AppHandle,
    file_path: String,
) -> Result<Option<PreviewMeta>, String> {
    let (preview_path, meta_path) = preview_paths(&app, &file_path)?;
    if !preview_path.exists() || !meta_path.exists() { return Ok(None); }
    let json = std::fs::read_to_string(&meta_path)
        .map_err(|e| format!("Failed to read preview meta: {}", e))?;
    let meta: PreviewMeta = serde_json::from_str(&json)
        .map_err(|e| format!("Failed to parse preview meta: {}", e))?;
    if meta.source_file != file_path { return Ok(None); }
    Ok(Some(meta))
}

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
