use crate::core::models::{AppError, AudioBuffer, DeviceInfo, RecordConfig};
use crate::core::traits::AudioRecorder;

/// Concrete implementation of AudioRecorder using the cpal crate.
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
        // SKELETON: Will scan actual audio hardware using cpal later.
        Ok(vec![
            DeviceInfo {
                id: "default_mic".to_string(),
                name: "Default Microphone (System)".to_string(),
                is_default: true,
            },
        ])
    }

    fn start_recording(&mut self, _config: &RecordConfig) -> Result<(), AppError> {
        // SKELETON: Will initialize and launch the cpal input stream.
        self.is_recording = true;
        Ok(())
    }

    fn stop_recording(&mut self) -> Result<AudioBuffer, AppError> {
        // SKELETON: Will stop the stream and return captured PCM data.
        self.is_recording = false;
        Ok(AudioBuffer {
            samples: vec![0.0; 1024], // Mock raw PCM buffer data
            sample_rate: 44100,
            channels: 1,
        })
    }

    fn is_recording(&self) -> bool {
        self.is_recording
    }
}
