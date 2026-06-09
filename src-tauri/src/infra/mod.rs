pub mod audio_cpal;
pub mod live_audio;
pub mod dsp_engine;
pub mod storage_local;
pub mod audio_analysis;
pub mod voice_layer_engine;
pub mod voice_preset;
pub mod filters;
pub mod pipeline;
pub mod separator;

// Re-export để dễ sử dụng
pub use audio_cpal::CpalRecorder;
pub use dsp_engine::DspEngine;
pub use live_audio::{LiveMicState, AudioDeviceInfo, get_audio_devices};
pub use storage_local::LocalStorage;
pub use audio_analysis::{AudioAnalysis, AudioAnalyzer};
pub use voice_layer_engine::{VoiceLayerEngine, VoiceLayerOptions};
pub use voice_preset::{EnhanceMode, VoicePreset, apply_voice_preset};
pub use pipeline::{DspPipeline, DspPipelineBuilder, PipelineConfig};
pub use separator::SeparationEngine;
