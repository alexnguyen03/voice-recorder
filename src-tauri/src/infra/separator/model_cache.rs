use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

/// SRP: only responsible for downloading, validating, and serving model file paths.
/// Pattern: extracted from voice_layer_engine.rs to avoid code duplication.
pub struct ModelCache {
    dir: PathBuf,
}

impl ModelCache {
    /// Create pointing at `Documents/VoiceRecorder/.models/<sub_dir>/`.
    pub fn new(app: &AppHandle, sub_dir: &str) -> Result<Self, String> {
        let doc_dir = app
            .path()
            .document_dir()
            .map_err(|e| format!("Failed to find Documents dir: {}", e))?;
        let dir = doc_dir
            .join("VoiceRecorder")
            .join(".models")
            .join(sub_dir);
        std::fs::create_dir_all(&dir)
            .map_err(|e| format!("Failed to create model cache dir: {}", e))?;
        Ok(Self { dir })
    }

    /// Returns the full path to a model file, downloading it first if absent.
    /// `url`      : direct download URL (e.g. HuggingFace raw URL)
    /// `filename` : final filename in the cache directory
    /// `min_bytes`: minimum acceptable file size (rejects corrupt partial downloads)
    pub fn ensure(
        &self,
        url: &str,
        filename: &str,
        min_bytes: u64,
        progress_cb: impl Fn(u64, u64),  // (downloaded_bytes, total_bytes)
    ) -> Result<PathBuf, String> {
        let path = self.dir.join(filename);
        if self.is_valid(&path, min_bytes) {
            return Ok(path);
        }

        let tmp = path.with_extension("download");
        self.download(url, &tmp, &progress_cb)?;

        // Validate downloaded file
        let size = std::fs::metadata(&tmp)
            .map(|m| m.len())
            .unwrap_or(0);
        if size < min_bytes {
            let _ = std::fs::remove_file(&tmp);
            return Err(format!(
                "Downloaded model '{}' is too small ({} bytes, expected ≥ {})",
                filename, size, min_bytes
            ));
        }

        // Atomic rename: remove old if exists, then rename
        if path.exists() {
            std::fs::remove_file(&path)
                .map_err(|e| format!("Failed to remove stale model: {}", e))?;
        }
        std::fs::rename(&tmp, &path)
            .map_err(|e| format!("Failed to finalize model cache: {}", e))?;

        Ok(path)
    }

    fn is_valid(&self, path: &Path, min_bytes: u64) -> bool {
        path.metadata()
            .map(|m| m.is_file() && m.len() >= min_bytes)
            .unwrap_or(false)
    }

    fn download(
        &self,
        url: &str,
        dest: &Path,
        progress_cb: &impl Fn(u64, u64),
    ) -> Result<(), String> {
        let client = reqwest::blocking::Client::builder()
            .user_agent("Mozilla/5.0 voice-recorder/1.0 model-cache")
            .timeout(std::time::Duration::from_secs(600))
            .redirect(reqwest::redirect::Policy::limited(10))
            .build()
            .map_err(|e| format!("HTTP client error: {}", e))?;

        let response = client
            .get(url)
            .send()
            .map_err(|e| format!("Model download failed: {}", e))?;

        if !response.status().is_success() {
            return Err(format!(
                "Model download HTTP error: {} (URL: {})",
                response.status(), url
            ));
        }

        let total = response.content_length().unwrap_or(0);

        // Stream body in 64 KB chunks to provide real-time progress
        let mut downloaded: u64 = 0;
        let mut file = std::fs::File::create(dest)
            .map_err(|e| format!("Failed to create temp file: {}", e))?;

        use std::io::{Read, Write};
        let mut reader = response;
        let mut buf = vec![0u8; 65_536]; // 64 KB buffer
        loop {
            let n = reader.read(&mut buf)
                .map_err(|e| format!("Failed to read model bytes: {}", e))?;
            if n == 0 { break; }
            file.write_all(&buf[..n])
                .map_err(|e| format!("Failed to write model chunk: {}", e))?;
            downloaded += n as u64;
            progress_cb(downloaded, total.max(downloaded));
        }

        Ok(())
    }
}
