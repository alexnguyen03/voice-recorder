/// Core abstraction for every DSP processing unit in the pipeline.
///
/// SOLID compliance:
///   S – each implementor has a single, well-defined responsibility
///   O – new filters extend this trait; the pipeline is closed to modification
///   L – all implementations are substitutable inside DspPipeline
///   I – minimal interface: only what every filter must provide
///   D – DspPipeline depends on this trait, never on concrete filter types
pub trait AudioFilter: Send + Sync {
    /// Process a single sample and return the processed value.
    /// For stateful filters (IIR, envelope followers) state persists between calls.
    fn process_sample(&mut self, sample: f32) -> f32;

    /// Batch-process a flat mono sample buffer.
    /// Default implementation delegates to process_sample.
    fn process_buffer(&mut self, samples: &[f32]) -> Vec<f32> {
        samples.iter().map(|&s| self.process_sample(s)).collect()
    }

    /// Process an interleaved multi-channel buffer.
    /// Channels are processed independently so filter state does not bleed
    /// across channels — each channel gets a clean pass with reset state.
    fn process_interleaved(&mut self, samples: &[f32], channels: u16) -> Vec<f32> {
        let ch = channels.max(1) as usize;
        if ch == 1 {
            return self.process_buffer(samples);
        }
        let mut out = samples.to_vec();
        for ch_idx in 0..ch {
            self.reset();
            let mut idx = ch_idx;
            while idx < out.len() {
                out[idx] = self.process_sample(out[idx]);
                idx += ch;
            }
        }
        out
    }

    /// Reset all internal delay-lines, envelope followers, and gate state.
    /// Called between channel passes in multi-channel processing.
    fn reset(&mut self);

    /// Human-readable name for debugging and logging.
    fn name(&self) -> &'static str;
}

// ── Sub-modules ────────────────────────────────────────────────────────────────
pub mod biquad;
pub mod bypass;
pub mod wind_suppressor;
pub mod breath_suppressor;
pub mod plosive_reducer;
pub mod noise_gate;
pub mod mic_eq;
pub mod eq_shelf;
pub mod mid_cut;
pub mod spectral_dehiss;
pub mod final_limiter;
pub mod hum_removal;

// Re-exports for ergonomic use inside the crate
pub use bypass::BypassFilter;
pub use wind_suppressor::WindSuppressor;
pub use breath_suppressor::BreathSuppressor;
pub use plosive_reducer::PlosiveReducer;
pub use noise_gate::NoiseGate;
pub use mic_eq::MicEqFilter;
pub use eq_shelf::{BassShelfFilter, TrebleShelfFilter};
pub use mid_cut::MidCutFilter;
pub use spectral_dehiss::SpectralDeHiss;
pub use final_limiter::FinalLimiter;
pub use hum_removal::HumRemovalFilter;
