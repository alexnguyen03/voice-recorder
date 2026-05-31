use super::{AudioFilter, biquad::BiquadFilter};

/// Bass low-shelf filter — warms or thins the low-frequency body of a voice.
///
/// SRP: responsible only for bass EQ shaping.
/// Frequency: 200 Hz shelf — mirrors Web Audio bassNode.frequency = 200.
/// Gain range: (bass_boost - 0.5) × 30 → ±15 dB.
pub struct BassShelfFilter {
    biquad: BiquadFilter,
}

impl BassShelfFilter {
    /// `bass_boost` ∈ [0.0, 1.0]: 0.5 = flat, 0 = -15 dB, 1 = +15 dB.
    pub fn new(sample_rate: f32, bass_boost: f32) -> Self {
        let gain_db = (bass_boost - 0.5) * 30.0;
        Self { biquad: BiquadFilter::low_shelf(sample_rate, 200.0, gain_db) }
    }
}

impl AudioFilter for BassShelfFilter {
    fn process_sample(&mut self, sample: f32) -> f32 { self.biquad.tick(sample) }
    fn reset(&mut self) { self.biquad.reset_state(); }
    fn name(&self) -> &'static str { "bass_shelf" }
}

/// Treble high-shelf filter — adds clarity and air to the upper voice frequencies.
///
/// SRP: responsible only for treble EQ shaping.
/// Frequency: 4000 Hz shelf — mirrors Web Audio trebleNode.frequency = 4000.
/// Gain range: (treble_boost - 0.5) × 30 → ±15 dB.
pub struct TrebleShelfFilter {
    biquad: BiquadFilter,
}

impl TrebleShelfFilter {
    /// `treble_boost` ∈ [0.0, 1.0]: 0.5 = flat, 0 = -15 dB, 1 = +15 dB.
    pub fn new(sample_rate: f32, treble_boost: f32) -> Self {
        let gain_db = (treble_boost - 0.5) * 30.0;
        Self { biquad: BiquadFilter::high_shelf(sample_rate, 4000.0, gain_db) }
    }
}

impl AudioFilter for TrebleShelfFilter {
    fn process_sample(&mut self, sample: f32) -> f32 { self.biquad.tick(sample) }
    fn reset(&mut self) { self.biquad.reset_state(); }
    fn name(&self) -> &'static str { "treble_shelf" }
}
