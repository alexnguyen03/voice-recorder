use ndarray::Array4;
use tauri::{AppHandle, Emitter};

use crate::core::models::AudioBuffer;
use super::{SeparatorStrategy, StemOutput, stft_helper::{StftHelper, resample_linear, deinterleave, interleave}};

const TARGET_SR: u32 = 44100; // MDX-Net requires 44.1 kHz

/// SeparationEngine — Facade.
///
/// Orchestrates: load audio → ensure stereo → resample → STFT → chunked inference →
/// ISTFT → accompaniment by subtraction → save stems.
/// Emits Tauri progress events so the UI can display a live progress bar.
///
/// SRP: only orchestration — does NOT do STFT math or model inference directly.
pub struct SeparationEngine {
    strategy: Box<dyn SeparatorStrategy>,
}

impl SeparationEngine {
    pub fn new(strategy: Box<dyn SeparatorStrategy>) -> Self {
        Self { strategy }
    }

    /// Run full separation pipeline on a loaded AudioBuffer.
    /// Emits `separation:progress` events with `{"percent": 0..100}` payloads.
    pub fn run(
        &mut self,
        app: &AppHandle,
        buffer: &AudioBuffer,
    ) -> Result<StemOutput, String> {
        let sr   = buffer.sample_rate;
        let orig_channels = buffer.channels;

        // 1. Ensure stereo — duplicate mono channel if needed
        let stereo = ensure_stereo(&buffer.samples, orig_channels);

        // 2. Resample to 44100 Hz if needed
        emit_progress(app, 2);
        let resampled = if sr != TARGET_SR {
            let (ch1, ch2) = deinterleave(&stereo);
            let r1 = resample_linear(&ch1, sr, TARGET_SR);
            let r2 = resample_linear(&ch2, sr, TARGET_SR);
            interleave(&r1, &r2)
        } else {
            stereo.clone()
        };

        // 3. STFT
        emit_progress(app, 5);
        let n_fft      = self.strategy.n_fft();
        let hop_length = self.strategy.hop_length();
        let stft       = StftHelper::new(n_fft, hop_length);
        let stft_out   = stft.stft_stereo(&resampled);

        let freq_bins    = stft_out.freq_bins;
        let frames       = stft_out.frames;
        let chunk_frames = self.strategy.chunk_frames();
        let overlap      = self.strategy.overlap();
        let step = (chunk_frames as f32 * (1.0 - overlap)).round() as usize;
        let step = step.max(1);
        let n_chunks = (frames.saturating_sub(chunk_frames)) / step + 1;

        // Accumulate model predictions in full-size mask arrays
        let mut mask_sum_real = vec![0.0_f32; 2 * freq_bins * frames];
        let mut mask_sum_imag = vec![0.0_f32; 2 * freq_bins * frames];
        let mut mask_count    = vec![0.0_f32; 2 * freq_bins * frames];

        // 4. Chunked inference
        for chunk_idx in 0..n_chunks {
            let frame_start = chunk_idx * step;
            let frame_end   = (frame_start + chunk_frames).min(frames);
            let actual_frames = frame_end - frame_start;

            // Build input tensor [1, 4, freq_bins, chunk_frames]
            // 4 channels: ch1_real, ch1_imag, ch2_real, ch2_imag
            let mut input_data = vec![0.0_f32; 1 * 4 * freq_bins * chunk_frames];
            let ch_size = freq_bins * frames;
            for f in 0..freq_bins {
                for t in 0..actual_frames {
                    let src_t = frame_start + t;
                    // ch1 real
                    input_data[0 * freq_bins * chunk_frames + f * chunk_frames + t] =
                        stft_out.real[f * frames + src_t];
                    // ch1 imag
                    input_data[1 * freq_bins * chunk_frames + f * chunk_frames + t] =
                        stft_out.imag[f * frames + src_t];
                    // ch2 real
                    input_data[2 * freq_bins * chunk_frames + f * chunk_frames + t] =
                        stft_out.real[ch_size + f * frames + src_t];
                    // ch2 imag
                    input_data[3 * freq_bins * chunk_frames + f * chunk_frames + t] =
                        stft_out.imag[ch_size + f * frames + src_t];
                }
            }
            let input_arr = Array4::from_shape_vec(
                (1, 4, freq_bins, chunk_frames), input_data,
            ).map_err(|e| format!("Input shape error: {}", e))?;

            // Run ONNX inference (predicts instrument mask)
            let pred = self.strategy.infer_chunk(input_arr)?;

            // Accumulate predictions into full mask (overlap-add)
            for f in 0..freq_bins {
                for t in 0..actual_frames {
                    let dst = frame_start + t;
                    // ch1
                    let idx1 = f * frames + dst;
                    mask_sum_real[idx1]        += pred[[0, 0, f, t]];
                    mask_sum_imag[idx1]        += pred[[0, 1, f, t]];
                    mask_count[idx1]           += 1.0;
                    // ch2
                    let idx2 = ch_size + f * frames + dst;
                    mask_sum_real[idx2]        += pred[[0, 2, f, t]];
                    mask_sum_imag[idx2]        += pred[[0, 3, f, t]];
                    mask_count[idx2]           += 1.0;
                }
            }

            // Progress: 5..90%
            let pct = 5 + (chunk_idx + 1) * 85 / n_chunks;
            emit_progress(app, pct as u8);
        }

        // Normalise accumulated mask
        let ch_total = 2 * freq_bins * frames;
        let mut inst_mask_real = vec![0.0_f32; ch_total];
        let mut inst_mask_imag = vec![0.0_f32; ch_total];
        for i in 0..ch_total {
            let cnt = mask_count[i].max(1.0);
            inst_mask_real[i] = mask_sum_real[i] / cnt;
            inst_mask_imag[i] = mask_sum_imag[i] / cnt;
        }

        // 5. Vocal mask = 1 - instrument mask (complementary Wiener mask)
        let vocal_mask_real: Vec<f32> = inst_mask_real.iter().map(|v| 1.0 - v).collect();
        let vocal_mask_imag: Vec<f32> = inst_mask_imag.iter().map(|v| -v).collect();

        // 6. ISTFT → stereo audio for each stem
        emit_progress(app, 92);
        let vocals        = stft.istft_stereo(&stft_out, &vocal_mask_real, &vocal_mask_imag);
        let accompaniment = stft.istft_stereo(&stft_out, &inst_mask_real,  &inst_mask_imag);

        // 7. Resample back to original SR if needed
        let (vocals, accompaniment) = if sr != TARGET_SR {
            let (vl, vr) = deinterleave(&vocals);
            let (al, ar) = deinterleave(&accompaniment);
            (
                interleave(&resample_linear(&vl, TARGET_SR, sr), &resample_linear(&vr, TARGET_SR, sr)),
                interleave(&resample_linear(&al, TARGET_SR, sr), &resample_linear(&ar, TARGET_SR, sr)),
            )
        } else {
            (vocals, accompaniment)
        };

        emit_progress(app, 100);

        Ok(StemOutput {
            vocals,
            accompaniment,
            sample_rate: sr,
            channels: 2, // always stereo output
        })
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

fn emit_progress(app: &AppHandle, percent: u8) {
    let _ = app.emit("separation:progress", serde_json::json!({ "percent": percent }));
}

fn ensure_stereo(samples: &[f32], channels: u16) -> Vec<f32> {
    match channels {
        1 => interleave(samples, samples),  // duplicate mono → stereo
        _ => samples.to_vec(),
    }
}
