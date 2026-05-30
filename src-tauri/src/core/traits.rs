use crate::core::models::{AppError, AudioBuffer, DeviceInfo, RecordConfig};

/// Trait định nghĩa giao tiếp với phần cứng Microphone để ghi âm trực tiếp.
pub trait AudioRecorder: Send + Sync {
    /// Lấy danh sách các thiết bị đầu vào (Microphone) khả dụng trên hệ thống.
    fn list_devices(&self) -> Result<Vec<DeviceInfo>, AppError>;

    /// Bắt đầu ghi âm với cấu hình chỉ định và một callback tùy chọn trả về biên độ sóng âm.
    fn start_recording(
        &mut self,
        config: &RecordConfig,
        on_amplitude: Option<std::sync::Arc<dyn Fn(f32) + Send + Sync + 'static>>,
    ) -> Result<(), AppError>;

    /// Dừng ghi âm và trả về bộ đệm âm thanh PCM thu được.
    fn stop_recording(&mut self) -> Result<AudioBuffer, AppError>;

    /// Kiểm tra xem thiết bị có đang trong quá trình ghi âm hay không.
    fn is_recording(&self) -> bool;
}

/// Trait định nghĩa bộ xử lý tín hiệu số (DSP) để lọc tiếng ồn và tăng chi tiết giọng nói.
pub trait AudioProcessor: Send + Sync {
    /// Áp dụng các bộ lọc khử nhiễu (Noise Suppression) trên luồng dữ liệu.
    fn suppress_noise(&self, input: &[f32]) -> Result<Vec<f32>, AppError>;

    /// Tăng độ chi tiết giọng nói bằng cách chỉnh Equalizer (Bass/Treble boost) và Compressor.
    fn enhance_voice(&self, input: &[f32], bass_boost: f32, treble_boost: f32) -> Result<Vec<f32>, AppError>;
}

/// Trait định nghĩa việc đọc/ghi dữ liệu âm thanh xuống đĩa cứng (File System).
pub trait AudioStorage: Send + Sync {
    /// Lưu trữ AudioBuffer thành file (WAV/MP3/...) tại đường dẫn chỉ định.
    fn save_file(&self, buffer: &AudioBuffer, path: &str) -> Result<(), AppError>;

    /// Đọc file âm thanh từ đĩa và đưa về dạng AudioBuffer PCM chuẩn.
    fn load_file(&self, path: &str) -> Result<AudioBuffer, AppError>;
}
