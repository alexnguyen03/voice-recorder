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
}

export interface VoiceEffectOptions {
  enable_noise_suppression: boolean;
  bass_boost: number; // 0.0 - 1.0
  treble_boost: number; // 0.0 - 1.0
  volume_boost: number; // 0.0 - 1.0
  mic_eq_enhancement: boolean;
}

/**
 * Helper to check if the application is running inside a native Tauri WebView environment.
 * If running in a standard web browser, it returns false.
 */
const isTauri = (): boolean => {
  return typeof window !== "undefined" && (window as any).__TAURI_INTERNALS__ !== undefined;
};

/**
 * AudioService acts as an Adapter isolating the React UI from Tauri's IPC details.
 * It provides browser fallbacks for previewing styling and basic mock interactions.
 */
export const AudioService = {
  /**
   * Scans and lists available input microphone devices.
   */
  async listDevices(): Promise<DeviceInfo[]> {
    if (!isTauri()) {
      console.warn("Running in standard browser. Returning mock microphone devices.");
      return [
        {
          id: "mock_mic_1",
          name: "Mock Built-in Microphone (Browser)",
          is_default: true,
        },
        {
          id: "mock_mic_2",
          name: "Mock External USB Microphone (Browser)",
          is_default: false,
        },
      ];
    }

    try {
      return await invoke<DeviceInfo[]>("list_audio_devices");
    } catch (error) {
      console.error("Failed to list audio devices:", error);
      throw new Error(String(error));
    }
  },

  /**
   * Starts live audio recording stream.
   */
  async startRecording(config: RecordConfig): Promise<void> {
    if (!isTauri()) {
      console.warn("Running in standard browser. Simulating start recording.", config);
      return;
    }

    try {
      await invoke("start_audio_recording", { config });
    } catch (error) {
      console.error("Failed to start recording:", error);
      throw new Error(String(error));
    }
  },

  /**
   * Stops live recording stream and saves the raw PCM buffer to disk, returning the saved path.
   */
  async stopRecording(): Promise<string> {
    if (!isTauri()) {
      console.warn("Running in standard browser. Simulating stop recording.");
      return "[BROWSER_PREVIEW_MODE] voice_recording_mock.wav";
    }

    try {
      return await invoke<string>("stop_audio_recording");
    } catch (error) {
      console.error("Failed to stop recording:", error);
      throw new Error(String(error));
    }
  },

  /**
   * Pauses live audio recording stream.
   */
  async pauseRecording(): Promise<void> {
    if (!isTauri()) {
      console.warn("Running in standard browser. Simulating pause recording.");
      return;
    }

    try {
      await invoke("pause_audio_recording");
    } catch (error) {
      console.error("Failed to pause recording:", error);
      throw new Error(String(error));
    }
  },

  /**
   * Resumes live audio recording stream.
   */
  async resumeRecording(): Promise<void> {
    if (!isTauri()) {
      console.warn("Running in standard browser. Simulating resume recording.");
      return;
    }

    try {
      await invoke("resume_audio_recording");
    } catch (error) {
      console.error("Failed to resume recording:", error);
      throw new Error(String(error));
    }
  },

  /**
   * Discards the active audio recording stream without saving.
   */
  async discardRecording(): Promise<void> {
    if (!isTauri()) {
      console.warn("Running in standard browser. Simulating discard recording.");
      return;
    }

    try {
      await invoke("discard_audio_recording");
    } catch (error) {
      console.error("Failed to discard recording:", error);
      throw new Error(String(error));
    }
  },

  /**
   * Trims the audio file between starting and ending millisecond ranges.
   */
  async trimAudio(filePath: string, startMs: number, endMs: number): Promise<string> {
    if (!isTauri()) {
      console.warn("Running in standard browser. Simulating audio trim.");
      return filePath.replace(".wav", "_trimmed.wav");
    }

    try {
      return await invoke<string>("trim_audio", { filePath, startMs, endMs });
    } catch (error) {
      console.error("Failed to trim audio:", error);
      throw new Error(String(error));
    }
  },

  /**
   * Removes the segment between startMs and endMs, keeping the audio before and after.
   */
  async cutAudioSegment(filePath: string, startMs: number, endMs: number): Promise<string> {
    if (!isTauri()) {
      console.warn("Running in standard browser. Simulating audio cut.");
      return filePath.replace(".wav", "_cut.wav");
    }

    try {
      return await invoke<string>("cut_audio_segment", { filePath, startMs, endMs });
    } catch (error) {
      console.error("Failed to cut audio segment:", error);
      throw new Error(String(error));
    }
  },

  /**
   * Applies DSP filters (noise cancellation and EQ boosts) to the audio file.
   */
  async applyVoiceEffects(filePath: string, options: VoiceEffectOptions): Promise<string> {
    if (!isTauri()) {
      console.warn("Running in standard browser. Simulating DSP effects application.");
      return filePath.replace(".wav", "_enhanced.wav");
    }

    try {
      return await invoke<string>("apply_voice_effects", {
        filePath,
        enableNoiseSuppression: options.enable_noise_suppression,
        bassBoost: options.bass_boost,
        trebleBoost: options.treble_boost,
        volumeBoost: options.volume_boost,
        micEqEnhancement: options.mic_eq_enhancement,
      });
    } catch (error) {
      console.error("Failed to apply voice effects:", error);
      throw new Error(String(error));
    }
  },

  /**
   * Scans and returns all recorded WAV file absolute paths inside User's Documents/VoiceRecorder.
   */
  async listRecordedFiles(): Promise<string[]> {
    if (!isTauri()) {
      console.warn("Running in standard browser. Returning mock recorded files.");
      return [
        "[BROWSER_PREVIEW_MODE] mock_voice_recording_1.wav",
        "[BROWSER_PREVIEW_MODE] mock_voice_recording_2.wav",
      ];
    }

    try {
      return await invoke<string[]>("list_recorded_files");
    } catch (error) {
      console.error("Failed to list recorded files:", error);
      throw new Error(String(error));
    }
  },
};
