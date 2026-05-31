use std::path::PathBuf;
use tauri::{AppHandle, Manager};
use serde::Serialize;

use crate::core::models::AudioBuffer;

const HUSH_MODEL_URL: &str = "https://huggingface.co/weya-ai/hush/resolve/main/onnx/advanced_dfnet16k_model_best_onnx.tar.gz";
const HUSH_MODEL_FILE: &str = "advanced_dfnet16k_model_best_onnx.tar.gz";
const MIN_MODEL_BYTES: u64 = 1024 * 1024;

#[derive(Debug, Clone, Copy)]
pub struct VoiceLayerOptions {
    pub ml_voice_layers_enabled: bool,
    pub reduce_sibilance: bool,
    pub reduce_breath: bool,
    pub reduce_plosive: bool,
}

impl VoiceLayerOptions {
    pub fn any_enabled(&self) -> bool {
        self.ml_voice_layers_enabled || self.reduce_sibilance || self.reduce_breath || self.reduce_plosive
    }
}

pub struct VoiceLayerEngine;

#[derive(Debug, Clone, Serialize)]
pub struct VoiceLayerFrame {
    pub start_ms: u32,
    pub end_ms: u32,
    pub main_voice: f32,
    pub sibilance: f32,
    pub breath: f32,
    pub plosive: f32,
}

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
        if !options.any_enabled() {
            return Ok(());
        }

        if options.ml_voice_layers_enabled {
            // Cache the Hush production bundle on first use. The current public artifact
            // ships as a packaged enhancement bundle, so v1 keeps the ML asset ready here
            // while the layer controls below run deterministic offline DSP.
            self.ensure_hush_model(app)?;
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

        Ok(())
    }

    pub fn analyze_layers(&self, buffer: &AudioBuffer) -> Vec<VoiceLayerFrame> {
        let sample_rate = buffer.sample_rate.max(1) as usize;
        let frame_size = ((sample_rate as f32 * 0.030).round() as usize).max(256);
        let mono = downmix_to_mono(buffer);

        if mono.len() < frame_size {
            return Vec::new();
        }

        let mut frames = Vec::new();
        let mut prev_rms = 0.0_f32;
        let mut low_120 = 0.0_f32;
        let mut low_180 = 0.0_f32;
        let mut low_1k = 0.0_f32;
        let mut low_36k = 0.0_f32;
        let mut low_4k = 0.0_f32;
        let mut low_9k = 0.0_f32;
        let mut low_10k = 0.0_f32;
        let alpha_120 = one_pole_alpha(120.0, sample_rate as f32);
        let alpha_180 = one_pole_alpha(180.0, sample_rate as f32);
        let alpha_1k = one_pole_alpha(1_000.0, sample_rate as f32);
        let alpha_36k = one_pole_alpha(3_600.0, sample_rate as f32);
        let alpha_4k = one_pole_alpha(4_000.0, sample_rate as f32);
        let alpha_9k = one_pole_alpha(9_000.0, sample_rate as f32);
        let alpha_10k = one_pole_alpha(10_000.0, sample_rate as f32);

        let mut start = 0usize;
        while start + frame_size <= mono.len() {
            let frame = &mono[start..start + frame_size];
            let mut total_energy = 0.0_f32;
            let mut low_energy = 0.0_f32;
            let mut voice_energy = 0.0_f32;
            let mut sibilance_energy = 0.0_f32;
            let mut broadband_energy = 0.0_f32;
            let mut crossings = 0usize;
            let mut prev = frame[0];

            for &sample in frame {
                low_120 += alpha_120 * (sample - low_120);
                low_180 += alpha_180 * (sample - low_180);
                low_1k += alpha_1k * (sample - low_1k);
                low_36k += alpha_36k * (sample - low_36k);
                low_4k += alpha_4k * (sample - low_4k);
                low_9k += alpha_9k * (sample - low_9k);
                low_10k += alpha_10k * (sample - low_10k);

                let low_band = low_180;
                let voice_band = low_36k - low_120;
                let sibilance_band = low_10k - low_4k;
                let broadband_band = low_9k - low_1k;

                total_energy += sample * sample;
                low_energy += low_band * low_band;
                voice_energy += voice_band * voice_band;
                sibilance_energy += sibilance_band * sibilance_band;
                broadband_energy += broadband_band * broadband_band;

                if (prev >= 0.0 && sample < 0.0) || (prev < 0.0 && sample >= 0.0) {
                    crossings += 1;
                }
                prev = sample;
            }

            let inv_len = 1.0 / frame.len() as f32;
            let rms = (total_energy * inv_len).sqrt();
            let zcr = crossings as f32 / frame.len().saturating_sub(1).max(1) as f32;
            let total_energy = total_energy * inv_len + 0.000001;

            let voice_ratio = (voice_energy * inv_len) / total_energy;
            let sibilance_ratio = (sibilance_energy * inv_len) / total_energy;
            let low_ratio = (low_energy * inv_len) / total_energy;
            let broadband_ratio = (broadband_energy * inv_len) / total_energy;
            let transient = (rms - prev_rms).max(0.0);

            let main_voice = score((rms - 0.012) / 0.09) * score((voice_ratio - 0.30) / 0.55);
            let sibilance = score((sibilance_ratio - 0.16) / 0.45) * score((rms - 0.01) / 0.08);
            let breath = score((rms - 0.006) / 0.055)
                * (1.0 - score((rms - 0.08) / 0.08))
                * score((zcr - 0.08) / 0.22)
                * score((broadband_ratio - 0.25) / 0.45);
            let plosive = score((low_ratio - 0.22) / 0.55) * score((transient - 0.015) / 0.09);

            frames.push(VoiceLayerFrame {
                start_ms: ((start as f32 / sample_rate as f32) * 1000.0).round() as u32,
                end_ms: (((start + frame_size) as f32 / sample_rate as f32) * 1000.0).round() as u32,
                main_voice: main_voice.clamp(0.0, 1.0),
                sibilance: sibilance.clamp(0.0, 1.0),
                breath: breath.clamp(0.0, 1.0),
                plosive: plosive.clamp(0.0, 1.0),
            });

            prev_rms = rms;
            start += frame_size;
        }
        smooth_frames(frames)
    }

    fn model_dir(&self, app: &AppHandle) -> Result<PathBuf, String> {
        let doc_dir = app
            .path()
            .document_dir()
            .map_err(|e| format!("Failed to find Documents dir: {}", e))?;
        let dir = doc_dir.join("VoiceRecorder").join(".models").join("hush");
        std::fs::create_dir_all(&dir)
            .map_err(|e| format!("Failed to create model cache dir: {}", e))?;
        Ok(dir)
    }

    fn ensure_hush_model(&self, app: &AppHandle) -> Result<PathBuf, String> {
        let path = self.model_dir(app)?.join(HUSH_MODEL_FILE);
        if self.is_valid_model_file(&path) {
            return Ok(path);
        }

        let tmp_path = path.with_extension("download");
        let client = reqwest::blocking::Client::builder()
            .user_agent("voice-recorder/0.1 voice-layer-cache")
            .build()
            .map_err(|e| format!("Failed to initialize Hush model downloader: {}", e))?;
        let response = client
            .get(HUSH_MODEL_URL)
            .send()
            .map_err(|e| format!("Failed to download Hush model: {}", e))?;
        if !response.status().is_success() {
            return Err(format!("Failed to download Hush model: HTTP {}", response.status()));
        }

        let bytes = response
            .bytes()
            .map_err(|e| format!("Failed to read Hush model response: {}", e))?;
        if bytes.len() as u64 <= MIN_MODEL_BYTES {
            return Err("Downloaded Hush model is unexpectedly small".to_string());
        }

        std::fs::write(&tmp_path, &bytes)
            .map_err(|e| format!("Failed to write Hush model cache: {}", e))?;
        if path.exists() {
            std::fs::remove_file(&path)
                .map_err(|e| format!("Failed to replace invalid Hush model cache: {}", e))?;
        }
        std::fs::rename(&tmp_path, &path)
            .map_err(|e| format!("Failed to finalize Hush model cache: {}", e))?;

        Ok(path)
    }

    fn is_valid_model_file(&self, path: &PathBuf) -> bool {
        path.metadata()
            .map(|m| m.is_file() && m.len() > MIN_MODEL_BYTES)
            .unwrap_or(false)
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
}

fn one_pole_alpha(freq: f32, sample_rate: f32) -> f32 {
    let freq = freq.max(1.0);
    let sample_rate = sample_rate.max(freq * 2.0);
    let dt = 1.0 / sample_rate;
    let rc = 1.0 / (2.0 * std::f32::consts::PI * freq);
    (dt / (rc + dt)).clamp(0.0, 1.0)
}

fn downmix_to_mono(buffer: &AudioBuffer) -> Vec<f32> {
    let channels = buffer.channels.max(1) as usize;
    if channels == 1 {
        return buffer.samples.clone();
    }

    let mut mono = Vec::with_capacity(buffer.samples.len() / channels);
    for frame in buffer.samples.chunks(channels) {
        let sum: f32 = frame.iter().copied().sum();
        mono.push(sum / frame.len() as f32);
    }
    mono
}

fn score(value: f32) -> f32 {
    value.clamp(0.0, 1.0)
}

fn smooth_frames(mut frames: Vec<VoiceLayerFrame>) -> Vec<VoiceLayerFrame> {
    if frames.len() < 3 {
        return frames;
    }

    let original = frames.clone();
    for i in 1..frames.len() - 1 {
        frames[i].main_voice = avg3(original[i - 1].main_voice, original[i].main_voice, original[i + 1].main_voice);
        frames[i].sibilance = avg3(original[i - 1].sibilance, original[i].sibilance, original[i + 1].sibilance);
        frames[i].breath = avg3(original[i - 1].breath, original[i].breath, original[i + 1].breath);
        frames[i].plosive = avg3(original[i - 1].plosive, original[i].plosive, original[i + 1].plosive);
    }
    frames
}

fn avg3(a: f32, b: f32, c: f32) -> f32 {
    (a + b + c) / 3.0
}
