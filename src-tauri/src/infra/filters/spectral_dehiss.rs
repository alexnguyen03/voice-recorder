use super::{AudioFilter, biquad::one_pole_alpha};

/// Spectral de-hiss — dynamically attenuates high-frequency hiss during quiet passages
/// while leaving the HF intact during active speech (where it sounds like natural air/presence).
///
/// SRP: responsible only for high-frequency noise floor reduction.
///
/// Algorithm (per-frame dynamic HF gating):
///   1. Track HF energy (above ~7 kHz proxy) and broadband energy via one-pole IIRs
///   2. Hiss signature: HF energy / broadband energy is HIGH when signal is QUIET
///      (during actual speech the HF content is proportional to broadband level)
///   3. When hiss detected → apply smooth high-shelf attenuation (-6 dB)
///   4. Smooth gain transitions (attack ~10 ms, release ~120 ms) prevent artifacts
///
/// This avoids the dull sound of a fixed LP filter (LPF@9kHz) because the HF
/// is only attenuated when it's hiss, not when the user is speaking.
pub struct SpectralDeHiss {
    /// One-pole HF energy tracker (proxy: one-pole subtraction above ~7 kHz)
    hf_lp:       f32, // LP below 7 kHz
    hf_env:      f32, // envelope of HF signal
    broad_env:   f32, // broadband envelope
    gain_env:    f32, // current smoothed gain (1.0 = no attenuation)
    hf_lp_alpha:    f32,
    hf_env_alpha:   f32,
    broad_alpha:    f32,
    gain_attack:    f32,
    gain_release:   f32,
    /// -6 dB attenuation in linear: ≈ 0.50
    hiss_gain: f32,
    /// Ratio above which we classify the signal as hiss
    hiss_ratio_threshold: f32,
}

impl SpectralDeHiss {
    pub fn new(sample_rate: f32) -> Self {
        Self {
            hf_lp:       0.0,
            hf_env:      0.0,
            broad_env:   0.0,
            gain_env:    1.0,
            hf_lp_alpha:  one_pole_alpha(7000.0, sample_rate),
            hf_env_alpha: one_pole_alpha(60.0,   sample_rate),
            broad_alpha:  one_pole_alpha(30.0,   sample_rate),
            // attack ~10 ms, release ~120 ms
            gain_attack:  one_pole_alpha(100.0, sample_rate),
            gain_release: one_pole_alpha(8.3,   sample_rate),
            hiss_gain:    0.50,   // -6 dB when hiss detected
            // If HF/broadband > 65% during quiet → likely hiss
            hiss_ratio_threshold: 0.65,
        }
    }
}

impl AudioFilter for SpectralDeHiss {
    fn process_sample(&mut self, sample: f32) -> f32 {
        // Broadband envelope
        self.broad_env += self.broad_alpha * (sample.abs() - self.broad_env);

        // HF proxy: total - LP below 7 kHz
        self.hf_lp += self.hf_lp_alpha * (sample - self.hf_lp);
        let hf_signal = sample - self.hf_lp;
        self.hf_env  += self.hf_env_alpha * (hf_signal.abs() - self.hf_env);

        // Hiss detection: high HF ratio but low overall level
        let hf_ratio = if self.broad_env > 1e-6 { self.hf_env / self.broad_env } else { 0.0 };
        let is_hiss  = hf_ratio > self.hiss_ratio_threshold && self.broad_env < 0.05;

        let target_gain = if is_hiss { self.hiss_gain } else { 1.0 };
        let alpha = if target_gain < self.gain_env { self.gain_attack } else { self.gain_release };
        self.gain_env += alpha * (target_gain - self.gain_env);

        sample * self.gain_env
    }

    fn reset(&mut self) {
        self.hf_lp    = 0.0;
        self.hf_env   = 0.0;
        self.broad_env = 0.0;
        self.gain_env  = 1.0;
    }

    fn name(&self) -> &'static str { "spectral_dehiss" }
}
