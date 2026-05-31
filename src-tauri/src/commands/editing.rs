use crate::infra::{LocalStorage, DspEngine};
use crate::core::traits::{AudioStorage, AudioProcessor};

#[tauri::command]
pub fn trim_audio(
    file_path: String,
    start_ms: u32,
    end_ms: u32,
) -> Result<String, String> {
    let storage = LocalStorage::new();
    
    // Load the raw audio file
    let mut buffer = storage.load_file(&file_path).map_err(|e| e.to_string())?;
    
    // Calculate sample index bounds based on time duration and sample rate
    let sample_rate = buffer.sample_rate as f32;
    let channels = buffer.channels as usize;
    
    let start_sample = ((start_ms as f32 / 1000.0) * sample_rate) as usize * channels;
    let end_sample = ((end_ms as f32 / 1000.0) * sample_rate) as usize * channels;
    
    if start_sample >= buffer.samples.len() {
        return Err("Start time is out of audio duration bounds".to_string());
    }
    
    let clamped_end = end_sample.min(buffer.samples.len());
    if start_sample >= clamped_end {
        return Err("Start time cannot be equal or greater than End time".to_string());
    }
    
    // Slice PCM vector
    buffer.samples = buffer.samples[start_sample..clamped_end].to_vec();
    
    // Draft output trimmed file path (e.g. voice_trimmed.wav)
    let output_path = file_path.replace(".wav", "_trimmed.wav");
    storage.save_file(&buffer, &output_path).map_err(|e| e.to_string())?;
    
    Ok(output_path)
}

#[tauri::command]
pub fn cut_audio_segment(
    file_path: String,
    start_ms: u32,
    end_ms: u32,
) -> Result<String, String> {
    let storage = LocalStorage::new();

    // Load the raw audio file
    let mut buffer = storage.load_file(&file_path).map_err(|e| e.to_string())?;

    let sample_rate = buffer.sample_rate as f32;
    let channels = buffer.channels as usize;

    let start_sample = ((start_ms as f32 / 1000.0) * sample_rate) as usize * channels;
    let end_sample   = ((end_ms   as f32 / 1000.0) * sample_rate) as usize * channels;

    if start_sample >= buffer.samples.len() {
        return Err("Cut start time is out of audio duration bounds".to_string());
    }

    let clamped_end = end_sample.min(buffer.samples.len());
    if start_sample >= clamped_end {
        return Err("Cut start time cannot be equal or greater than Cut end time".to_string());
    }

    // Keep everything BEFORE start and AFTER end, removing the middle segment
    let before = buffer.samples[..start_sample].to_vec();
    let after  = buffer.samples[clamped_end..].to_vec();
    buffer.samples = [before, after].concat();

    let output_path = file_path.replace(".wav", "_cut.wav");
    storage.save_file(&buffer, &output_path).map_err(|e| e.to_string())?;

    Ok(output_path)
}

#[tauri::command]
pub fn apply_voice_effects(
    file_path: String,
    enable_noise_suppression: bool,
    bass_boost: f32,
    treble_boost: f32,
    volume_boost: f32,
    mic_eq_enhancement: bool,
) -> Result<String, String> {
    let storage = LocalStorage::new();
    let dsp = DspEngine::new();

    // 1. Read the target raw WAV file back into float PCM memory
    let mut buffer = storage.load_file(&file_path).map_err(|e| e.to_string())?;

    // 2. Apply mic EQ first (highpass/lowpass/notch filters) so the noise gate
    //    sees a clean signal and isn't false-triggered by rumble/hiss.
    //    Run enhance_voice with neutral EQ and no volume change — only mic_eq matters here.
    if mic_eq_enhancement {
        buffer.samples = dsp.enhance_voice(
            &buffer.samples,
            0.5,   // bass neutral
            0.5,   // treble neutral
            0.5,   // volume neutral (1x)
            true,  // mic_eq_enhancement ON
        ).map_err(|e| e.to_string())?;
    }

    // 3. Noise gate on the mic-EQ cleaned signal (matches live pipeline order)
    if enable_noise_suppression {
        buffer.samples = dsp.suppress_noise(&buffer.samples).map_err(|e| e.to_string())?;
    }

    // 4. Apply bass/treble EQ shaping + volume gain (mic_eq already done above)
    buffer.samples = dsp.enhance_voice(
        &buffer.samples,
        bass_boost,
        treble_boost,
        volume_boost,
        false, // mic_eq already applied in step 2, skip here to avoid double-filtering
    ).map_err(|e| e.to_string())?;

    // 5. Save enhanced audio as a distinct, non-destructive file
    let output_path = file_path.replace(".wav", "_enhanced.wav");
    storage.save_file(&buffer, &output_path).map_err(|e| e.to_string())?;

    Ok(output_path)
}
