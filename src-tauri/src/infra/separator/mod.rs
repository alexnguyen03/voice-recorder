use crate::core::models::AudioBuffer;

// ── Sub-modules ────────────────────────────────────────────────────────────────
pub mod stft_helper;
pub mod model_cache;
pub mod mdxnet;
pub mod engine;

pub use engine::SeparationEngine;
pub use model_cache::ModelCache;

/// The two stems produced by source separation.
#[derive(Debug, Clone)]
pub struct StemOutput {
    /// The isolated vocal track (same length as input).
    pub vocals: Vec<f32>,
    /// Everything that is not vocal: instruments, ambient sound, background voices.
    pub accompaniment: Vec<f32>,
    pub sample_rate: u32,
    pub channels: u16,
}

impl StemOutput {
    /// Export vocal stem as an AudioBuffer for saving to disk.
    pub fn vocals_buffer(&self) -> AudioBuffer {
        AudioBuffer {
            samples: self.vocals.clone(),
            sample_rate: self.sample_rate,
            channels: self.channels,
        }
    }

    /// Export accompaniment stem as an AudioBuffer.
    pub fn accompaniment_buffer(&self) -> AudioBuffer {
        AudioBuffer {
            samples: self.accompaniment.clone(),
            sample_rate: self.sample_rate,
            channels: self.channels,
        }
    }
}

/// Core strategy abstraction — Strategy Pattern.
///
/// OCP: new models (Demucs, Spleeter) implement this trait; SeparationEngine never changes.
/// DIP: SeparationEngine depends on this trait, not on MdxNetStrategy directly.
pub trait SeparatorStrategy: Send + Sync {
    /// Run model inference on a stereo STFT chunk.
    /// `input` shape: `[batch=1, channels×2, freq_bins, time_frames]` (interleaved real+imag)
    /// Returns a mask of the same shape applied to extract vocals.
    fn infer_chunk(
        &mut self,
        input: ndarray::Array4<f32>,
    ) -> Result<ndarray::Array4<f32>, String>;

    fn n_fft(&self)      -> usize;
    fn hop_length(&self) -> usize;
    fn chunk_frames(&self) -> usize;
    fn overlap(&self)    -> f32;

    fn model_name(&self) -> &'static str;
}
