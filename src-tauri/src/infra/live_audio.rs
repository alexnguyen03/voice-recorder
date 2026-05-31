use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{SampleFormat, Stream, Sample};
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

pub enum LiveMicCommand {
    Start { input: String, output: String },
    Stop,
    UpdateFilters { bass: f32, treble: f32, volume: f32, mic_eq: bool, noise_sup: bool, gate_sensitivity: f32 },
}

pub struct LiveMicState {
    cmd_tx: Mutex<mpsc::Sender<LiveMicCommand>>,
}

impl LiveMicState {
    pub fn new() -> Self {
        let (tx, rx) = mpsc::channel::<LiveMicCommand>();
        
        std::thread::spawn(move || {
            let mut _input_stream: Option<Stream> = None;
            let mut _output_stream: Option<Stream> = None;
            let dsp_session = Arc::new(Mutex::new(LiveDspSession::new()));
            
            for cmd in rx.iter() {
                match cmd {
                    LiveMicCommand::Start { input, output } => {
                        _input_stream = None;
                        _output_stream = None;
                        
                        let host = cpal::default_host();
                        
                        let input_device = match host.input_devices() {
                            Ok(mut devs) => devs.find(|x| x.name().unwrap_or_default() == input).ok_or("Input device not found".to_string()),
                            Err(e) => Err(e.to_string()),
                        };
                            
                        let output_device = match host.output_devices() {
                            Ok(mut devs) => devs.find(|x| x.name().unwrap_or_default() == output).ok_or("Output device not found".to_string()),
                            Err(e) => Err(e.to_string()),
                        };
                            
                        if let (Ok(in_dev), Ok(out_dev)) = (input_device, output_device) {
                            if let (Ok(in_cfg), Ok(out_cfg)) = (in_dev.default_input_config(), out_dev.default_output_config()) {
                                let (audio_tx, audio_rx) = mpsc::sync_channel::<Vec<f32>>(100);
                                
                                let i_stream = match in_cfg.sample_format() {
                                    SampleFormat::F32 => Self::build_input_stream::<f32>(&in_dev, &in_cfg.into(), audio_tx),
                                    SampleFormat::I16 => Self::build_input_stream::<i16>(&in_dev, &in_cfg.into(), audio_tx),
                                    SampleFormat::U16 => Self::build_input_stream::<u16>(&in_dev, &in_cfg.into(), audio_tx),
                                    _ => Err("Unsupported input".into()),
                                };

                                let dsp = dsp_session.clone();
                                let o_stream = match out_cfg.sample_format() {
                                    SampleFormat::F32 => Self::build_output_stream::<f32>(&out_dev, &out_cfg.into(), audio_rx, dsp),
                                    SampleFormat::I16 => Self::build_output_stream::<i16>(&out_dev, &out_cfg.into(), audio_rx, dsp),
                                    SampleFormat::U16 => Self::build_output_stream::<u16>(&out_dev, &out_cfg.into(), audio_rx, dsp),
                                    _ => Err("Unsupported output".into()),
                                };

                                if let (Ok(is), Ok(os)) = (i_stream, o_stream) {
                                    let _ = is.play();
                                    let _ = os.play();
                                    _input_stream = Some(is);
                                    _output_stream = Some(os);
                                }
                            }
                        }
                    }
                    LiveMicCommand::Stop => {
                        _input_stream = None;
                        _output_stream = None;
                    }
                    LiveMicCommand::UpdateFilters { bass, treble, volume, mic_eq, noise_sup, gate_sensitivity } => {
                        if let Ok(mut session) = dsp_session.lock() {
                            session.update_filters(44100.0, bass, treble, volume, mic_eq, noise_sup, gate_sensitivity);
                        }
                    }
                }
            }
        });

        Self {
            cmd_tx: Mutex::new(tx),
        }
    }

    pub fn start(&self, input_name: &str, output_name: &str) -> Result<(), String> {
        if let Ok(tx) = self.cmd_tx.lock() {
            let _ = tx.send(LiveMicCommand::Start { input: input_name.to_string(), output: output_name.to_string() });
        }
        Ok(())
    }

    pub fn stop(&self) {
        if let Ok(tx) = self.cmd_tx.lock() {
            let _ = tx.send(LiveMicCommand::Stop);
        }
    }

    pub fn update_filters(&self, _sample_rate: f32, bass: f32, treble: f32, volume: f32, mic_eq: bool, noise_sup: bool, gate_sensitivity: f32) {
        if let Ok(tx) = self.cmd_tx.lock() {
            let _ = tx.send(LiveMicCommand::UpdateFilters { bass, treble, volume, mic_eq, noise_sup, gate_sensitivity });
        }
    }

    fn build_input_stream<T>(
        device: &cpal::Device,
        config: &cpal::StreamConfig,
        tx: mpsc::SyncSender<Vec<f32>>,
    ) -> Result<Stream, String>
    where
        T: cpal::Sample + cpal::SizedSample,
        f32: cpal::FromSample<T>
    {
        let err_fn = |err| eprintln!("an error occurred on input stream: {}", err);
        let channels = config.channels as usize;

        let stream = device.build_input_stream(
            config,
            move |data: &[T], _: &cpal::InputCallbackInfo| {
                let mut chunk = Vec::with_capacity(data.len() / channels);
                for frame in data.chunks(channels) {
                    let mut sum = 0.0;
                    for sample in frame {
                        sum += (*sample).to_sample::<f32>();
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

    fn build_output_stream<T: cpal::Sample + cpal::FromSample<f32> + cpal::SizedSample>(
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
