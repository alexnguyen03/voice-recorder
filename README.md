# 🎙️ Desktop Voice Recorder

A local-first, studio-grade voice recording and enhancement desktop app built with **Tauri v2**, **React 19**, and a **pure-Rust DSP backend**.

All audio processing — recording, editing, noise suppression, vocal separation — runs entirely on-device. No cloud, no subscription, no data leaves your machine.

---

## ✨ Features

### Recording
- Record from any microphone with configurable sample rate, channels, and bit depth
- Real-time amplitude visualisation during recording
- Pause / Resume / Discard support
- Recordings saved as standard WAV files in `Documents/VoiceRecorder/`

### Library
- Browse, search, and manage all your recordings
- Duration and date metadata read from WAV headers (fast, no full decode)
- Batch delete with inline confirmation

### Voice Detail Studio
- **Waveform editor** with trim and cut-out tools
- **Voice Filters Panel** — 10-stage Rust DSP pipeline:
  - Hum removal (50/60 Hz notch)
  - Noise suppression & noise gate
  - De-hiss, wind suppression
  - Breath & plosive reduction
  - Bass / treble / mid parametric EQ
  - Volume boost, mic EQ enhancement
  - Sibilance reduction, smooth voice cutoff
- **Voice Presets** — one-click presets (Clean Voice, Podcast Warm, Meeting Clear, Low Mic Rescue, Noisy Room Rescue)
- **Preview mode** — hear the filtered result before exporting; settings persisted as `.meta.json` sidecar
- **Export** — apply filters and save as a new WAV file

### Vocal Source Separation
- Isolate vocals from instrumental/background using **MDX-Net** (ONNX Runtime, ~45 MB model, downloads on first use)
- Output: `_vocals.wav` and/or `_accompaniment.wav` alongside the source file
- Real-time download + processing progress bar

### Live Mic Studio
- Monitor and process your microphone in real-time with the same DSP pipeline

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Desktop shell | [Tauri v2](https://tauri.app) (Rust + WebView) |
| Frontend | React 19, TypeScript, Vite, TailwindCSS v4 |
| Audio capture | [cpal](https://github.com/RustAudio/cpal) |
| WAV I/O | [hound](https://github.com/ruuda/hound) |
| DSP pipeline | Pure Rust (custom 10-stage pipeline) |
| STFT / iSTFT | [rustfft](https://github.com/ejmahler/RustFFT) |
| ML inference | [ort](https://ort.pyke.io) (ONNX Runtime 2 bindings) |
| Tensor ops | [ndarray](https://github.com/rust-ndarray/ndarray) |
| Model download | [reqwest](https://github.com/seanmonstar/reqwest) (streaming, with fallback URL) |

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org) ≥ 18
- [Rust](https://rustup.rs) (stable toolchain)
- [Tauri CLI prerequisites](https://tauri.app/start/prerequisites/) for your OS

### Run in development

```bash
npm install
npm run tauri dev
```

### Build for production

```bash
npm run tauri build
```

The installer will be placed in `src-tauri/target/release/bundle/`.

---

## 📁 Project Structure

```
voice-recorder/
├── src/                        # React frontend
│   ├── pages/                  # LibraryPage, VoiceDetailStudio, RecordingPage, LiveMicStudio, SettingsPage
│   ├── components/editor/      # WaveformEditor, VoiceFiltersPanel, VocalSeparationPanel
│   ├── hooks/                  # useAudioRecorder, useVoiceFilters
│   └── services/audioService.ts # Tauri IPC bridge
└── src-tauri/src/              # Rust backend
    ├── commands/               # Tauri command handlers (recording, editing, preview, separate)
    ├── infra/                  # Infrastructure: CPAL recorder, DSP pipeline, STFT, separator
    │   └── separator/          # MDX-Net vocal separation engine
    └── core/                   # Domain models & traits
```

---

## 📦 Model Downloads

The vocal separation feature uses the **UVR-MDX-NET-Inst_HQ_3** ONNX model (~45 MB).  
It is downloaded automatically on first use from [seanghay/uvr_models](https://huggingface.co/seanghay/uvr_models) and cached at:

```
Documents/VoiceRecorder/.models/separator/UVR-MDX-NET-Inst_HQ_3.onnx
```

A fallback mirror ([Blane187/all_public_uvr_models](https://huggingface.co/Blane187/all_public_uvr_models)) is used automatically if the primary URL is unavailable.

---

## 📄 License

MIT
