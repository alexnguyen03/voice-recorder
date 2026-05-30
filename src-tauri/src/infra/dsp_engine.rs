use std::f32::consts::PI;
use crate::core::models::AppError;
use crate::core::traits::AudioProcessor;

/// High-performance Digital Biquad filter representation (Direct Form I).
#[derive(Clone)]
struct BiquadFilter {
    b0: f32,
    b1: f32,
    b2: f32,
    a1: f32,
    a2: f32,
    x1: f32,
    x2: f32,
    y1: f32,
    y2: f32,
}

impl BiquadFilter {
    fn new_bypass() -> Self {
        Self {
            b0: 1.0, b1: 0.0, b2: 0.0,
            a1: 0.0, a2: 0.0,
            x1: 0.0, x2: 0.0,
            y1: 0.0, y2: 0.0,
        }
    }

    /// Creates a low-frequency shelf biquad filter (for warm Bass Boosts).
    fn new_low_shelf(sample_rate: f32, cutoff: f32, gain_db: f32) -> Self {
        if gain_db == 0.0 {
            return Self::new_bypass();
        }
        let a = 10.0f32.powf(gain_db / 40.0);
        let w0 = 2.0 * PI * cutoff / sample_rate;
        let slope = 1.0; // Default filter slope
        let alpha = (w0.sin() / 2.0) * (((a + 1.0 / a) * (1.0 / slope - 1.0) + 2.0).sqrt());

        let b0 = a * ((a + 1.0) - (a - 1.0) * w0.cos() + 2.0 * a.sqrt() * alpha);
        let b1 = 2.0 * a * ((a - 1.0) - (a + 1.0) * w0.cos());
        let b2 = a * ((a + 1.0) - (a - 1.0) * w0.cos() - 2.0 * a.sqrt() * alpha);
        let a0 = (a + 1.0) + (a - 1.0) * w0.cos() + 2.0 * a.sqrt() * alpha;
        let a1 = -2.0 * ((a - 1.0) + (a + 1.0) * w0.cos());
        let a2 = (a + 1.0) + (a - 1.0) * w0.cos() - 2.0 * a.sqrt() * alpha;

        Self {
            b0: b0 / a0,
            b1: b1 / a0,
            b2: b2 / a0,
            a1: a1 / a0,
            a2: a2 / a0,
            x1: 0.0, x2: 0.0,
            y1: 0.0, y2: 0.0,
        }
    }

    /// Creates a high-frequency shelf biquad filter (for bright Treble Boosts).
    fn new_high_shelf(sample_rate: f32, cutoff: f32, gain_db: f32) -> Self {
        if gain_db == 0.0 {
            return Self::new_bypass();
        }
        let a = 10.0f32.powf(gain_db / 40.0);
        let w0 = 2.0 * PI * cutoff / sample_rate;
        let slope = 1.0;
        let alpha = (w0.sin() / 2.0) * (((a + 1.0 / a) * (1.0 / slope - 1.0) + 2.0).sqrt());

        let b0 = a * ((a + 1.0) + (a - 1.0) * w0.cos() + 2.0 * a.sqrt() * alpha);
        let b1 = -2.0 * a * ((a - 1.0) + (a + 1.0) * w0.cos());
        let b2 = a * ((a + 1.0) + (a - 1.0) * w0.cos() - 2.0 * a.sqrt() * alpha);
        let a0 = (a + 1.0) - (a - 1.0) * w0.cos() + 2.0 * a.sqrt() * alpha;
        let a1 = 2.0 * ((a - 1.0) - (a + 1.0) * w0.cos());
        let a2 = (a + 1.0) - (a - 1.0) * w0.cos() - 2.0 * a.sqrt() * alpha;

        Self {
            b0: b0 / a0,
            b1: b1 / a0,
            b2: b2 / a0,
            a1: a1 / a0,
            a2: a2 / a0,
            x1: 0.0, x2: 0.0,
            y1: 0.0, y2: 0.0,
        }
    }

    /// Creates a high-pass biquad filter (for removing low-frequency rumble from cheap mics).
    fn new_high_pass(sample_rate: f32, cutoff: f32) -> Self {
        let w0 = 2.0 * PI * cutoff / sample_rate;
        let q = 0.707; // Butterworth
        let alpha = w0.sin() / (2.0 * q);

        let b0 = (1.0 + w0.cos()) / 2.0;
        let b1 = -(1.0 + w0.cos());
        let b2 = (1.0 + w0.cos()) / 2.0;
        let a0 = 1.0 + alpha;
        let a1 = -2.0 * w0.cos();
        let a2 = 1.0 - alpha;

        Self {
            b0: b0 / a0,
            b1: b1 / a0,
            b2: b2 / a0,
            a1: a1 / a0,
            a2: a2 / a0,
            x1: 0.0, x2: 0.0,
            y1: 0.0, y2: 0.0,
        }
    }

    /// Creates a low-pass biquad filter (for removing high-frequency hiss).
    fn new_low_pass(sample_rate: f32, cutoff: f32) -> Self {
        let w0 = 2.0 * PI * cutoff / sample_rate;
        let q = 0.707; // Butterworth
        let alpha = w0.sin() / (2.0 * q);

        let b0 = (1.0 - w0.cos()) / 2.0;
        let b1 = 1.0 - w0.cos();
        let b2 = (1.0 - w0.cos()) / 2.0;
        let a0 = 1.0 + alpha;
        let a1 = -2.0 * w0.cos();
        let a2 = 1.0 - alpha;

        Self {
            b0: b0 / a0,
            b1: b1 / a0,
            b2: b2 / a0,
            a1: a1 / a0,
            a2: a2 / a0,
            x1: 0.0, x2: 0.0,
            y1: 0.0, y2: 0.0,
        }
    }

    /// Creates a notch biquad filter (for removing 50Hz/60Hz AC hum).
    fn new_notch(sample_rate: f32, freq: f32, q: f32) -> Self {
        let w0 = 2.0 * PI * freq / sample_rate;
        let alpha = w0.sin() / (2.0 * q);

        let b0 = 1.0;
        let b1 = -2.0 * w0.cos();
        let b2 = 1.0;
        let a0 = 1.0 + alpha;
        let a1 = -2.0 * w0.cos();
        let a2 = 1.0 - alpha;

        Self {
            b0: b0 / a0,
            b1: b1 / a0,
            b2: b2 / a0,
            a1: a1 / a0,
            a2: a2 / a0,
            x1: 0.0, x2: 0.0,
            y1: 0.0, y2: 0.0,
        }
    }

    /// Evaluates biquad equations to process a single sample frame.
    fn process(&mut self, sample: f32) -> f32 {
        let out = self.b0 * sample + self.b1 * self.x1 + self.b2 * self.x2 - self.a1 * self.y1 - self.a2 * self.y2;
        self.x2 = self.x1;
        self.x1 = sample;
        self.y2 = self.y1;
        self.y1 = out;
        out
    }
}

/// Concrete implementation of AudioProcessor utilizing digital biquad DSP models.
pub struct DspEngine;

impl DspEngine {
    pub fn new() -> Self {
        Self
    }
}

impl AudioProcessor for DspEngine {
    fn suppress_noise(&self, input: &[f32]) -> Result<Vec<f32>, AppError> {
        // Soft Noise Gate: Mutes low-level room static background hiss dynamically
        let threshold = 0.015; 
        let attack = 0.95; // Envelope tracking factor
        let mut envelope = 0.0f32;

        let output = input.iter().map(|&sample| {
            let abs_sample = sample.abs();
            // Envelope tracker logic
            if abs_sample > envelope {
                envelope = abs_sample;
            } else {
                envelope = attack * envelope + (1.0 - attack) * abs_sample;
            }

            // Calculate soft-threshold gain factor
            let gain = if envelope < threshold {
                (envelope / threshold).powi(2)
            } else {
                1.0
            };

            sample * gain
        }).collect();

        Ok(output)
    }

    fn enhance_voice(
        &self,
        input: &[f32],
        bass_boost: f32,
        treble_boost: f32,
        volume_boost: f32,
        mic_eq_enhancement: bool,
    ) -> Result<Vec<f32>, AppError> {
        // Map 0.0..1.0 parameters to dynamic gains from -12dB up to +12dB
        let bass_gain = (bass_boost - 0.5) * 24.0;
        let treble_gain = (treble_boost - 0.5) * 24.0;
        
        // Map volume_boost (0.0..1.0) to linear gain multiplier.
        // 0.5 = 1x (neutral), 1.0 = 4x (+12dB), 0.0 = 0.25x (-12dB)
        let linear_gain = if volume_boost >= 0.5 {
            1.0 + (volume_boost - 0.5) * 6.0 // up to 4x
        } else {
            0.25 + (volume_boost / 0.5) * 0.75 // down to 0.25x
        };

        let sample_rate = 44100.0;
        let mut bass_filter = BiquadFilter::new_low_shelf(sample_rate, 200.0, bass_gain);
        let mut treble_filter = BiquadFilter::new_high_shelf(sample_rate, 5000.0, treble_gain);
        
        // Anti-hum / Anti-hiss filters for low-quality mics
        let mut rumble_filter = BiquadFilter::new_bypass();
        let mut hiss_filter = BiquadFilter::new_bypass();
        let mut notch50_filter = BiquadFilter::new_bypass();
        let mut notch60_filter = BiquadFilter::new_bypass();

        if mic_eq_enhancement {
            rumble_filter = BiquadFilter::new_high_pass(sample_rate, 20.0); // Cut sub-rumble below 20Hz
            hiss_filter = BiquadFilter::new_low_pass(sample_rate, 9000.0);  // Cut high-freq static
            notch50_filter = BiquadFilter::new_notch(sample_rate, 50.0, 10.0); // Kill 50Hz mains hum
            notch60_filter = BiquadFilter::new_notch(sample_rate, 60.0, 10.0); // Kill 60Hz mains hum
        }

        let mut output = Vec::with_capacity(input.len());
        for &sample in input {
            let mut processed = sample;
            // Clean noise (hum and hiss) first
            processed = rumble_filter.process(processed);
            processed = hiss_filter.process(processed);
            processed = notch50_filter.process(processed);
            processed = notch60_filter.process(processed);
            
            // Warm the voice frequencies
            processed = bass_filter.process(processed);
            // Boost crisp vocal clarity
            processed = treble_filter.process(processed);
            // Apply volume boost
            processed *= linear_gain;
            
            // Hard clipping to prevent integer overflow wrap-around in PCM output
            if processed > 1.0 { processed = 1.0; }
            if processed < -1.0 { processed = -1.0; }
            
            output.push(processed);
        }

        Ok(output)
    }
}
