use super::{AudioFilter, biquad::one_pole_alpha};

/// Suppresses close-mic breathing artefacts ("phì phì") while preserving
/// fricatives (f, s, ph) that are part of natural speech.
///
/// SRP: responsible only for breath-burst reduction.
///
/// Algorithm (spectral ratio approach — more robust than absolute thresholds):
///   1. Track broadband RMS and mid-band (500–3 kHz proxy) energy separately
///   2. Breath signature: mid_energy > broadband_energy × 0.60 AND
///      broadband level is LOW (< voice activity threshold) — not full speech
///   3. When breath is detected, attenuate the signal smoothly through an
///      AR (attack/release) envelope to avoid clicks
///   4. `sensitivity` maps 0.0–1.0 to detection threshold range so users can tune
pub struct BreathSuppressor {
    /// One-pole IIR for broadband RMS
    broad_env: f32,
    /// One-pole IIR for mid-band energy proxy (one-pole HPF at 500 Hz)
    mid_low:   f32, // one-pole low tracker for HPF
    mid_env:   f32, // one-pole for mid energy
    /// Smooth gain applied when breath detected (0 = suppress, 1 = pass)
    gain_env:  f32,
    broad_alpha:   f32,
    mid_lp_alpha:  f32,
    mid_env_alpha: f32,
    /// Smooth gain: fast attack (~5 ms), slow release (~80 ms) to avoid clicks
    gain_attack:   f32,
    gain_release:  f32,
    /// Voice-activity threshold — signals above this are speech, not breath
    voice_threshold: f32,
    /// Spectral ratio threshold to flag breath
    ratio_threshold: f32,
    /// Maximum attenuation amount (0 = no effect, 1 = full mute)
    max_amount: f32,
}

impl BreathSuppressor {
    /// `sensitivity` ∈ [0.0, 1.0]:
    ///   0 = only very obvious breath bursts detected
    ///   1 = very sensitive (risk of cutting soft speech)
    pub fn new(sample_rate: f32, sensitivity: f32) -> Self {
        let s = sensitivity.clamp(0.0, 1.0);
        // Ratio threshold: at s=0 → 0.80 (needs very strong mid dominance),
        // at s=1 → 0.50 (moderate mid dominance triggers suppression)
        let ratio_threshold  = 0.80 - s * 0.30;
        // Voice threshold: at s=0 → 0.06 (only clear breath pauses),
        // at s=1 → 0.03 (suppresses even quieter breaths between words)
        let voice_threshold  = 0.060 - s * 0.030;

        Self {
            broad_env:       0.0,
            mid_low:         0.0,
            mid_env:         0.0,
            gain_env:        1.0,
            broad_alpha:     one_pole_alpha(25.0, sample_rate),
            mid_lp_alpha:    one_pole_alpha(500.0, sample_rate),
            mid_env_alpha:   one_pole_alpha(40.0, sample_rate),
            gain_attack:     one_pole_alpha(200.0, sample_rate),  // ~5 ms
            gain_release:    one_pole_alpha(12.0, sample_rate),   // ~80 ms
            voice_threshold,
            ratio_threshold,
            max_amount:      0.40, // max 40% reduction — never mutes completely
        }
    }
}

impl AudioFilter for BreathSuppressor {
    fn process_sample(&mut self, sample: f32) -> f32 {
        let abs = sample.abs();

        // Broadband RMS envelope
        self.broad_env += self.broad_alpha * (abs - self.broad_env);

        // Mid-band proxy: HPF at 500 Hz via one-pole subtraction, then envelope
        self.mid_low += self.mid_lp_alpha * (sample - self.mid_low);
        let mid_signal = (sample - self.mid_low).abs();
        self.mid_env += self.mid_env_alpha * (mid_signal - self.mid_env);

        // Breath detection: mid-dominant, low overall level
        let spectral_ratio = if self.broad_env > 1e-6 {
            self.mid_env / self.broad_env
        } else {
            0.0
        };

        let is_breath = self.broad_env < self.voice_threshold
            && spectral_ratio > self.ratio_threshold;

        // Target gain: suppress by max_amount when breath detected
        let target_gain = if is_breath { 1.0 - self.max_amount } else { 1.0 };

        // Smooth gain with asymmetric attack/release to avoid clicks
        let alpha = if target_gain < self.gain_env {
            self.gain_attack
        } else {
            self.gain_release
        };
        self.gain_env += alpha * (target_gain - self.gain_env);

        sample * self.gain_env
    }

    fn reset(&mut self) {
        self.broad_env  = 0.0;
        self.mid_low    = 0.0;
        self.mid_env    = 0.0;
        self.gain_env   = 1.0;
    }

    fn name(&self) -> &'static str { "breath_suppressor" }
}
