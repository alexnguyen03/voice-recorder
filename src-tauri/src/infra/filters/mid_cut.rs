use super::{AudioFilter, biquad::BiquadFilter};

/// Parametric mid-frequency cut — kills harsh resonances typical of cheap mic capsules.
///
/// SRP: responsible only for mid-band resonance correction.
/// Uses a peaking (bell) EQ with adjustable center frequency, Q, and gain.
/// Typical use: -4 to -8 dB cut at 1.0–2.5 kHz to remove plastic housing resonance.
pub struct MidCutFilter {
    biquad: BiquadFilter,
}

impl MidCutFilter {
    /// - `freq_hz`   : center of the cut (recommended: 1000–2500 Hz)
    /// - `q`         : bandwidth — higher Q = narrower cut (recommended: 1.5–3.0)
    /// - `gain_db`   : should be ≤ 0 for a cut (0 = bypass, -12 = maximum cut)
    pub fn new(sample_rate: f32, freq_hz: f32, q: f32, gain_db: f32) -> Self {
        // Clamp gain to cut-only range; boosts here would colour voice unnaturally
        let gain = gain_db.min(0.0).max(-18.0);
        Self { biquad: BiquadFilter::peaking(sample_rate, freq_hz, q, gain) }
    }
}

impl AudioFilter for MidCutFilter {
    fn process_sample(&mut self, sample: f32) -> f32 { self.biquad.tick(sample) }
    fn reset(&mut self) { self.biquad.reset_state(); }
    fn name(&self) -> &'static str { "mid_cut" }
}
