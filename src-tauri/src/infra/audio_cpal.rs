use crate::core::models::{AppError, AudioBuffer, DeviceInfo, RecordConfig};
use crate::core::traits::AudioRecorder;

/// Hiện thực hóa bộ ghi âm sử dụng thư viện cpal.
pub struct CpalRecorder {
    is_recording: bool,
}

impl CpalRecorder {
    pub fn new() -> Self {
        Self {
            is_recording: false,
        }
    }
}

impl AudioRecorder for CpalRecorder {
    fn list_devices(&self) -> Result<Vec<DeviceInfo>, AppError> {
        // BẢN MẪU: Sẽ được cài đặt chi tiết bằng cpal sau.
        Ok(vec![
            DeviceInfo {
                id: "default_mic".to_string(),
                name: "Default Microphone (System)".to_string(),
                is_default: true,
            },
        ])
    }

    fn start_recording(&mut self, _config: &RecordConfig) -> Result<(), AppError> {
        // BẢN MẪU: Khởi động luồng thu âm của cpal.
        self.is_recording = true;
        Ok(())
    }

    fn stop_recording(&mut self) -> Result<AudioBuffer, AppError> {
        // BẢN MẪU: Dừng luồng và trích xuất dữ liệu.
        self.is_recording = false;
        Ok(AudioBuffer {
            samples: vec![0.0; 1024], // Dữ liệu rỗng giả lập
            sample_rate: 44100,
            channels: 1,
        })
    }

    fn is_recording(&self) -> bool {
        self.is_recording
    }
}
