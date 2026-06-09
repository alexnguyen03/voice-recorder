use std::path::Path;
use ndarray::Array4;
use ort::{inputs, session::{Session, builder::SessionBuilder}, value::Tensor};
use tauri::AppHandle;

use super::{SeparatorStrategy, model_cache::ModelCache};

// Primary URL: seanghay/uvr_models (public, ungated)
const MDX_MODEL_URL: &str =
    "https://huggingface.co/seanghay/uvr_models/resolve/main/UVR-MDX-NET-Inst_HQ_3.onnx";
// Fallback URL in case the primary is unavailable
const MDX_MODEL_URL_FALLBACK: &str =
    "https://huggingface.co/Blane187/all_public_uvr_models/resolve/main/UVR-MDX-NET-Inst_HQ_3.onnx";
const MDX_MODEL_FILE: &str = "UVR-MDX-NET-Inst_HQ_3.onnx";
const MDX_MIN_BYTES: u64 = 40 * 1024 * 1024; // 40 MB minimum

const N_FFT:        usize = 6144;
const HOP_LENGTH:   usize = 1024;
const CHUNK_FRAMES: usize = 256;
const OVERLAP:      f32   = 0.75;
/// MDX-Net was trained without the Nyquist bin → expects N_FFT/2 = 3072, not N_FFT/2+1 = 3073.
const MODEL_FREQ_BINS: usize = N_FFT / 2;

pub struct MdxNetStrategy {
    session: Session,
}

impl MdxNetStrategy {
    pub fn load(app: &AppHandle, progress_cb: impl Fn(u64, u64)) -> Result<Self, String> {
        let cache = ModelCache::new(app, "separator")?;
        // Try primary URL first, fall back to mirror if it returns a non-2xx status
        let path = cache
            .ensure(MDX_MODEL_URL, MDX_MODEL_FILE, MDX_MIN_BYTES, &progress_cb)
            .or_else(|e| {
                eprintln!("[MDX-Net] Primary URL failed ({}), trying fallback…", e);
                cache.ensure(MDX_MODEL_URL_FALLBACK, MDX_MODEL_FILE, MDX_MIN_BYTES, &progress_cb)
            })?;
        Self::from_path(&path)
    }

    pub fn from_path(path: &Path) -> Result<Self, String> {
        let session = SessionBuilder::new()
            .map_err(|e| format!("ONNX SessionBuilder error: {}", e))?
            .commit_from_file(path)
            .map_err(|e| format!("Failed to load MDX-Net model: {}", e))?;
        Ok(Self { session })
    }
}

impl SeparatorStrategy for MdxNetStrategy {
    fn infer_chunk(&mut self, input: Array4<f32>) -> Result<Array4<f32>, String> {
        let [b, c, f, t] = [
            input.shape()[0], input.shape()[1],
            input.shape()[2], input.shape()[3],
        ];

        // Flatten to raw Vec then create ort::Tensor (= ort::value::Value<Tensor<f32>>)
        // which satisfies From<Value<T>> for SessionInputValue in rc.12.
        let flat: Vec<f32> = input.into_raw_vec();
        let tensor = Tensor::<f32>::from_array(([b, c, f, t], flat.into_boxed_slice()))
            .map_err(|e| format!("Tensor creation failed: {}", e))?;

        // inputs! returns Vec — no map_err needed on it
        let run_inputs = inputs!["input" => tensor];
        let outputs = self.session
            .run(run_inputs)
            .map_err(|e| format!("MDX-Net inference error: {}", e))?;

        // try_extract_tensor returns (&Shape, &[f32]) in rc.12
        let (_, out_slice) = outputs[0]
            .try_extract_tensor::<f32>()
            .map_err(|e| format!("Failed to extract MDX-Net output: {}", e))?;

        let out_data: Vec<f32> = out_slice.to_vec();
        let arr = Array4::from_shape_vec((b, c, f, t), out_data)
            .map_err(|e| format!("Output shape mismatch: {}", e))?;

        Ok(arr)
    }

    fn n_fft(&self)          -> usize { N_FFT }
    fn hop_length(&self)     -> usize { HOP_LENGTH }
    fn chunk_frames(&self)   -> usize { CHUNK_FRAMES }
    fn overlap(&self)        -> f32   { OVERLAP }
    /// Explicitly 3072 (N_FFT/2) — model drops the Nyquist bin.
    fn model_freq_bins(&self) -> usize { MODEL_FREQ_BINS }
    fn model_name(&self)     -> &'static str { "MDX-NET-Inst_HQ_3" }
}
