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
}

/**
 * AudioService đóng vai trò Adapter cô lập React UI khỏi các API cụ thể của Tauri.
 * Hỗ trợ chuyển đổi kiểu dữ liệu và xử lý lỗi đồng bộ.
 */
export const AudioService = {
  /**
   * Lấy danh sách microphone khả dụng.
   */
  async listDevices(): Promise<DeviceInfo[]> {
    try {
      return await invoke<DeviceInfo[]>("list_audio_devices");
    } catch (error) {
      console.error("Failed to list audio devices:", error);
      throw new Error(String(error));
    }
  },

  /**
   * Bắt đầu ghi âm với cấu hình đã chọn.
   */
  async startRecording(config: RecordConfig): Promise<void> {
    try {
      await invoke("start_audio_recording", { config });
    } catch (error) {
      console.error("Failed to start recording:", error);
      throw new Error(String(error));
    }
  },

  /**
   * Dừng ghi âm và trả về đường dẫn file âm thanh đã lưu.
   */
  async stopRecording(): Promise<string> {
    try {
      return await invoke<string>("stop_audio_recording");
    } catch (error) {
      console.error("Failed to stop recording:", error);
      throw new Error(String(error));
    }
  },

  /**
   * Cắt file âm thanh.
   */
  async trimAudio(filePath: string, startMs: number, endMs: number): Promise<string> {
    try {
      return await invoke<string>("trim_audio", { filePath, startMs, endMs });
    } catch (error) {
      console.error("Failed to trim audio:", error);
      throw new Error(String(error));
    }
  },

  /**
   * Áp dụng hiệu ứng âm thanh (khử nhiễu, EQ).
   */
  async applyVoiceEffects(filePath: string, options: VoiceEffectOptions): Promise<string> {
    try {
      return await invoke<string>("apply_voice_effects", {
        filePath,
        enableNoiseSuppression: options.enable_noise_suppression,
        bassBoost: options.bass_boost,
        trebleBoost: options.treble_boost,
      });
    } catch (error) {
      console.error("Failed to apply voice effects:", error);
      throw new Error(String(error));
    }
  },
};
