use crate::core::models::{AppError, AudioBuffer, ErrorCode};
use crate::core::traits::AudioStorage;

/// Concrete implementation of local audio storage.
pub struct LocalStorage;

impl LocalStorage {
    pub fn new() -> Self {
        Self
    }
}

impl AudioStorage for LocalStorage {
    fn save_file(&self, buffer: &AudioBuffer, path: &str) -> Result<(), AppError> {
        // SKELETON: Will use hound or symphonia to encode and write WAV/MP3 files.
        if path.is_empty() {
            return Err(AppError {
                code: ErrorCode::StorageError,
                message: "File path cannot be empty".to_string(),
            });
        }
        println!("Saving {} audio samples to {}", buffer.samples.len(), path);
        Ok(())
    }

    fn load_file(&self, path: &str) -> Result<AudioBuffer, AppError> {
        // SKELETON: Will read audio files and convert to standard PCM Float32 buffers.
        if path.is_empty() {
            return Err(AppError {
                code: ErrorCode::StorageError,
                message: "File path cannot be empty".to_string(),
            });
        }
        Ok(AudioBuffer {
            samples: vec![0.0; 1024],
            sample_rate: 44100,
            channels: 1,
        })
    }
}
