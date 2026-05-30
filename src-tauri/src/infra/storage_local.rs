use crate::core::models::{AppError, AudioBuffer, ErrorCode};
use crate::core::traits::AudioStorage;

/// Concrete implementation of local audio storage utilizing the `hound` crate.
pub struct LocalStorage;

impl LocalStorage {
    pub fn new() -> Self {
        Self
    }
}

impl AudioStorage for LocalStorage {
    fn save_file(&self, buffer: &AudioBuffer, path: &str) -> Result<(), AppError> {
        if path.is_empty() {
            return Err(AppError {
                code: ErrorCode::StorageError,
                message: "WAV output file path cannot be empty".to_string(),
            });
        }

        // Configure WAV specifications for standard 16-bit PCM Mono/Stereo
        let spec = hound::WavSpec {
            channels: buffer.channels,
            sample_rate: buffer.sample_rate,
            bits_per_sample: 16,
            sample_format: hound::SampleFormat::Int,
        };

        let mut writer = hound::WavWriter::create(path, spec).map_err(|e| AppError {
            code: ErrorCode::StorageError,
            message: format!("Failed to create WAV writer: {}", e),
        })?;

        // Write f32 floating samples converted to standard 16-bit signed integers
        for &sample in &buffer.samples {
            let clamped = sample.clamp(-1.0, 1.0);
            let int_sample = (clamped * i16::MAX as f32) as i16;
            writer.write_sample(int_sample).map_err(|e| AppError {
                code: ErrorCode::StorageError,
                message: format!("Failed to write audio sample: {}", e),
            })?;
        }

        writer.finalize().map_err(|e| AppError {
            code: ErrorCode::StorageError,
            message: format!("Failed to finalize WAV file: {}", e),
        })?;

        Ok(())
    }

    fn load_file(&self, path: &str) -> Result<AudioBuffer, AppError> {
        if path.is_empty() {
            return Err(AppError {
                code: ErrorCode::StorageError,
                message: "WAV input file path cannot be empty".to_string(),
            });
        }

        let mut reader = hound::WavReader::open(path).map_err(|e| AppError {
            code: ErrorCode::StorageError,
            message: format!("Failed to open WAV reader: {}", e),
        })?;

        let spec = reader.spec();
        let mut samples = Vec::new();

        // Standardize reading int16 samples back into normalized floating point buffers
        for sample in reader.samples::<i16>() {
            let s = sample.map_err(|e| AppError {
                code: ErrorCode::StorageError,
                message: format!("Failed to parse WAV sample: {}", e),
            })?;
            let float_sample = s as f32 / i16::MAX as f32;
            samples.push(float_sample);
        }

        Ok(AudioBuffer {
            samples,
            sample_rate: spec.sample_rate,
            channels: spec.channels,
        })
    }
}
