use crate::core::models::{AppError, AudioBuffer, ErrorCode};
use crate::core::traits::AudioStorage;

/// Hiện thực bộ lưu trữ tập tin âm thanh cục bộ.
pub struct LocalStorage;

impl LocalStorage {
    pub fn new() -> Self {
        Self
    }
}

impl AudioStorage for LocalStorage {
    fn save_file(&self, buffer: &AudioBuffer, path: &str) -> Result<(), AppError> {
        // BẢN MẪU: Sử dụng hound hoặc symphonia để ghi file .wav/.mp3.
        if path.is_empty() {
            return Err(AppError {
                code: ErrorCode::StorageError,
                message: "Đường dẫn file không được rỗng".to_string(),
            });
        }
        println!("Đang lưu {} mẫu dữ liệu vào {}", buffer.samples.len(), path);
        Ok(())
    }

    fn load_file(&self, path: &str) -> Result<AudioBuffer, AppError> {
        // BẢN MẪU: Đọc file và chuyển đổi sang PCM Float32.
        if path.is_empty() {
            return Err(AppError {
                code: ErrorCode::StorageError,
                message: "Đường dẫn file không được rỗng".to_string(),
            });
        }
        Ok(AudioBuffer {
            samples: vec![0.0; 1024],
            sample_rate: 44100,
            channels: 1,
        })
    }
}
