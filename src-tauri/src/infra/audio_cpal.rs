use std::sync::{Arc, Mutex};
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use crate::core::models::{AppError, AudioBuffer, DeviceInfo, ErrorCode, RecordConfig};
use crate::core::traits::AudioRecorder;

/// Concrete implementation of AudioRecorder using the cross-platform `cpal` crate.
/// Safely captures microphone stream on an native OS thread and pipes it to a shared float buffer.
pub struct CpalRecorder {
    is_recording: bool,
    stream: Option<cpal::Stream>,
    buffer: Arc<Mutex<Vec<f32>>>,
    active_config: Option<RecordConfig>,
}

// cpal::Stream is !Send on some platforms (e.g. Windows COM interfaces)
// but it is safe to transfer and drop it inside a Mutex protected Tauri State.
unsafe impl Send for CpalRecorder {}
unsafe impl Sync for CpalRecorder {}

impl CpalRecorder {
    pub fn new() -> Self {
        Self {
            is_recording: false,
            stream: None,
            buffer: Arc::new(Mutex::new(Vec::new())),
            active_config: None,
        }
    }

    fn collect_samples<T>(data: &[T], channels: usize, mono: bool) -> Vec<f32>
    where
        T: cpal::Sample,
        f32: cpal::FromSample<T>,
    {
        if mono {
            let mut samples = Vec::with_capacity(data.len() / channels.max(1));
            for frame in data.chunks(channels.max(1)) {
                let mut sum = 0.0_f32;
                for sample in frame {
                    sum += (*sample).to_sample::<f32>();
                }
                samples.push(sum / frame.len() as f32);
            }
            samples
        } else {
            data.iter().map(|sample| (*sample).to_sample::<f32>()).collect()
        }
    }

    fn max_amplitude(samples: &[f32]) -> f32 {
        samples.iter().fold(0.0_f32, |max, sample| max.max(sample.abs()))
    }

    fn process_input_chunk<T>(data: &[T], channels: usize) -> Vec<f32>
    where
        T: cpal::Sample,
        f32: cpal::FromSample<T>,
    {
        Self::collect_samples(data, channels, false)
    }
}

impl AudioRecorder for CpalRecorder {
    fn list_devices(&self) -> Result<Vec<DeviceInfo>, AppError> {
        let host = cpal::default_host();
        let devices = host.input_devices().map_err(|e| AppError {
            code: ErrorCode::InitializationFailed,
            message: format!("Failed to access system input devices: {}", e),
        })?;

        let default_device_name = host.default_input_device().and_then(|d| d.name().ok());

        let mut device_infos = Vec::new();
        for device in devices {
            if let Ok(name) = device.name() {
                let is_default = default_device_name.as_ref() == Some(&name);
                device_infos.push(DeviceInfo {
                    id: name.clone(),
                    name,
                    is_default,
                });
            }
        }

        // Standard fallback: ensure at least one default device is flagged
        if !device_infos.iter().any(|d| d.is_default) && !device_infos.is_empty() {
            device_infos[0].is_default = true;
        }

        Ok(device_infos)
    }

    fn start_recording(
        &mut self,
        config: &RecordConfig,
        on_amplitude: Option<std::sync::Arc<dyn Fn(f32) + Send + Sync + 'static>>,
    ) -> Result<(), AppError> {
        if self.is_recording {
            return Err(AppError {
                code: ErrorCode::RecordingActive,
                message: "Recording is already active. Stop current recording first.".to_string(),
            });
        }

        let host = cpal::default_host();
        
        // Resolve target microphone device (explicit device_id or system default)
        let device = match &config.device_id {
            Some(id) if id != "default_mic" && !id.is_empty() => {
                host.input_devices()
                    .map_err(|e| AppError {
                        code: ErrorCode::InitializationFailed,
                        message: format!("Failed to iterate input devices: {}", e),
                    })?
                    .find(|d| d.name().map(|n| n == *id).unwrap_or(false))
                    .ok_or_else(|| AppError {
                        code: ErrorCode::DeviceNotFound,
                        message: format!("Requested input microphone not found: {}", id),
                    })?
            }
            _ => host.default_input_device().ok_or_else(|| AppError {
                code: ErrorCode::DeviceNotFound,
                message: "Default input microphone device not found".to_string(),
            })?,
        };

        // Fetch standard stream configuration
        let supported_config = device.default_input_config().map_err(|e| AppError {
            code: ErrorCode::InitializationFailed,
            message: format!("Failed to acquire default input config: {}", e),
        })?;

        let sample_rate = supported_config.sample_rate().0;
        let channels = supported_config.channels();
        let sample_format = supported_config.sample_format();
        let output_channels = channels;

        // Clear shared recording buffer securely
        {
            let mut buf = self.buffer.lock().map_err(|e| AppError {
                code: ErrorCode::InitializationFailed,
                message: format!("Audio shared buffer lock poisoned: {}", e),
            })?;
            buf.clear();
        }

        let shared_buffer = Arc::clone(&self.buffer);
        let err_callback = |err| {
            eprintln!("An error occurred on the cpal input stream: {}", err);
        };

        let on_amp_f32 = on_amplitude.clone();
        let on_amp_i16 = on_amplitude.clone();
        let on_amp_u16 = on_amplitude.clone();
        // Construct input stream based on supported system format
        let stream = match sample_format {
            cpal::SampleFormat::F32 => {
                device.build_input_stream(
                    &supported_config.into(),
                    move |data: &[f32], _: &_| {
                        let processed = Self::process_input_chunk(data, channels as usize);
                        if let Ok(mut buf) = shared_buffer.lock() {
                            buf.extend_from_slice(&processed);
                        }
                        if let Some(ref cb) = on_amp_f32 {
                            cb(Self::max_amplitude(&processed));
                        }
                    },
                    err_callback,
                    None
                )
            }
            cpal::SampleFormat::I16 => {
                device.build_input_stream(
                    &supported_config.into(),
                    move |data: &[i16], _: &_| {
                        let processed = Self::process_input_chunk(data, channels as usize);
                        if let Ok(mut buf) = shared_buffer.lock() {
                            buf.extend_from_slice(&processed);
                        }
                        if let Some(ref cb) = on_amp_i16 {
                            cb(Self::max_amplitude(&processed));
                        }
                    },
                    err_callback,
                    None
                )
            }
            cpal::SampleFormat::U16 => {
                device.build_input_stream(
                    &supported_config.into(),
                    move |data: &[u16], _: &_| {
                        let processed = Self::process_input_chunk(data, channels as usize);
                        if let Ok(mut buf) = shared_buffer.lock() {
                            buf.extend_from_slice(&processed);
                        }
                        if let Some(ref cb) = on_amp_u16 {
                            cb(Self::max_amplitude(&processed));
                        }
                    },
                    err_callback,
                    None
                )
            }
            _ => return Err(AppError {
                code: ErrorCode::InitializationFailed,
                message: "Unsupported audio sample format detected".to_string(),
            }),
        }.map_err(|e| AppError {
            code: ErrorCode::InitializationFailed,
            message: format!("Failed to build input stream: {}", e),
        })?;

        // Start playing the stream to capture samples
        stream.play().map_err(|e| AppError {
            code: ErrorCode::InitializationFailed,
            message: format!("Failed to activate stream capturing: {}", e),
        })?;

        self.stream = Some(stream);
        self.is_recording = true;
        self.active_config = Some(RecordConfig {
            device_id: config.device_id.clone(),
            sample_rate,
            channels: output_channels,
            bit_depth: 16,
            voice_enhance: false,
        });

        Ok(())
    }

    fn stop_recording(&mut self) -> Result<AudioBuffer, AppError> {
        if !self.is_recording {
            return Err(AppError {
                code: ErrorCode::NoActiveRecording,
                message: "Stop recording failed: no active session found".to_string(),
            });
        }

        // Safely pause and terminate the input stream
        if let Some(stream) = self.stream.take() {
            let _ = stream.pause();
        }

        self.is_recording = false;

        let samples = {
            let mut buf = self.buffer.lock().map_err(|e| AppError {
                code: ErrorCode::InitializationFailed,
                message: format!("Failed to unlock audio shared buffer: {}", e),
            })?;
            let samples = buf.clone();
            buf.clear();
            samples
        };

        let active = self.active_config.take().unwrap_or(RecordConfig {
            device_id: None,
            sample_rate: 44100,
            channels: 1,
            bit_depth: 16,
            voice_enhance: true,
        });

        Ok(AudioBuffer {
            samples,
            sample_rate: active.sample_rate,
            channels: active.channels,
        })
    }

    fn is_recording(&self) -> bool {
        self.is_recording
    }

    fn pause_recording(&mut self) -> Result<(), AppError> {
        if !self.is_recording {
            return Ok(());
        }
        if let Some(ref stream) = self.stream {
            stream.pause().map_err(|e| AppError {
                code: ErrorCode::InitializationFailed,
                message: format!("Failed to pause stream: {}", e),
            })?;
        }
        Ok(())
    }

    fn resume_recording(&mut self) -> Result<(), AppError> {
        if !self.is_recording {
            return Ok(());
        }
        if let Some(ref stream) = self.stream {
            stream.play().map_err(|e| AppError {
                code: ErrorCode::InitializationFailed,
                message: format!("Failed to resume stream: {}", e),
            })?;
        }
        Ok(())
    }
}
