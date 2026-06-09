use serde::{Deserialize, Serialize};

use crate::infra::pipeline::PipelineConfig;
use crate::infra::voice_layer_engine::VoiceLayerOptions;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum EnhanceMode {
    FastClean,
    BestQuality,
}

impl Default for EnhanceMode {
    fn default() -> Self {
        Self::FastClean
    }
}

impl EnhanceMode {
    pub fn parse(value: Option<&str>) -> Self {
        match value {
            Some("best_quality") => Self::BestQuality,
            _ => Self::FastClean,
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum VoicePreset {
    CleanVoice,
    PodcastWarm,
    MeetingClear,
    LowMicRescue,
    NoisyRoomRescue,
}

impl VoicePreset {
    pub fn parse(value: Option<&str>) -> Option<Self> {
        match value {
            Some("clean_voice") => Some(Self::CleanVoice),
            Some("podcast_warm") => Some(Self::PodcastWarm),
            Some("meeting_clear") => Some(Self::MeetingClear),
            Some("low_mic_rescue") => Some(Self::LowMicRescue),
            Some("noisy_room_rescue") => Some(Self::NoisyRoomRescue),
            _ => None,
        }
    }
}

pub fn apply_voice_preset(
    preset: Option<VoicePreset>,
    enhance_mode: EnhanceMode,
    enhance_strength: f32,
    natural_clean_balance: f32,
    pipeline: &mut PipelineConfig,
    voice_layers: &mut VoiceLayerOptions,
) {
    if let Some(preset) = preset {
        apply_recipe(preset, pipeline, voice_layers);
    }

    let strength = enhance_strength.clamp(0.0, 1.0);
    let clean = natural_clean_balance.clamp(0.0, 1.0);
    if strength > 0.0 {
        pipeline.noise_gate_sensitivity = mix(pipeline.noise_gate_sensitivity, 0.45 + clean * 0.35, strength * 0.6);
        pipeline.wind_intensity = mix(pipeline.wind_intensity, 0.25 + clean * 0.45, strength * 0.5);
        pipeline.breath_sensitivity = mix(pipeline.breath_sensitivity, 0.35 + clean * 0.45, strength * 0.45);
        pipeline.plosive_sensitivity = mix(pipeline.plosive_sensitivity, 0.35 + clean * 0.40, strength * 0.45);
    }

    if matches!(enhance_mode, EnhanceMode::BestQuality) {
        pipeline.hum_removal_enabled = true;
        pipeline.de_hiss_enabled = true;
        pipeline.mic_eq_enhancement = true;
        pipeline.noise_suppression = true;
        pipeline.noise_gate_sensitivity = pipeline.noise_gate_sensitivity.max(0.62);
        pipeline.wind_suppression = true;
        pipeline.wind_intensity = pipeline.wind_intensity.max(0.35);
        voice_layers.ml_voice_layers_enabled = true;
        voice_layers.reduce_sibilance = true;
        voice_layers.smooth_voice_cutoff = true;
    }
}

fn apply_recipe(
    preset: VoicePreset,
    pipeline: &mut PipelineConfig,
    voice_layers: &mut VoiceLayerOptions,
) {
    match preset {
        VoicePreset::CleanVoice => {
            pipeline.hum_removal_enabled = true;
            pipeline.noise_suppression = true;
            pipeline.noise_gate_sensitivity = 0.58;
            pipeline.de_hiss_enabled = true;
            pipeline.mic_eq_enhancement = true;
            pipeline.volume_boost = 0.54;
        }
        VoicePreset::PodcastWarm => {
            pipeline.hum_removal_enabled = true;
            pipeline.de_hiss_enabled = true;
            pipeline.mic_eq_enhancement = true;
            pipeline.bass_boost = 0.62;
            pipeline.treble_boost = 0.54;
            pipeline.volume_boost = 0.58;
            pipeline.reduce_plosive = true;
            pipeline.plosive_sensitivity = 0.52;
            voice_layers.smooth_voice_cutoff = true;
        }
        VoicePreset::MeetingClear => {
            pipeline.hum_removal_enabled = true;
            pipeline.noise_suppression = true;
            pipeline.noise_gate_sensitivity = 0.68;
            pipeline.de_hiss_enabled = true;
            pipeline.mic_eq_enhancement = true;
            pipeline.treble_boost = 0.60;
            pipeline.mid_cut_freq = 450.0;
            pipeline.mid_cut_q = 1.2;
            pipeline.mid_cut_gain_db = -2.0;
            voice_layers.reduce_sibilance = true;
        }
        VoicePreset::LowMicRescue => {
            pipeline.hum_removal_enabled = true;
            pipeline.noise_suppression = true;
            pipeline.noise_gate_sensitivity = 0.72;
            pipeline.de_hiss_enabled = true;
            pipeline.mic_eq_enhancement = true;
            pipeline.volume_boost = 0.72;
            pipeline.bass_boost = 0.58;
            pipeline.treble_boost = 0.58;
            voice_layers.ml_voice_layers_enabled = true;
            voice_layers.smooth_voice_cutoff = true;
        }
        VoicePreset::NoisyRoomRescue => {
            pipeline.hum_removal_enabled = true;
            pipeline.noise_suppression = true;
            pipeline.noise_gate_sensitivity = 0.78;
            pipeline.wind_suppression = true;
            pipeline.wind_intensity = 0.62;
            pipeline.de_hiss_enabled = true;
            pipeline.mic_eq_enhancement = true;
            pipeline.reduce_breath = true;
            pipeline.breath_sensitivity = 0.62;
            pipeline.reduce_plosive = true;
            pipeline.plosive_sensitivity = 0.58;
            voice_layers.ml_voice_layers_enabled = true;
            voice_layers.reduce_sibilance = true;
            voice_layers.smooth_voice_cutoff = true;
        }
    }
}

fn mix(a: f32, b: f32, amount: f32) -> f32 {
    a + (b - a) * amount.clamp(0.0, 1.0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn preset_maps_pipeline_values() {
        let mut pipeline = PipelineConfig::default();
        let mut layers = VoiceLayerOptions::default();
        apply_voice_preset(
            Some(VoicePreset::NoisyRoomRescue),
            EnhanceMode::FastClean,
            0.0,
            0.5,
            &mut pipeline,
            &mut layers,
        );
        assert!(pipeline.noise_suppression);
        assert!(pipeline.wind_suppression);
        assert!(pipeline.de_hiss_enabled);
        assert!(layers.ml_voice_layers_enabled);
    }

    #[test]
    fn best_quality_enables_cleanup_defaults() {
        let mut pipeline = PipelineConfig::default();
        let mut layers = VoiceLayerOptions::default();
        apply_voice_preset(None, EnhanceMode::BestQuality, 0.5, 0.5, &mut pipeline, &mut layers);
        assert!(pipeline.noise_suppression);
        assert!(pipeline.mic_eq_enhancement);
        assert!(layers.reduce_sibilance);
    }
}
