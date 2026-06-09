use tauri::AppHandle;
use crate::infra::{
    LocalStorage, DspPipelineBuilder, PipelineConfig, VoiceLayerEngine, VoiceLayerOptions,
    EnhanceMode, VoicePreset, apply_voice_preset,
};
use crate::core::traits::AudioStorage;

#[tauri::command]
pub async fn trim_audio(
    file_path: String,
    start_ms: u32,
    end_ms: u32,
) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let storage = LocalStorage::new();
        let mut buffer = storage.load_file(&file_path).map_err(|e| e.to_string())?;
        let sample_rate = buffer.sample_rate as f32;
        let channels    = buffer.channels as usize;
        let start_sample = ((start_ms as f32 / 1000.0) * sample_rate) as usize * channels;
        let end_sample   = ((end_ms   as f32 / 1000.0) * sample_rate) as usize * channels;
        if start_sample >= buffer.samples.len() {
            return Err("Start time is out of audio duration bounds".to_string());
        }
        let clamped_end = end_sample.min(buffer.samples.len());
        if start_sample >= clamped_end {
            return Err("Start time cannot be equal or greater than End time".to_string());
        }
        buffer.samples = buffer.samples[start_sample..clamped_end].to_vec();
        let output_path = file_path.replace(".wav", "_trimmed.wav");
        storage.save_file(&buffer, &output_path).map_err(|e| e.to_string())?;
        Ok(output_path)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn cut_audio_segment(
    file_path: String,
    start_ms: u32,
    end_ms: u32,
) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let storage = LocalStorage::new();
        let mut buffer = storage.load_file(&file_path).map_err(|e| e.to_string())?;
        let sample_rate = buffer.sample_rate as f32;
        let channels    = buffer.channels as usize;
        let start_sample = ((start_ms as f32 / 1000.0) * sample_rate) as usize * channels;
        let end_sample   = ((end_ms   as f32 / 1000.0) * sample_rate) as usize * channels;
        if start_sample >= buffer.samples.len() {
            return Err("Cut start time is out of audio duration bounds".to_string());
        }
        let clamped_end = end_sample.min(buffer.samples.len());
        if start_sample >= clamped_end {
            return Err("Cut start time cannot be equal or greater than Cut end time".to_string());
        }
        let before = buffer.samples[..start_sample].to_vec();
        let after  = buffer.samples[clamped_end..].to_vec();
        buffer.samples = [before, after].concat();
        let output_path = file_path.replace(".wav", "_cut.wav");
        storage.save_file(&buffer, &output_path).map_err(|e| e.to_string())?;
        Ok(output_path)
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Applies the full 10-stage DSP pipeline to a file and saves a new copy.
/// Uses DspPipelineBuilder — same engine as create_preview, guaranteeing
/// "what you hear in preview = what you export".
#[tauri::command]
pub async fn apply_voice_effects(
    _app: AppHandle,
    file_path: String,
    // Hum Removal
    hum_removal_enabled: bool,
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
    // V1 enhancement controls
    enhance_mode: Option<String>,
    preset: Option<String>,
    enhance_strength: Option<f32>,
    natural_clean_balance: Option<f32>,
) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let storage      = LocalStorage::new();
        let voice_layers = VoiceLayerEngine::new();

        let mut buffer = storage.load_file(&file_path).map_err(|e| e.to_string())?;
        let sample_rate = buffer.sample_rate as f32;
        let channels    = buffer.channels;

        // Full 11-stage DSP pipeline
        let mut config = PipelineConfig {
            sample_rate,
            channels,
            hum_removal_enabled,
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
        let mut voice_options = VoiceLayerOptions {
            ml_voice_layers_enabled,
            reduce_sibilance,
            reduce_breath: false,
            reduce_plosive: false,
            smooth_voice_cutoff,
        };
        apply_voice_preset(
            VoicePreset::parse(preset.as_deref()),
            EnhanceMode::parse(enhance_mode.as_deref()),
            enhance_strength.unwrap_or(0.5),
            natural_clean_balance.unwrap_or(0.5),
            &mut config,
            &mut voice_options,
        );

        // Deterministic voice cleanup layer (future AI runtime hook lives here).
        voice_layers.process_no_app(&mut buffer, voice_options)?;

        let mut pipeline = DspPipelineBuilder::new(config).build_standard();
        buffer.samples = pipeline.process(&buffer.samples);

        let output_path = file_path.replace(".wav", "_enhanced.wav");
        storage.save_file(&buffer, &output_path).map_err(|e| e.to_string())?;
        Ok(output_path)
    })
    .await
    .map_err(|e| e.to_string())?
}
