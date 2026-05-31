use super::AudioFilter;

/// Transparent pass-through that satisfies the AudioFilter contract.
///
/// Pattern: Null Object
/// Purpose: replace conditional `if enabled { filter.process() } else { sample }`
/// with a clean polymorphic call — zero overhead, zero branches.
pub struct BypassFilter;

impl AudioFilter for BypassFilter {
    #[inline(always)]
    fn process_sample(&mut self, sample: f32) -> f32 { sample }

    #[inline(always)]
    fn process_buffer(&mut self, samples: &[f32]) -> Vec<f32> { samples.to_vec() }

    fn reset(&mut self) {} // no state to reset

    fn name(&self) -> &'static str { "bypass" }
}
