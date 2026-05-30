use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{SampleFormat, Stream};
use std::sync::{mpsc, Arc, Mutex};
use crate::infra::dsp_engine::LiveDspSession;

pub struct AudioDeviceInfo {
    pub name: String,
    pub is_input: bool,
}

pub fn get_audio_devices() -> Vec<AudioDeviceInfo> {
    let host = cpal::default_host();
    let mut devices = Vec::new();
    
    if let Ok(input_devices) = host.input_devices() {
        for device in input_devices {
            if let Ok(name) = device.name() {
                devices.push(AudioDeviceInfo { name, is_input: true });
            }
        }
    }
    
    if let Ok(output_devices) = host.output_devices() {
        for device in output_devices {
            if let Ok(name) = device.name() {
                devices.push(AudioDeviceInfo { name, is_input: false });
            }
        }
    }
    
    devices
}

pub struct LiveMicState {
    pub input_stream: Option<Stream>,
    pub output_stream: Option<Stream>,
    pub dsp_session: Arc<Mutex<LiveDspSession>>,
}

impl LiveMicState {
    pub fn new() -> Self {
        Self {
            input_stream: None,
            output_stream: None,
            dsp_session: Arc::new(Mutex::new(LiveDspSession::new())),
        }
    }

    pub fn start(&mut self, input_name: &str, output_name: &str) -> Result<(), String> {
        let host = cpal::default_host();
        
        let input_device = host.input_devices()
            .map_err(|e| e.to_string())?
            .find(|x| x.name().unwrap_or_default() == input_name)
            .ok_or("Input device not found")?;
            
        let output_device = host.output_devices()
            .map_err(|e| e.to_string())?
            .find(|x| x.name().unwrap_or_default() == output_name)
            .ok_or("Output device not found")?;
            
        let input_config = input_device.default_input_config().map_err(|e| e.to_string())?;
        let output_config = output_device.default_output_config().map_err(|e| e.to_string())?;

        let sample_rate = input_config.sample_rate().0 as f32;
        
        // MPSC for chunks
        let (tx, rx) = mpsc::sync_channel::<Vec<f32>>(100);
        
        // Build input stream
        let input_stream = match input_config.sample_format() {
            SampleFormat::F32 => Self::build_input_stream::<f32>(&input_device, &input_config.into(), tx)?,
            SampleFormat::I16 => Self::build_input_stream::<i16>(&input_device, &input_config.into(), tx)?,
            SampleFormat::U16 => Self::build_input_stream::<u16>(&input_device, &input_config.into(), tx)?,
            _ => return Err("Unsupported input sample format".to_string()),
        };

        let dsp = self.dsp_session.clone();
        
        // Build output stream
        let output_stream = match output_config.sample_format() {
            SampleFormat::F32 => Self::build_output_stream::<f32>(&output_device, &output_config.into(), rx, dsp)?,
            SampleFormat::I16 => Self::build_output_stream::<i16>(&output_device, &output_config.into(), rx, dsp)?,
            SampleFormat::U16 => Self::build_output_stream::<u16>(&output_device, &output_config.into(), rx, dsp)?,
            _ => return Err("Unsupported output sample format".to_string()),
        };

        input_stream.play().map_err(|e| e.to_string())?;
        output_stream.play().map_err(|e| e.to_string())?;

        self.input_stream = Some(input_stream);
        self.output_stream = Some(output_stream);
        Ok(())
    }

    pub fn stop(&mut self) {
        self.input_stream = None;
        self.output_stream = None;
    }

    pub fn update_filters(&self, sample_rate: f32, bass: f32, treble: f32, volume: f32, mic_eq: bool, noise_sup: bool) {
        if let Ok(mut session) = self.dsp_session.lock() {
            session.update_filters(sample_rate, bass, treble, volume, mic_eq, noise_sup);
        }
    }

    fn build_input_stream<T: cpal::Sample>(
        device: &cpal::Device,
        config: &cpal::StreamConfig,
        tx: mpsc::SyncSender<Vec<f32>>,
    ) -> Result<Stream, String> {
        let err_fn = |err| eprintln!("an error occurred on input stream: {}", err);
        let channels = config.channels as usize;

        let stream = device.build_input_stream(
            config,
            move |data: &[T], _: &cpal::InputCallbackInfo| {
                let mut chunk = Vec::with_capacity(data.len() / channels);
                for frame in data.chunks(channels) {
                    let mut sum = 0.0;
                    for sample in frame {
                        sum += sample.to_f32();
                    }
                    chunk.push(sum / channels as f32);
                }
                let _ = tx.try_send(chunk);
            },
            err_fn,
            None,
        ).map_err(|e| e.to_string())?;
        Ok(stream)
    }

    fn build_output_stream<T: cpal::Sample + cpal::FromSample<f32>>(
        device: &cpal::Device,
        config: &cpal::StreamConfig,
        rx: mpsc::Receiver<Vec<f32>>,
        dsp: Arc<Mutex<LiveDspSession>>,
    ) -> Result<Stream, String> {
        let err_fn = |err| eprintln!("an error occurred on output stream: {}", err);
        let channels = config.channels as usize;
        
        let mut buffer = Vec::new();

        let stream = device.build_output_stream(
            config,
            move |data: &mut [T], _: &cpal::OutputCallbackInfo| {
                while buffer.len() < data.len() / channels {
                    if let Ok(chunk) = rx.try_recv() {
                        let mut processed = vec![0.0; chunk.len()];
                        if let Ok(mut session) = dsp.try_lock() {
                            session.process_chunk(&chunk, &mut processed);
                        } else {
                            processed = chunk; 
                        }
                        buffer.extend(processed);
                    } else {
                        break;
                    }
                }

                for frame in data.chunks_mut(channels) {
                    let sample = if !buffer.is_empty() {
                        buffer.remove(0)
                    } else {
                        0.0
                    };
                    for out_sample in frame {
                        *out_sample = T::from_sample(sample);
                    }
                }
            },
            err_fn,
            None,
        ).map_err(|e| e.to_string())?;
        Ok(stream)
    }
}
