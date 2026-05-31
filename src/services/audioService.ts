import { invoke } from "@tauri-apps/api/core";

export interface DeviceInfo {
  id: string;
  name: string;
  is_default: boolean;
}

export interface RecordConfig {
  device_id: string | null;
  sample_rate: number;
  channels: number;
  bit_depth: number;
  voice_enhance?: boolean;
}

/** All voice effect options — mirrors PipelineConfig + VoiceLayerOptions on the Rust side. */
export interface VoiceEffectOptions {
  // ── Hum Removal ─────────────────────────────────────────────────────────────
  hum_removal_enabled: boolean;
  // ── Noise & Wind ────────────────────────────────────────────────────────────
  enable_noise_suppression: boolean;
  noise_gate_sensitivity: number;    // 0..1 (0=tight, 1=very sensitive)
  wind_suppression: boolean;
  wind_intensity: number;            // 0..1
  de_hiss_enabled: boolean;
  // ── Breath & Plosive ────────────────────────────────────────────────────────
  reduce_breath: boolean;
  breath_sensitivity: number;        // 0..1
  reduce_plosive: boolean;
  plosive_sensitivity: number;       // 0..1
  // ── EQ & Tone ───────────────────────────────────────────────────────────────
  mic_eq_enhancement: boolean;
  bass_boost: number;                // 0..1 → (v-0.5)×30 dB
  treble_boost: number;              // 0..1 → (v-0.5)×30 dB
  mid_cut_freq: number;              // Hz  (default 1500)
  mid_cut_q: number;                 // Q   (default 2.0)
  mid_cut_gain_db: number;           // ≤0 dB, 0 = bypass
  // ── Volume ──────────────────────────────────────────────────────────────────
  volume_boost: number;              // 0..1
  // ── Vocal Cleanup (ML) ──────────────────────────────────────────────────────
  ml_voice_layers_enabled: boolean;
  reduce_sibilance: boolean;
  smooth_voice_cutoff: boolean;
}

/** Result of vocal source separation. */
export interface SeparationResult {
  vocals_path:        string | null;
  accompaniment_path: string | null;
  processing_time_ms: number;
}

export type SeparationOutputMode = "vocals_only" | "accompaniment_only" | "both";

/** Lightweight WAV file metadata (header-only read, no full decode). */
export interface RecordingInfo {
  path:             string;
  duration_secs:    number;
  file_size_bytes:  number;
  created_at_secs:  number; // Unix epoch seconds
}

/** Filter parameters stored in the preview sidecar — mirrors Rust FilterParams. */
export interface FilterParams {
  hum_removal_enabled: boolean;
  bass_boost: number;
  treble_boost: number;
  volume_boost: number;
  noise_suppression: boolean;
  noise_gate_sensitivity: number;
  mic_eq_enhancement: boolean;
  ml_voice_layers_enabled: boolean;
  reduce_sibilance: boolean;
  reduce_breath: boolean;
  breath_sensitivity: number;
  reduce_plosive: boolean;
  plosive_sensitivity: number;
  smooth_voice_cutoff: boolean;
  wind_suppression: boolean;
  wind_intensity: number;
  mid_cut_freq: number;
  mid_cut_q: number;
  mid_cut_gain_db: number;
  de_hiss_enabled: boolean;
}

/** Preview session metadata returned by load_preview_meta. */
export interface PreviewMeta {
  version: number;
  source_file: string;
  preview_file: string;
  filters: FilterParams;
}

const isTauri = (): boolean =>
  typeof window !== "undefined" && (window as any).__TAURI_INTERNALS__ !== undefined;

/** Maps VoiceEffectOptions to the flat camelCase args expected by Tauri commands. */
const toCommandArgs = (filePath: string, o: VoiceEffectOptions) => ({
  filePath,
  // Hum Removal
  humRemovalEnabled:      o.hum_removal_enabled,
  // Noise & Wind
  enableNoiseSuppression: o.enable_noise_suppression,
  noiseGateSensitivity:   o.noise_gate_sensitivity,
  windSuppression:        o.wind_suppression,
  windIntensity:          o.wind_intensity,
  deHissEnabled:          o.de_hiss_enabled,
  // Breath & Plosive
  reduceBreath:           o.reduce_breath,
  breathSensitivity:      o.breath_sensitivity,
  reducePlosive:          o.reduce_plosive,
  plosiveSensitivity:     o.plosive_sensitivity,
  // EQ
  bassBoost:              o.bass_boost,
  trebleBoost:            o.treble_boost,
  midCutFreq:             o.mid_cut_freq,
  midCutQ:                o.mid_cut_q,
  midCutGainDb:           o.mid_cut_gain_db,
  // Volume & Mic
  volumeBoost:            o.volume_boost,
  micEqEnhancement:       o.mic_eq_enhancement,
  // Voice Layer
  mlVoiceLayersEnabled:   o.ml_voice_layers_enabled,
  reduceSibilance:        o.reduce_sibilance,
  smoothVoiceCutoff:      o.smooth_voice_cutoff,
});

export const AudioService = {
  async listDevices(): Promise<DeviceInfo[]> {
    if (!isTauri()) {
      return [
        { id: "mock_mic_1", name: "Mock Built-in Microphone (Browser)", is_default: true },
        { id: "mock_mic_2", name: "Mock External USB Microphone (Browser)", is_default: false },
      ];
    }
    try { return await invoke<DeviceInfo[]>("list_audio_devices"); }
    catch (e) { throw new Error(String(e)); }
  },

  async startRecording(config: RecordConfig): Promise<void> {
    if (!isTauri()) return;
    try { await invoke("start_audio_recording", { config }); }
    catch (e) { throw new Error(String(e)); }
  },

  async stopRecording(): Promise<string> {
    if (!isTauri()) return "[BROWSER_PREVIEW_MODE] voice_recording_mock.wav";
    try { return await invoke<string>("stop_audio_recording"); }
    catch (e) { throw new Error(String(e)); }
  },

  async pauseRecording(): Promise<void> {
    if (!isTauri()) return;
    try { await invoke("pause_audio_recording"); }
    catch (e) { throw new Error(String(e)); }
  },

  async resumeRecording(): Promise<void> {
    if (!isTauri()) return;
    try { await invoke("resume_audio_recording"); }
    catch (e) { throw new Error(String(e)); }
  },

  async discardRecording(): Promise<void> {
    if (!isTauri()) return;
    try { await invoke("discard_audio_recording"); }
    catch (e) { throw new Error(String(e)); }
  },

  async trimAudio(filePath: string, startMs: number, endMs: number): Promise<string> {
    if (!isTauri()) return filePath.replace(".wav", "_trimmed.wav");
    try { return await invoke<string>("trim_audio", { filePath, startMs, endMs }); }
    catch (e) { throw new Error(String(e)); }
  },

  async cutAudioSegment(filePath: string, startMs: number, endMs: number): Promise<string> {
    if (!isTauri()) return filePath.replace(".wav", "_cut.wav");
    try { return await invoke<string>("cut_audio_segment", { filePath, startMs, endMs }); }
    catch (e) { throw new Error(String(e)); }
  },

  async applyVoiceEffects(filePath: string, options: VoiceEffectOptions): Promise<string> {
    if (!isTauri()) return filePath.replace(".wav", "_enhanced.wav");
    try { return await invoke<string>("apply_voice_effects", toCommandArgs(filePath, options)); }
    catch (e) { throw new Error(String(e)); }
  },

  async listRecordedFiles(): Promise<string[]> {
    if (!isTauri()) return ["[BROWSER] mock_voice_recording_1.wav", "[BROWSER] mock_voice_recording_2.wav"];
    try { return await invoke<string[]>("list_recorded_files"); }
    catch (e) { throw new Error(String(e)); }
  },

  async createPreview(filePath: string, options: VoiceEffectOptions): Promise<string> {
    if (!isTauri()) return filePath;
    try { return await invoke<string>("create_preview", toCommandArgs(filePath, options)); }
    catch (e) { throw new Error(String(e)); }
  },

  async loadPreviewMeta(filePath: string): Promise<PreviewMeta | null> {
    if (!isTauri()) return null;
    try { return await invoke<PreviewMeta | null>("load_preview_meta", { filePath }); }
    catch (e) { return null; }
  },

  async clearPreview(filePath: string): Promise<void> {
    if (!isTauri()) return;
    try { await invoke("clear_preview", { filePath }); }
    catch (e) { /* safe to swallow */ }
  },

  /**
   * Separate vocals from accompaniment using MDX-Net (ONNX Runtime).
   * Downloads ~45 MB model on first use — listen to `separation:download_progress` event.
   * Processing emits `separation:progress` events with `{percent: 0..100}`.
   */
  async separateVocals(
    filePath: string,
    outputMode: SeparationOutputMode = "vocals_only",
  ): Promise<SeparationResult> {
    if (!isTauri()) {
      return {
        vocals_path:        filePath.replace(".wav", "_vocals.wav"),
        accompaniment_path: null,
        processing_time_ms: 0,
      };
    }
    try {
      return await invoke<SeparationResult>("separate_vocals", {
        filePath,
        outputMode,
      });
    } catch (e) {
      throw new Error(String(e));
    }
  },

  /** Delete a recording and all its sidecar files (_preview, _vocals, _accompaniment). */
  async deleteRecording(filePath: string): Promise<void> {
    if (!isTauri()) return;
    try { await invoke("delete_recording", { filePath }); }
    catch (e) { throw new Error(String(e)); }
  },

  /** Batch-read WAV header metadata (duration, size, date) for multiple files. Fast — no full decode. */
  async getRecordingsInfo(filePaths: string[]): Promise<RecordingInfo[]> {
    if (!isTauri() || filePaths.length === 0) return [];
    try { return await invoke<RecordingInfo[]>("get_recordings_info", { filePaths }); }
    catch (e) { return []; }
  },
};
