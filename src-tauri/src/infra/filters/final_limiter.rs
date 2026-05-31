use super::AudioFilter;

/// Final output limiter — soft compression, volume scaling, and tanh soft-clipping.
///
/// SRP: responsible only for output gain staging and preventing digital clipping.
/// Must always be the LAST stage in the pipeline before writing to disk.
///
/// Chain:
///   soft_compress → linear volume gain → tanh soft-limit
pub struct FinalLimiter {
    linear_gain: f32,
}

impl FinalLimiter {
    /// `volume_boost` ∈ [0.0, 1.0]:
    ///   0.5 = 1× (unity gain)
    ///   1.0 = 4× boost
    ///   0.0 = 0.25× reduction
    /// Matches Web Audio gainNode formula in WaveformEditor.tsx.
    pub fn new(volume_boost: f32) -> Self {
        let linear_gain = if volume_boost >= 0.5 {
            1.0 + (volume_boost - 0.5) * 6.0
        } else {
            0.25 + (volume_boost / 0.5) * 0.75
        };
        Self { linear_gain }
    }

    #[inline]
    fn soft_compress(sample: f32) -> f32 {
        let threshold = 0.35_f32;
        let ratio     = 3.0_f32;
        let abs       = sample.abs();
        if abs <= threshold {
            return sample;
        }
        let compressed = threshold + (abs - threshold) / ratio;
        compressed.copysign(sample)
    }

    #[inline]
    fn soft_limit(sample: f32) -> f32 {
        sample.tanh().clamp(-0.92, 0.92)
    }
}

impl AudioFilter for FinalLimiter {
    fn process_sample(&mut self, sample: f32) -> f32 {
        let s = Self::soft_compress(sample);
        let s = s * self.linear_gain;
        Self::soft_limit(s)
    }

    fn reset(&mut self) {} // stateless

    fn name(&self) -> &'static str { "final_limiter" }
}
