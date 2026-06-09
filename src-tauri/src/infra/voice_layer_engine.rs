use tauri::AppHandle;

use crate::core::models::AudioBuffer;

#[derive(Debug, Clone, Copy)]
pub struct VoiceLayerOptions {
    pub ml_voice_layers_enabled: bool,
    pub reduce_sibilance: bool,
    pub reduce_breath: bool,
    pub reduce_plosive: bool,
    pub smooth_voice_cutoff: bool,
}

impl Default for VoiceLayerOptions {
    fn default() -> Self {
        Self {
            ml_voice_layers_enabled: false,
            reduce_sibilance: false,
            reduce_breath: false,
            reduce_plosive: false,
            smooth_voice_cutoff: false,
        }
    }
}

impl VoiceLayerOptions {
    pub fn any_enabled(&self) -> bool {
        self.ml_voice_layers_enabled
            || self.reduce_sibilance
            || self.reduce_breath
            || self.reduce_plosive
            || self.smooth_voice_cutoff
    }
}

pub struct VoiceLayerEngine;

impl VoiceLayerEngine {
    pub fn new() -> Self {
        Self
    }

    pub fn process(
        &self,
        app: &AppHandle,
        buffer: &mut AudioBuffer,
        options: VoiceLayerOptions,
    ) -> Result<(), String> {
        let _ = app; // AppHandle reserved for future AI runtime hooks
        self.process_no_app(buffer, options)
    }

    /// Same as [`process`] but without requiring an [`AppHandle`].
    /// Use this from `spawn_blocking` closures where `AppHandle` is not `Send`.
    pub fn process_no_app(
        &self,
        buffer: &mut AudioBuffer,
        options: VoiceLayerOptions,
    ) -> Result<(), String> {
        if !options.any_enabled() {
            return Ok(());
        }

        if options.ml_voice_layers_enabled {
            self.apply_main_vocal_focus(buffer);
        }

        if options.reduce_plosive {
            self.reduce_plosives(buffer);
        }
        if options.reduce_breath {
            self.reduce_breath(buffer);
        }
        if options.reduce_sibilance {
            self.reduce_sibilance(buffer);
        }
        if options.smooth_voice_cutoff {
            self.smooth_voice_cutoff(buffer);
        }

        Ok(())
    }

    fn apply_main_vocal_focus(&self, buffer: &mut AudioBuffer) {
        let channels = buffer.channels.max(1) as usize;
        let sample_rate = buffer.sample_rate as f32;
        let hp_alpha = one_pole_alpha(85.0, sample_rate);
        let lp_alpha = one_pole_alpha(11_000.0, sample_rate);
        let env_alpha = one_pole_alpha(18.0, sample_rate);

        for ch in 0..channels {
            let mut low = 0.0_f32;
            let mut high_tamed = 0.0_f32;
            let mut env = 0.0_f32;
            let mut idx = ch;

            while idx < buffer.samples.len() {
                let sample = buffer.samples[idx];
                low += hp_alpha * (sample - low);
                let high_passed = sample - low;
                high_tamed += lp_alpha * (high_passed - high_tamed);
                env += env_alpha * (high_tamed.abs() - env);

                let gate = if env < 0.006 {
                    0.35
                } else if env < 0.018 {
                    0.35 + ((env - 0.006) / 0.012) * 0.65
                } else {
                    1.0
                };

                buffer.samples[idx] = (high_tamed * gate).clamp(-1.0, 1.0);
                idx += channels;
            }
        }
    }

    fn reduce_sibilance(&self, buffer: &mut AudioBuffer) {
        let channels = buffer.channels.max(1) as usize;
        let sample_rate = buffer.sample_rate as f32;
        let low_alpha = one_pole_alpha(4_200.0, sample_rate);
        let env_alpha = one_pole_alpha(45.0, sample_rate);

        for ch in 0..channels {
            let mut low = 0.0_f32;
            let mut env = 0.0_f32;
            let mut idx = ch;

            while idx < buffer.samples.len() {
                let sample = buffer.samples[idx];
                low += low_alpha * (sample - low);
                let high = sample - low;
                env += env_alpha * (sample.abs() - env);
                let high_ratio = high.abs() / (env + 0.001);
                let amount = if env > 0.012 && high_ratio > 0.85 { 0.45 } else { 0.10 };
                buffer.samples[idx] = (sample - high * amount).clamp(-1.0, 1.0);
                idx += channels;
            }
        }
    }

    fn reduce_breath(&self, buffer: &mut AudioBuffer) {
        let channels = buffer.channels.max(1) as usize;
        let sample_rate = buffer.sample_rate as f32;
        let low_alpha = one_pole_alpha(1_200.0, sample_rate);
        let env_alpha = one_pole_alpha(20.0, sample_rate);

        for ch in 0..channels {
            let mut low = 0.0_f32;
            let mut env = 0.0_f32;
            let mut idx = ch;

            while idx < buffer.samples.len() {
                let sample = buffer.samples[idx];
                low += low_alpha * (sample - low);
                let noise_band = sample - low;
                env += env_alpha * (sample.abs() - env);
                let breath_like = env > 0.006 && env < 0.08 && noise_band.abs() > low.abs() * 0.9;
                let amount = if breath_like { 0.55 } else { 0.0 };
                buffer.samples[idx] = (sample - noise_band * amount).clamp(-1.0, 1.0);
                idx += channels;
            }
        }
    }

    fn reduce_plosives(&self, buffer: &mut AudioBuffer) {
        let channels = buffer.channels.max(1) as usize;
        let sample_rate = buffer.sample_rate as f32;
        let low_alpha = one_pole_alpha(180.0, sample_rate);
        let env_alpha = one_pole_alpha(35.0, sample_rate);

        for ch in 0..channels {
            let mut low = 0.0_f32;
            let mut env = 0.0_f32;
            let mut idx = ch;

            while idx < buffer.samples.len() {
                let sample = buffer.samples[idx];
                low += low_alpha * (sample - low);
                env += env_alpha * (sample.abs() - env);
                let plosive_like = low.abs() > 0.07 && low.abs() > env * 0.85;
                let amount = if plosive_like { 0.70 } else { 0.15 };
                buffer.samples[idx] = (sample - low * amount).clamp(-1.0, 1.0);
                idx += channels;
            }
        }
    }

    fn smooth_voice_cutoff(&self, buffer: &mut AudioBuffer) {
        let channels = buffer.channels.max(1) as usize;
        let sample_rate = buffer.sample_rate as f32;
        let rise_alpha = one_pole_alpha(18.0, sample_rate);
        let fall_alpha = one_pole_alpha(5.0, sample_rate);

        for ch in 0..channels {
            let mut baseline = 0.0_f32;
            let mut idx = ch;

            while idx < buffer.samples.len() {
                let sample = buffer.samples[idx];
                let abs = sample.abs();
                let alpha = if abs > baseline { rise_alpha } else { fall_alpha };
                baseline += alpha * (abs - baseline);

                let ceiling = (baseline * 1.55 + 0.018).max(0.035);
                if abs > ceiling {
                    let softened = ceiling + (abs - ceiling) * 0.22;
                    buffer.samples[idx] = sample.signum() * softened.min(1.0);
                } else {
                    buffer.samples[idx] = sample;
                }

                idx += channels;
            }
        }
    }
}

fn one_pole_alpha(freq: f32, sample_rate: f32) -> f32 {
    let freq = freq.max(1.0);
    let sample_rate = sample_rate.max(freq * 2.0);
    let dt = 1.0 / sample_rate;
    let rc = 1.0 / (2.0 * std::f32::consts::PI * freq);
    (dt / (rc + dt)).clamp(0.0, 1.0)
}
