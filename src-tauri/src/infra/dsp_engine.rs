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
        // Improved Noise Gate with:
        //   - Separate fast attack / slow release envelope
        //   - Hysteresis: open_threshold > close_threshold (prevents pumping)
        //   - Smooth linear knee instead of abrupt quadratic
        //   - Hold counter to avoid choppy cuts between syllables
        let sample_rate = 44100.0f32;
        let open_threshold  = 0.025_f32;  // RMS level to open gate
        let close_threshold = 0.010_f32;  // RMS level to close gate (hysteresis)
        let knee_width      = 0.015_f32;  // Smooth transition band above close_threshold

        // Time constants: attack ~2ms, release ~150ms
        let attack_coef  = (-1.0_f32 / (0.002 * sample_rate)).exp();
        let release_coef = (-1.0_f32 / (0.150 * sample_rate)).exp();

        // Hold: keep gate open for ~80ms after signal drops below threshold
        let hold_samples = (0.080 * sample_rate) as i32;

        let mut envelope  = 0.0_f32;
        let mut gate_open = false;
        let mut hold_counter: i32 = 0;

        let output = input.iter().map(|&sample| {
            let abs_sample = sample.abs();

            // Envelope follower: fast attack, slow release
            if abs_sample > envelope {
                envelope = attack_coef * envelope + (1.0 - attack_coef) * abs_sample;
            } else {
                envelope = release_coef * envelope + (1.0 - release_coef) * abs_sample;
            }

            // Hysteresis state machine
            if gate_open {
                if envelope < close_threshold {
                    if hold_counter > 0 {
                        hold_counter -= 1;
                    } else {
                        gate_open = false;
                    }
                } else {
                    hold_counter = hold_samples;
                }
            } else if envelope >= open_threshold {
                gate_open = true;
                hold_counter = hold_samples;
            }

            // Smooth knee: full gain when open, soft fade in transition zone, silent below
            let gain = if gate_open {
                1.0
            } else if envelope > close_threshold {
                // Linear knee between close_threshold and open_threshold
                ((envelope - close_threshold) / knee_width).min(1.0)
            } else {
                0.0
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
        let mut rumble_filter2 = BiquadFilter::new_bypass();
        let mut rumble_filter3 = BiquadFilter::new_bypass();
        let mut hiss_filter = BiquadFilter::new_bypass();
        let mut notch50_filter = BiquadFilter::new_bypass();
        let mut notch60_filter = BiquadFilter::new_bypass();

        if mic_eq_enhancement {
            rumble_filter = BiquadFilter::new_high_pass(sample_rate, 85.0); // Cut sub-rumble below 85Hz
            rumble_filter2 = BiquadFilter::new_high_pass(sample_rate, 85.0);
            rumble_filter3 = BiquadFilter::new_high_pass(sample_rate, 85.0);
            hiss_filter = BiquadFilter::new_low_pass(sample_rate, 9000.0);  // Cut high-freq static
            notch50_filter = BiquadFilter::new_notch(sample_rate, 50.0, 10.0); // Kill 50Hz mains hum
            notch60_filter = BiquadFilter::new_notch(sample_rate, 60.0, 10.0); // Kill 60Hz mains hum
        }

        let mut output = Vec::with_capacity(input.len());
        for &sample in input {
            let mut processed = sample;
            // Clean noise (hum and hiss) first using steep cascaded filters
            processed = rumble_filter.process(processed);
            processed = rumble_filter2.process(processed);
            processed = rumble_filter3.process(processed);
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

pub struct LiveDspSession {
    bass_filter: BiquadFilter,
    treble_filter: BiquadFilter,
    rumble_filter1: BiquadFilter,
    rumble_filter2: BiquadFilter,
    rumble_filter3: BiquadFilter,
    hiss_filter: BiquadFilter,
    notch50_filter: BiquadFilter,
    notch60_filter: BiquadFilter,
    linear_gain: f32,
    noise_suppression: bool,
    mic_eq_enhancement: bool,
    // Noise gate state
    envelope: f32,
    gate_open: bool,
    hold_counter: i32,
    sample_rate: f32,
    /// Derived thresholds from gate_sensitivity (0.0–1.0)
    open_threshold: f32,
    close_threshold: f32,
}

impl LiveDspSession {
    pub fn new() -> Self {
        Self {
            bass_filter: BiquadFilter::new_bypass(),
            treble_filter: BiquadFilter::new_bypass(),
            rumble_filter1: BiquadFilter::new_bypass(),
            rumble_filter2: BiquadFilter::new_bypass(),
            rumble_filter3: BiquadFilter::new_bypass(),
            hiss_filter: BiquadFilter::new_bypass(),
            notch50_filter: BiquadFilter::new_bypass(),
            notch60_filter: BiquadFilter::new_bypass(),
            linear_gain: 1.0,
            noise_suppression: false,
            mic_eq_enhancement: false,
            envelope: 0.0,
            gate_open: false,
            hold_counter: 0,
            sample_rate: 44100.0,
            open_threshold: 0.012,
            close_threshold: 0.005,
        }
    }

    pub fn update_filters(&mut self, sample_rate: f32, bass_boost: f32, treble_boost: f32, volume_boost: f32, mic_eq: bool, noise_sup: bool, gate_sensitivity: f32) {
        let bass_gain = (bass_boost - 0.5) * 24.0;
        let treble_gain = (treble_boost - 0.5) * 24.0;
        self.linear_gain = if volume_boost >= 0.5 {
            1.0 + (volume_boost - 0.5) * 6.0
        } else {
            0.25 + (volume_boost / 0.5) * 0.75
        };

        // Update coefficients while preserving internal state to avoid pops
        let copy_coeffs = |target: &mut BiquadFilter, source: BiquadFilter| {
            target.b0 = source.b0; target.b1 = source.b1; target.b2 = source.b2;
            target.a1 = source.a1; target.a2 = source.a2;
        };

        copy_coeffs(&mut self.bass_filter, BiquadFilter::new_low_shelf(sample_rate, 200.0, bass_gain));
        copy_coeffs(&mut self.treble_filter, BiquadFilter::new_high_shelf(sample_rate, 5000.0, treble_gain));

        self.mic_eq_enhancement = mic_eq;
        if mic_eq {
            copy_coeffs(&mut self.rumble_filter1, BiquadFilter::new_high_pass(sample_rate, 85.0));
            copy_coeffs(&mut self.rumble_filter2, BiquadFilter::new_high_pass(sample_rate, 85.0));
            copy_coeffs(&mut self.rumble_filter3, BiquadFilter::new_high_pass(sample_rate, 85.0));
            copy_coeffs(&mut self.hiss_filter, BiquadFilter::new_low_pass(sample_rate, 9000.0));
            copy_coeffs(&mut self.notch50_filter, BiquadFilter::new_notch(sample_rate, 50.0, 10.0));
            copy_coeffs(&mut self.notch60_filter, BiquadFilter::new_notch(sample_rate, 60.0, 10.0));
        } else {
            copy_coeffs(&mut self.rumble_filter1, BiquadFilter::new_bypass());
            copy_coeffs(&mut self.rumble_filter2, BiquadFilter::new_bypass());
            copy_coeffs(&mut self.rumble_filter3, BiquadFilter::new_bypass());
            copy_coeffs(&mut self.hiss_filter, BiquadFilter::new_bypass());
            copy_coeffs(&mut self.notch50_filter, BiquadFilter::new_bypass());
            copy_coeffs(&mut self.notch60_filter, BiquadFilter::new_bypass());
        }

        self.noise_suppression = noise_sup;

        // Map sensitivity (0.0–1.0) to threshold range:
        //   sensitivity=0.0 → open=0.040 (hard to trigger, only loud speech)
        //   sensitivity=0.5 → open=0.012 (good default for average mic)
        //   sensitivity=1.0 → open=0.004 (very sensitive, triggers on whispers)
        let s = gate_sensitivity.clamp(0.0, 1.0);
        self.open_threshold  = 0.040 * (1.0 - s) + 0.004 * s;
        self.close_threshold = self.open_threshold * 0.40; // always 40% of open threshold
    }

    pub fn process_chunk(&mut self, input: &[f32], output: &mut [f32]) {
        // Use thresholds set by update_filters (gate_sensitivity driven)
        let open_threshold  = self.open_threshold;
        let close_threshold = self.close_threshold;
        // Knee spans from close_threshold up to open_threshold
        let knee_width = (open_threshold - close_threshold).max(0.001);

        // attack ~2ms, release ~150ms (keeps gate open through brief pauses between syllables)
        let attack_coef  = (-1.0_f32 / (0.002 * self.sample_rate)).exp();
        let release_coef = (-1.0_f32 / (0.150 * self.sample_rate)).exp();

        // Hold: keep gate open ~80ms after level drops, avoids chopping syllable tails
        let hold_samples = (0.080 * self.sample_rate) as i32;

        for (i, &sample) in input.iter().enumerate() {
            if i >= output.len() { break; }
            let mut processed = sample;

            // ── Step 1: Apply mic EQ BEFORE noise gate so gate isn't triggered by rumble/hiss ──
            if self.mic_eq_enhancement {
                processed = self.rumble_filter1.process(processed);
                processed = self.rumble_filter2.process(processed);
                processed = self.rumble_filter3.process(processed);
                processed = self.hiss_filter.process(processed);
                processed = self.notch50_filter.process(processed);
                processed = self.notch60_filter.process(processed);
            }

            // ── Step 2: Noise gate with fast attack / slow release envelope + hysteresis ──
            if self.noise_suppression {
                let abs_sample = processed.abs();

                // Envelope follower
                if abs_sample > self.envelope {
                    self.envelope = attack_coef * self.envelope + (1.0 - attack_coef) * abs_sample;
                } else {
                    self.envelope = release_coef * self.envelope + (1.0 - release_coef) * abs_sample;
                }

                // Hysteresis state machine
                if self.gate_open {
                    if self.envelope < close_threshold {
                        if self.hold_counter > 0 {
                            self.hold_counter -= 1;
                        } else {
                            self.gate_open = false;
                        }
                    } else {
                        self.hold_counter = hold_samples;
                    }
                } else if self.envelope >= open_threshold {
                    self.gate_open = true;
                    self.hold_counter = hold_samples;
                }

                // Smooth knee gain
                let gain = if self.gate_open {
                    1.0_f32
                } else if self.envelope > close_threshold {
                    ((self.envelope - close_threshold) / knee_width).min(1.0)
                } else {
                    0.0_f32
                };
                processed *= gain;
            }

            // ── Step 3: EQ shaping and volume ──
            processed = self.bass_filter.process(processed);
            processed = self.treble_filter.process(processed);
            processed *= self.linear_gain;

            // Hard clip to prevent PCM overflow
            processed = processed.clamp(-1.0, 1.0);

            output[i] = processed;
        }
    }
}
