use super::{AudioFilter, biquad::BiquadFilter};

/// Low-quality microphone equalisation fix.
///
/// SRP: responsible only for correcting cheap-mic frequency response artefacts.
///   - Triple-cascaded HPF @85 Hz to cut sub-bass rumble with steep roll-off
///   - Notch filters at 50 Hz and 60 Hz to eliminate mains hum (AC power)
///   - LP at 9 kHz to tame extreme high-frequency static from cheap capsules
pub struct MicEqFilter {
    hpf1:    BiquadFilter,
    hpf2:    BiquadFilter,
    hpf3:    BiquadFilter,
    notch50: BiquadFilter,
    notch60: BiquadFilter,
    hiss_lp: BiquadFilter,
}

impl MicEqFilter {
    pub fn new(sample_rate: f32) -> Self {
        Self {
            // Three cascaded HPFs for a very steep sub-bass roll-off (-18 dB/oct × 3 = -54 dB/oct)
            hpf1:    BiquadFilter::high_pass(sample_rate, 85.0, 0.707),
            hpf2:    BiquadFilter::high_pass(sample_rate, 85.0, 0.707),
            hpf3:    BiquadFilter::high_pass(sample_rate, 85.0, 0.707),
            // Tight notches (Q=10) — surgical removal of power-line hum
            notch50: BiquadFilter::notch(sample_rate, 50.0, 10.0),
            notch60: BiquadFilter::notch(sample_rate, 60.0, 10.0),
            // Soft LP to tame extreme hiss; moved to 9 kHz so voice clarity is preserved
            hiss_lp: BiquadFilter::low_pass(sample_rate, 9000.0, 0.707),
        }
    }
}

impl AudioFilter for MicEqFilter {
    fn process_sample(&mut self, sample: f32) -> f32 {
        let s = self.hpf1.tick(sample);
        let s = self.hpf2.tick(s);
        let s = self.hpf3.tick(s);
        let s = self.notch50.tick(s);
        let s = self.notch60.tick(s);
        self.hiss_lp.tick(s)
    }

    fn reset(&mut self) {
        self.hpf1.reset_state(); self.hpf2.reset_state(); self.hpf3.reset_state();
        self.notch50.reset_state(); self.notch60.reset_state(); self.hiss_lp.reset_state();
    }

    fn name(&self) -> &'static str { "mic_eq" }
}
