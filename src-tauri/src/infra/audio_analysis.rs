use serde::{Deserialize, Serialize};

use crate::core::models::AudioBuffer;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum InputQuality {
    Poor,
    Okay,
    Good,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioAnalysis {
    pub peak_level: f32,
    pub rms_level: f32,
    pub clipping_count: u32,
    pub clipping_ratio: f32,
    pub silence_ratio: f32,
    pub noise_floor: f32,
    pub speech_ratio: f32,
    pub duration_secs: f64,
    pub input_quality: InputQuality,
    pub noise_level: InputQuality,
    pub clipping_detected: bool,
}

pub struct AudioAnalyzer;

impl AudioAnalyzer {
    pub fn analyze(buffer: &AudioBuffer) -> AudioAnalysis {
        let channels = buffer.channels.max(1) as usize;
        let frame_count = buffer.samples.len() / channels;
        if frame_count == 0 {
            return AudioAnalysis {
                peak_level: 0.0,
                rms_level: 0.0,
                clipping_count: 0,
                clipping_ratio: 0.0,
                silence_ratio: 1.0,
                noise_floor: 0.0,
                speech_ratio: 0.0,
                duration_secs: 0.0,
                input_quality: InputQuality::Poor,
                noise_level: InputQuality::Good,
                clipping_detected: false,
            };
        }

        let mut peak = 0.0_f32;
        let mut sum_sq = 0.0_f64;
        let mut clipping_count = 0_u32;
        let mut frame_levels = Vec::with_capacity(frame_count);

        for frame in buffer.samples.chunks(channels) {
            let level = frame.iter().fold(0.0_f32, |max, sample| max.max(sample.abs()));
            peak = peak.max(level);
            if level >= 0.98 {
                clipping_count = clipping_count.saturating_add(1);
            }
            sum_sq += frame.iter().map(|s| (*s as f64) * (*s as f64)).sum::<f64>() / frame.len() as f64;
            frame_levels.push(level);
        }

        frame_levels.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
        let rms = (sum_sq / frame_count as f64).sqrt() as f32;
        let clipping_ratio = clipping_count as f32 / frame_count as f32;
        let silence_count = frame_levels.iter().filter(|v| **v < 0.004).count();
        let silence_ratio = silence_count as f32 / frame_count as f32;
        let speech_count = frame_levels.iter().filter(|v| **v >= 0.018).count();
        let speech_ratio = speech_count as f32 / frame_count as f32;
        let noise_floor = percentile(&frame_levels, 0.20);
        let duration_secs = frame_count as f64 / buffer.sample_rate.max(1) as f64;
        let clipping_detected = clipping_count > 0;

        let noise_level = if noise_floor > 0.025 {
            InputQuality::Poor
        } else if noise_floor > 0.010 {
            InputQuality::Okay
        } else {
            InputQuality::Good
        };

        let input_quality = if clipping_detected || peak < 0.035 || noise_floor > 0.035 || speech_ratio < 0.03 {
            InputQuality::Poor
        } else if peak < 0.08 || rms < 0.010 || noise_floor > 0.015 {
            InputQuality::Okay
        } else {
            InputQuality::Good
        };

        AudioAnalysis {
            peak_level: peak,
            rms_level: rms,
            clipping_count,
            clipping_ratio,
            silence_ratio,
            noise_floor,
            speech_ratio,
            duration_secs,
            input_quality,
            noise_level,
            clipping_detected,
        }
    }
}

fn percentile(sorted: &[f32], p: f32) -> f32 {
    if sorted.is_empty() {
        return 0.0;
    }
    let idx = ((sorted.len() - 1) as f32 * p.clamp(0.0, 1.0)).round() as usize;
    sorted[idx]
}

#[cfg(test)]
mod tests {
    use super::*;

    fn buffer(samples: Vec<f32>) -> AudioBuffer {
        AudioBuffer { samples, sample_rate: 48_000, channels: 1 }
    }

    #[test]
    fn detects_clipping() {
        let analysis = AudioAnalyzer::analyze(&buffer(vec![0.0, 0.5, 0.99, -0.99]));
        assert!(analysis.clipping_detected);
        assert_eq!(analysis.clipping_count, 2);
    }

    #[test]
    fn reports_silence_stably() {
        let analysis = AudioAnalyzer::analyze(&buffer(vec![0.0; 480]));
        assert_eq!(analysis.peak_level, 0.0);
        assert_eq!(analysis.rms_level, 0.0);
        assert_eq!(analysis.noise_floor, 0.0);
        assert!(analysis.silence_ratio > 0.99);
    }

    #[test]
    fn estimates_noisy_signal_floor() {
        let mut samples = vec![0.01; 100];
        samples.extend(vec![0.20; 20]);
        let analysis = AudioAnalyzer::analyze(&buffer(samples));
        assert!(analysis.noise_floor >= 0.009);
        assert!(analysis.noise_floor <= 0.011);
        assert!(analysis.rms_level > 0.01);
    }
}
