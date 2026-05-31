use rustfft::{FftPlanner, num_complex::Complex};
use std::f32::consts::PI;

/// STFT output: complex spectrogram stored as flat interleaved real+imag.
/// Shape: `[channel, freq_bin, time_frame]`
/// `freq_bins = n_fft / 2 + 1`
pub struct StftOutput {
    /// Real parts: `real[ch * freq_bins * frames + freq * frames + t]`
    pub real: Vec<f32>,
    /// Imaginary parts — same indexing
    pub imag: Vec<f32>,
    pub channels: usize,
    pub freq_bins: usize,
    pub frames: usize,
    pub n_fft: usize,
    pub hop_length: usize,
    pub original_len: usize,
}

impl StftOutput {
    pub fn get_frame_real(&self, ch: usize, freq: usize, t: usize) -> f32 {
        self.real[ch * self.freq_bins * self.frames + freq * self.frames + t]
    }
    pub fn get_frame_imag(&self, ch: usize, freq: usize, t: usize) -> f32 {
        self.imag[ch * self.freq_bins * self.frames + freq * self.frames + t]
    }
}

/// Pure-Rust STFT / iSTFT engine — SRP: only frequency-domain transforms.
/// Uses rustfft under the hood.
pub struct StftHelper {
    n_fft: usize,
    hop_length: usize,
    window: Vec<f32>,
}

impl StftHelper {
    pub fn new(n_fft: usize, hop_length: usize) -> Self {
        let window = hann_window(n_fft);
        Self { n_fft, hop_length, window }
    }

    /// Compute STFT of a mono or de-interleaved audio signal.
    /// Returns `StftOutput` with one channel per call.
    pub fn stft_mono(&self, signal: &[f32]) -> (Vec<f32>, Vec<f32>, usize) {
        let freq_bins = self.n_fft / 2 + 1;
        let frames = stft_frame_count(signal.len(), self.n_fft, self.hop_length);
        let mut real_out = vec![0.0_f32; freq_bins * frames];
        let mut imag_out = vec![0.0_f32; freq_bins * frames];

        let mut planner: FftPlanner<f32> = FftPlanner::new();
        let fft = planner.plan_fft_forward(self.n_fft);
        let mut buf: Vec<Complex<f32>> = vec![Complex::new(0.0, 0.0); self.n_fft];

        for t in 0..frames {
            let start = t * self.hop_length;
            for k in 0..self.n_fft {
                let s_idx = start + k;
                let s = if s_idx < signal.len() { signal[s_idx] } else { 0.0 };
                buf[k] = Complex::new(s * self.window[k], 0.0);
            }
            fft.process(&mut buf);
            for f in 0..freq_bins {
                real_out[f * frames + t] = buf[f].re;
                imag_out[f * frames + t] = buf[f].im;
            }
        }
        (real_out, imag_out, frames)
    }

    /// Run STFT on interleaved stereo audio → per-channel real/imag arrays.
    pub fn stft_stereo(&self, samples: &[f32]) -> StftOutput {
        let (ch1, ch2) = deinterleave(samples);
        let (r1, i1, frames) = self.stft_mono(&ch1);
        let (r2, i2, _)      = self.stft_mono(&ch2);
        let freq_bins = self.n_fft / 2 + 1;
        let mut real = Vec::with_capacity(2 * freq_bins * frames);
        let mut imag = Vec::with_capacity(2 * freq_bins * frames);
        real.extend_from_slice(&r1); real.extend_from_slice(&r2);
        imag.extend_from_slice(&i1); imag.extend_from_slice(&i2);
        StftOutput { real, imag, channels: 2, freq_bins, frames, n_fft: self.n_fft, hop_length: self.hop_length, original_len: samples.len() }
    }

    /// Inverse STFT for a single channel using overlap-add.
    /// `real` and `imag`: shape `[freq_bins × frames]` (f-major).
    pub fn istft_mono(&self, real: &[f32], imag: &[f32], frames: usize, original_len: usize) -> Vec<f32> {
        let freq_bins = self.n_fft / 2 + 1;
        let out_len = (frames - 1) * self.hop_length + self.n_fft;
        let mut out  = vec![0.0_f32; out_len];
        let mut norm = vec![0.0_f32; out_len];

        let mut planner: FftPlanner<f32> = FftPlanner::new();
        let ifft = planner.plan_fft_inverse(self.n_fft);
        let mut buf: Vec<Complex<f32>> = vec![Complex::new(0.0, 0.0); self.n_fft];

        for t in 0..frames {
            // Fill positive freqs
            for f in 0..freq_bins {
                buf[f] = Complex::new(real[f * frames + t], imag[f * frames + t]);
            }
            // Mirror for Hermitian symmetry (real signal)
            for f in freq_bins..self.n_fft {
                let mirror = self.n_fft - f;
                buf[f] = Complex::new(buf[mirror].re, -buf[mirror].im);
            }
            ifft.process(&mut buf);
            let scale = 1.0 / self.n_fft as f32;
            let start = t * self.hop_length;
            for k in 0..self.n_fft {
                let s = buf[k].re * scale * self.window[k];
                out[start + k]  += s;
                norm[start + k] += self.window[k] * self.window[k];
            }
        }

        // Normalize by window sum and trim to original length
        out.iter_mut().zip(norm.iter()).for_each(|(o, n)| {
            if *n > 1e-8 { *o /= n; }
        });
        out.truncate(original_len.min(out.len()));
        out
    }

    /// Reconstruct stereo interleaved signal from a 2-channel StftOutput.
    pub fn istft_stereo(&self, stft: &StftOutput, mask_real: &[f32], mask_imag: &[f32]) -> Vec<f32> {
        let freq_bins = stft.freq_bins;
        let frames    = stft.frames;
        let ch_size   = freq_bins * frames;

        // Apply mask to each channel (Wiener soft mask multiplication)
        let r1: Vec<f32> = (0..ch_size).map(|i| stft.real[i]        * mask_real[i]        - stft.imag[i]        * mask_imag[i]).collect();
        let i1: Vec<f32> = (0..ch_size).map(|i| stft.real[i]        * mask_imag[i]        + stft.imag[i]        * mask_real[i]).collect();
        let r2: Vec<f32> = (0..ch_size).map(|i| stft.real[ch_size+i] * mask_real[ch_size+i] - stft.imag[ch_size+i] * mask_imag[ch_size+i]).collect();
        let i2: Vec<f32> = (0..ch_size).map(|i| stft.real[ch_size+i] * mask_imag[ch_size+i] + stft.imag[ch_size+i] * mask_real[ch_size+i]).collect();

        let mono_len = stft.original_len / 2;
        let ch1 = self.istft_mono(&r1, &i1, frames, mono_len);
        let ch2 = self.istft_mono(&r2, &i2, frames, mono_len);
        interleave(&ch1, &ch2)
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

pub fn hann_window(n: usize) -> Vec<f32> {
    (0..n).map(|i| 0.5 * (1.0 - (2.0 * PI * i as f32 / (n - 1) as f32).cos())).collect()
}

pub fn stft_frame_count(signal_len: usize, n_fft: usize, hop: usize) -> usize {
    if signal_len < n_fft { return 1; }
    (signal_len - n_fft) / hop + 1
}

pub fn deinterleave(samples: &[f32]) -> (Vec<f32>, Vec<f32>) {
    let n = samples.len() / 2;
    let mut ch1 = Vec::with_capacity(n);
    let mut ch2 = Vec::with_capacity(n);
    let mut i = 0;
    while i + 1 < samples.len() {
        ch1.push(samples[i]);
        ch2.push(samples[i + 1]);
        i += 2;
    }
    (ch1, ch2)
}

pub fn interleave(ch1: &[f32], ch2: &[f32]) -> Vec<f32> {
    let n = ch1.len().min(ch2.len());
    let mut out = Vec::with_capacity(n * 2);
    for i in 0..n {
        out.push(ch1[i]);
        out.push(ch2[i]);
    }
    out
}

/// Resample signal from `from_sr` to `to_sr` using linear interpolation.
/// Fast but approximate — sufficient for 44100 ↔ 48000 conversion.
pub fn resample_linear(signal: &[f32], from_sr: u32, to_sr: u32) -> Vec<f32> {
    if from_sr == to_sr || signal.is_empty() { return signal.to_vec(); }
    let ratio = to_sr as f64 / from_sr as f64;
    let out_len = (signal.len() as f64 * ratio) as usize;
    let mut out = Vec::with_capacity(out_len);
    for i in 0..out_len {
        let src_pos = i as f64 / ratio;
        let src_idx = src_pos as usize;
        let frac    = (src_pos - src_idx as f64) as f32;
        let a = signal[src_idx.min(signal.len() - 1)];
        let b = signal[(src_idx + 1).min(signal.len() - 1)];
        out.push(a + frac * (b - a));
    }
    out
}
