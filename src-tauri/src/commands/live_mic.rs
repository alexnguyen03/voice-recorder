use tauri::State;
use std::sync::Mutex;
use crate::infra::live_audio::{LiveMicState, AudioDeviceInfo, get_audio_devices};
use serde::{Deserialize, Serialize};

#[derive(Serialize)]
pub struct DeviceList {
    inputs: Vec<String>,
    outputs: Vec<String>,
}

#[derive(Deserialize)]
pub struct LiveMicConfig {
    pub input_device: String,
    pub output_device: String,
}

#[derive(Deserialize)]
pub struct LiveFilters {
    pub enable_noise_suppression: bool,
    pub bass_boost: f32,
    pub treble_boost: f32,
    pub volume_boost: f32,
    pub mic_eq_enhancement: bool,
}

#[tauri::command]
pub fn get_live_audio_devices() -> Result<DeviceList, String> {
    let devices = get_audio_devices();
    let inputs = devices.iter().filter(|d| d.is_input).map(|d| d.name.clone()).collect();
    let outputs = devices.iter().filter(|d| !d.is_input).map(|d| d.name.clone()).collect();
    
    Ok(DeviceList { inputs, outputs })
}

#[tauri::command]
pub fn start_live_mic(
    config: LiveMicConfig,
    filters: LiveFilters,
    state: State<'_, Mutex<LiveMicState>>,
) -> Result<(), String> {
    let mut mic_state = state.lock().map_err(|_| "Failed to lock state")?;
    
    // Stop any existing stream
    mic_state.stop();
    
    // Set initial filters
    mic_state.update_filters(
        44100.0, // Default for setup
        filters.bass_boost,
        filters.treble_boost,
        filters.volume_boost,
        filters.mic_eq_enhancement,
        filters.enable_noise_suppression,
    );
    
    // Start streaming
    mic_state.start(&config.input_device, &config.output_device)?;
    Ok(())
}

#[tauri::command]
pub fn stop_live_mic(state: State<'_, Mutex<LiveMicState>>) -> Result<(), String> {
    let mut mic_state = state.lock().map_err(|_| "Failed to lock state")?;
    mic_state.stop();
    Ok(())
}

#[tauri::command]
pub fn update_live_filters(
    filters: LiveFilters,
    state: State<'_, Mutex<LiveMicState>>,
) -> Result<(), String> {
    let mic_state = state.lock().map_err(|_| "Failed to lock state")?;
    // We assume 44100.0 here, but ideally we get it from the active config
    mic_state.update_filters(
        44100.0,
        filters.bass_boost,
        filters.treble_boost,
        filters.volume_boost,
        filters.mic_eq_enhancement,
        filters.enable_noise_suppression,
    );
    Ok(())
}
