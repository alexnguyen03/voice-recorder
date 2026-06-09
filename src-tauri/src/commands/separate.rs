use tauri::{AppHandle, Emitter};
use serde::{Deserialize, Serialize};

use crate::infra::{LocalStorage, separator::{SeparationEngine, mdxnet::MdxNetStrategy}};
use crate::core::traits::AudioStorage;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SeparationResult {
    pub vocals_path:        Option<String>,
    pub accompaniment_path: Option<String>,
    pub processing_time_ms: u64,
}

/// Output mode — which stems to save to disk.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum OutputMode {
    VocalsOnly,
    AccompanimentOnly,
    Both,
}

/// Separate vocal and accompaniment stems from an audio file using MDX-Net.
///
/// This is an async command — separation takes 10–120 s depending on file length.
/// The frontend should listen to the `separation:progress` Tauri event
/// (`{ percent: 0..100 }`) to drive a progress bar.
///
/// Returns paths to the saved stem WAV files (alongside the source file).
#[tauri::command]
pub async fn separate_vocals(
    app: AppHandle,
    file_path: String,
    output_mode: String,
) -> Result<SeparationResult, String> {
    // AppHandle is Clone + Send in Tauri v2, so we can move a clone into spawn_blocking.
    let app_clone = app.clone();

    tauri::async_runtime::spawn_blocking(move || {
        let storage = LocalStorage::new();
        let buffer  = storage.load_file(&file_path).map_err(|e| e.to_string())?;

        let start = std::time::Instant::now();

        // Load MDX-Net model (downloads ~45 MB on first use)
        let strategy = MdxNetStrategy::load(&app_clone, |downloaded, total| {
            if total > 0 {
                let pct = (downloaded * 100 / total) as u8;
                let _ = app_clone.emit("separation:download_progress",
                    serde_json::json!({ "percent": pct, "downloaded": downloaded, "total": total }));
            }
        })?;

        // Run full separation pipeline
        let mut engine = SeparationEngine::new(Box::new(strategy));
        let stems = engine.run(&app_clone, &buffer)?;

        let mode = parse_mode(&output_mode);

        // Save requested stems alongside the source file
        let base = file_path.trim_end_matches(".wav");
        let vocals_path = if matches!(mode, OutputMode::VocalsOnly | OutputMode::Both) {
            let path = format!("{}_vocals.wav", base);
            storage.save_file(&stems.vocals_buffer(), &path).map_err(|e| e.to_string())?;
            Some(path)
        } else {
            None
        };

        let accompaniment_path = if matches!(mode, OutputMode::AccompanimentOnly | OutputMode::Both) {
            let path = format!("{}_accompaniment.wav", base);
            storage.save_file(&stems.accompaniment_buffer(), &path).map_err(|e| e.to_string())?;
            Some(path)
        } else {
            None
        };

        Ok(SeparationResult {
            vocals_path,
            accompaniment_path,
            processing_time_ms: start.elapsed().as_millis() as u64,
        })
    })
    .await
    .map_err(|e| e.to_string())?
}

fn parse_mode(s: &str) -> OutputMode {
    match s {
        "accompaniment_only" => OutputMode::AccompanimentOnly,
        "both"               => OutputMode::Both,
        _                    => OutputMode::VocalsOnly,
    }
}
