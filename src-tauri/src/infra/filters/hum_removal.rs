use super::{AudioFilter, biquad::BiquadFilter};

/// Electrical mains hum removal filter.
///
/// SRP: removes power-line interference only — no HPF, no hiss LP, nothing else.
/// Two tightly-tuned notch filters (Q = 10) eliminate:
///   - 50 Hz  — European / Asian power grids
///   - 60 Hz  — North American power grids
///
/// This is intentionally separate from MicEqFilter so users can remove hum
/// without also applying the aggressive HPF and hiss roll-off of that filter.
pub struct HumRemovalFilter {
    notch50: BiquadFilter,
    notch60: BiquadFilter,
    /// Extra harmonic suppression: 2nd harmonics at 100 Hz and 120 Hz
    notch100: BiquadFilter,
    notch120: BiquadFilter,
}

impl HumRemovalFilter {
    pub fn new(sample_rate: f32) -> Self {
        Self {
            // Fundamental frequencies — very tight notch (Q=10)
            notch50:  BiquadFilter::notch(sample_rate, 50.0,  10.0),
            notch60:  BiquadFilter::notch(sample_rate, 60.0,  10.0),
            // 2nd harmonics — slightly wider (Q=6) since they carry more energy variation
            notch100: BiquadFilter::notch(sample_rate, 100.0, 6.0),
            notch120: BiquadFilter::notch(sample_rate, 120.0, 6.0),
        }
    }
}

impl AudioFilter for HumRemovalFilter {
    fn process_sample(&mut self, sample: f32) -> f32 {
        let s = self.notch50.tick(sample);
        let s = self.notch60.tick(s);
        let s = self.notch100.tick(s);
        self.notch120.tick(s)
    }

    fn reset(&mut self) {
        self.notch50.reset_state();
        self.notch60.reset_state();
        self.notch100.reset_state();
        self.notch120.reset_state();
    }

    fn name(&self) -> &'static str { "hum_removal" }
}
