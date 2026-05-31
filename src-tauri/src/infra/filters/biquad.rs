use std::f32::consts::PI;

/// Second-order IIR biquad filter using Direct Form I.
///
/// SRP: knows only biquad mathematics.
/// Knows nothing about voice, music, or context — it is a primitive.
/// All higher-level filters compose BiquadFilter instances internally.
#[derive(Clone, Debug)]
pub struct BiquadFilter {
    // Feed-forward coefficients
    pub b0: f32,
    pub b1: f32,
    pub b2: f32,
    // Feed-back coefficients (a0 normalised to 1)
    pub a1: f32,
    pub a2: f32,
    // Delay-line state
    x1: f32,
    x2: f32,
    y1: f32,
    y2: f32,
}

impl BiquadFilter {
    // ── Constructors ──────────────────────────────────────────────────────────

    /// Transparent pass-through (all coefficients are identity).
    pub fn bypass() -> Self {
        Self { b0: 1.0, b1: 0.0, b2: 0.0, a1: 0.0, a2: 0.0, x1: 0.0, x2: 0.0, y1: 0.0, y2: 0.0 }
    }

    /// 2nd-order Butterworth high-pass filter.
    pub fn high_pass(sample_rate: f32, cutoff_hz: f32, q: f32) -> Self {
        let w0 = 2.0 * PI * cutoff_hz / sample_rate;
        let alpha = w0.sin() / (2.0 * q);
        let cos_w0 = w0.cos();
        let b0 = (1.0 + cos_w0) / 2.0;
        let b1 = -(1.0 + cos_w0);
        let b2 = (1.0 + cos_w0) / 2.0;
        let a0 = 1.0 + alpha;
        let a1 = -2.0 * cos_w0;
        let a2 = 1.0 - alpha;
        Self::from_raw(b0, b1, b2, a0, a1, a2)
    }

    /// 2nd-order Butterworth low-pass filter.
    pub fn low_pass(sample_rate: f32, cutoff_hz: f32, q: f32) -> Self {
        let w0 = 2.0 * PI * cutoff_hz / sample_rate;
        let alpha = w0.sin() / (2.0 * q);
        let cos_w0 = w0.cos();
        let b0 = (1.0 - cos_w0) / 2.0;
        let b1 = 1.0 - cos_w0;
        let b2 = (1.0 - cos_w0) / 2.0;
        let a0 = 1.0 + alpha;
        let a1 = -2.0 * cos_w0;
        let a2 = 1.0 - alpha;
        Self::from_raw(b0, b1, b2, a0, a1, a2)
    }

    /// Notch (band-reject) filter — eliminates a narrow frequency band.
    pub fn notch(sample_rate: f32, freq_hz: f32, q: f32) -> Self {
        let w0 = 2.0 * PI * freq_hz / sample_rate;
        let alpha = w0.sin() / (2.0 * q);
        let cos_w0 = w0.cos();
        let b0 = 1.0;
        let b1 = -2.0 * cos_w0;
        let b2 = 1.0;
        let a0 = 1.0 + alpha;
        let a1 = -2.0 * cos_w0;
        let a2 = 1.0 - alpha;
        Self::from_raw(b0, b1, b2, a0, a1, a2)
    }

    /// Low-frequency shelf (bass boost/cut).
    pub fn low_shelf(sample_rate: f32, cutoff_hz: f32, gain_db: f32) -> Self {
        if gain_db == 0.0 { return Self::bypass(); }
        let a = 10.0f32.powf(gain_db / 40.0);
        let w0 = 2.0 * PI * cutoff_hz / sample_rate;
        let cos_w0 = w0.cos();
        let alpha = (w0.sin() / 2.0) * ((a + 1.0 / a) * (1.0 - 1.0) + 2.0).sqrt();
        let b0 = a * ((a + 1.0) - (a - 1.0) * cos_w0 + 2.0 * a.sqrt() * alpha);
        let b1 = 2.0 * a * ((a - 1.0) - (a + 1.0) * cos_w0);
        let b2 = a * ((a + 1.0) - (a - 1.0) * cos_w0 - 2.0 * a.sqrt() * alpha);
        let a0 = (a + 1.0) + (a - 1.0) * cos_w0 + 2.0 * a.sqrt() * alpha;
        let a1 = -2.0 * ((a - 1.0) + (a + 1.0) * cos_w0);
        let a2 = (a + 1.0) + (a - 1.0) * cos_w0 - 2.0 * a.sqrt() * alpha;
        Self::from_raw(b0, b1, b2, a0, a1, a2)
    }

    /// High-frequency shelf (treble boost/cut).
    pub fn high_shelf(sample_rate: f32, cutoff_hz: f32, gain_db: f32) -> Self {
        if gain_db == 0.0 { return Self::bypass(); }
        let a = 10.0f32.powf(gain_db / 40.0);
        let w0 = 2.0 * PI * cutoff_hz / sample_rate;
        let cos_w0 = w0.cos();
        let alpha = (w0.sin() / 2.0) * ((a + 1.0 / a) * (1.0 - 1.0) + 2.0).sqrt();
        let b0 = a * ((a + 1.0) + (a - 1.0) * cos_w0 + 2.0 * a.sqrt() * alpha);
        let b1 = -2.0 * a * ((a - 1.0) + (a + 1.0) * cos_w0);
        let b2 = a * ((a + 1.0) + (a - 1.0) * cos_w0 - 2.0 * a.sqrt() * alpha);
        let a0 = (a + 1.0) - (a - 1.0) * cos_w0 + 2.0 * a.sqrt() * alpha;
        let a1 = 2.0 * ((a - 1.0) - (a + 1.0) * cos_w0);
        let a2 = (a + 1.0) - (a - 1.0) * cos_w0 - 2.0 * a.sqrt() * alpha;
        Self::from_raw(b0, b1, b2, a0, a1, a2)
    }

    /// Peaking (bell) EQ — boost or cut a narrow frequency band.
    /// gain_db < 0 = cut (e.g. resonance removal), gain_db > 0 = boost.
    pub fn peaking(sample_rate: f32, freq_hz: f32, q: f32, gain_db: f32) -> Self {
        if gain_db == 0.0 { return Self::bypass(); }
        let a = 10.0f32.powf(gain_db / 40.0);
        let w0 = 2.0 * PI * freq_hz / sample_rate;
        let alpha = w0.sin() / (2.0 * q);
        let cos_w0 = w0.cos();
        let b0 = 1.0 + alpha * a;
        let b1 = -2.0 * cos_w0;
        let b2 = 1.0 - alpha * a;
        let a0 = 1.0 + alpha / a;
        let a1 = -2.0 * cos_w0;
        let a2 = 1.0 - alpha / a;
        Self::from_raw(b0, b1, b2, a0, a1, a2)
    }

    // ── Processing ────────────────────────────────────────────────────────────

    /// Process one sample through the biquad (Direct Form I).
    #[inline(always)]
    pub fn tick(&mut self, x: f32) -> f32 {
        let y = self.b0 * x + self.b1 * self.x1 + self.b2 * self.x2
               - self.a1 * self.y1 - self.a2 * self.y2;
        self.x2 = self.x1; self.x1 = x;
        self.y2 = self.y1; self.y1 = y;
        y
    }

    /// Clear delay-line state (keeps coefficients).
    pub fn reset_state(&mut self) {
        self.x1 = 0.0; self.x2 = 0.0;
        self.y1 = 0.0; self.y2 = 0.0;
    }

    /// Update coefficients in-place while preserving state to prevent audio pops.
    pub fn update_coeffs(&mut self, src: &BiquadFilter) {
        self.b0 = src.b0; self.b1 = src.b1; self.b2 = src.b2;
        self.a1 = src.a1; self.a2 = src.a2;
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    fn from_raw(b0: f32, b1: f32, b2: f32, a0: f32, a1: f32, a2: f32) -> Self {
        Self {
            b0: b0 / a0, b1: b1 / a0, b2: b2 / a0,
            a1: a1 / a0, a2: a2 / a0,
            x1: 0.0, x2: 0.0, y1: 0.0, y2: 0.0,
        }
    }
}

/// Helper: compute one-pole IIR alpha coefficient from a corner frequency.
/// α = dt / (RC + dt) where RC = 1/(2π·freq).
pub fn one_pole_alpha(freq_hz: f32, sample_rate: f32) -> f32 {
    let freq = freq_hz.max(1.0);
    let sr   = sample_rate.max(freq * 2.0);
    let rc   = 1.0 / (2.0 * PI * freq);
    let dt   = 1.0 / sr;
    (dt / (rc + dt)).clamp(0.0, 1.0)
}
