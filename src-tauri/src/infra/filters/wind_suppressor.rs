use super::{AudioFilter, biquad::{BiquadFilter, one_pole_alpha}};

/// Suppresses outdoor wind rumble and low-frequency environmental noise.
///
/// SRP: responsible only for wind/rumble removal.
/// Strategy: adapts HPF cutoff based on detected low-frequency energy ratio —
/// light mode (120 Hz) for indoor rumble, aggressive mode (200 Hz) for strong wind.
///
/// Algorithm:
///   1. Track rolling low-freq energy (≤ 200 Hz) and total energy via one-pole IIRs
///   2. If low_energy / total_energy > 0.55 → wind detected → switch to aggressive HPF
///   3. Two cascaded 2nd-order Butterworth HPFs for a steeper roll-off (-80 dB/decade)
pub struct WindSuppressor {
    hpf1: BiquadFilter,
    hpf2: BiquadFilter,
    /// Aggressive HPFs at a higher cutoff for strong wind
    hpf1_aggressive: BiquadFilter,
    hpf2_aggressive: BiquadFilter,
    /// One-pole IIR for low-freq energy (≤ 200 Hz band proxy)
    low_energy: f32,
    /// One-pole IIR for broadband energy
    total_energy: f32,
    /// Smoothed wind detection flag (0.0 = calm, 1.0 = strong wind)
    wind_amount: f32,
    low_alpha: f32,
    total_alpha: f32,
    wind_attack: f32,
    wind_release: f32,
    /// User intensity: 0.0–1.0 — scales how aggressively the cutoff rises
    intensity: f32,
}

impl WindSuppressor {
    /// `intensity` ∈ [0.0, 1.0]: 0 = light (120 Hz HPF), 1 = maximum (220 Hz HPF).
    pub fn new(sample_rate: f32, intensity: f32) -> Self {
        let intensity = intensity.clamp(0.0, 1.0);
        // Normal cutoff: 120 Hz — enough for most indoor rumble
        let normal_cutoff = 120.0_f32;
        // Aggressive cutoff interpolated by intensity: 160–220 Hz
        let agg_cutoff = 160.0 + intensity * 60.0;
        let q = 0.9_f32; // Slight resonance for sharper knee

        Self {
            hpf1: BiquadFilter::high_pass(sample_rate, normal_cutoff, q),
            hpf2: BiquadFilter::high_pass(sample_rate, normal_cutoff, q),
            hpf1_aggressive: BiquadFilter::high_pass(sample_rate, agg_cutoff, q),
            hpf2_aggressive: BiquadFilter::high_pass(sample_rate, agg_cutoff, q),
            low_energy:   0.0,
            total_energy: 0.0,
            wind_amount:  0.0,
            // Low-freq energy tracker: very slow (8 Hz) so it isn't fooled by voice transients
            low_alpha:    one_pole_alpha(8.0, sample_rate),
            total_alpha:  one_pole_alpha(12.0, sample_rate),
            // Wind detection: fast attack (1 s equivalent), slow release (3 s) for stability
            wind_attack:  one_pole_alpha(0.33, sample_rate),
            wind_release: one_pole_alpha(0.11, sample_rate),
            intensity,
        }
    }
}

impl AudioFilter for WindSuppressor {
    fn process_sample(&mut self, sample: f32) -> f32 {
        let abs = sample.abs();
        // Update energy trackers
        self.total_energy += self.total_alpha * (abs - self.total_energy);

        // Estimate low-freq proxy: LP at ~200 Hz using one-pole
        let lp_alpha = one_pole_alpha(200.0, 44100.0); // approximate; not hot-reloaded
        let low_proxy = sample * lp_alpha; // rough magnitude at low freq
        self.low_energy += self.low_alpha * (low_proxy.abs() - self.low_energy);

        // Wind ratio: if >55% of total energy is below 200 Hz → wind
        let wind_ratio = if self.total_energy > 1e-6 {
            self.low_energy / self.total_energy
        } else {
            0.0
        };
        let wind_target = if wind_ratio > 0.55 { self.intensity } else { 0.0 };
        let alpha = if wind_target > self.wind_amount { self.wind_attack } else { self.wind_release };
        self.wind_amount += alpha * (wind_target - self.wind_amount);

        // Blend between normal and aggressive HPF cascade
        let normal_out = self.hpf2.tick(self.hpf1.tick(sample));
        let agg_out    = self.hpf2_aggressive.tick(self.hpf1_aggressive.tick(sample));
        normal_out * (1.0 - self.wind_amount) + agg_out * self.wind_amount
    }

    fn reset(&mut self) {
        self.hpf1.reset_state(); self.hpf2.reset_state();
        self.hpf1_aggressive.reset_state(); self.hpf2_aggressive.reset_state();
        self.low_energy   = 0.0;
        self.total_energy = 0.0;
        self.wind_amount  = 0.0;
    }

    fn name(&self) -> &'static str { "wind_suppressor" }
}
