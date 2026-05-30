import { useState, useEffect, useCallback } from "react";
import { AudioService, DeviceInfo, RecordConfig } from "../services/audioService";

export interface UseAudioRecorderReturn {
  isRecording: boolean;
  devices: DeviceInfo[];
  selectedDeviceId: string;
  recordedFilePath: string | null;
  loading: boolean;
  error: string | null;
  selectDevice: (deviceId: string) => void;
  startRecording: (sampleRate?: number) => Promise<void>;
  stopRecording: () => Promise<string | null>;
  clearError: () => void;
}

/**
 * Custom hook quản lý trạng thái ghi âm và tương tác với AudioService.
 * Giúp cô lập React components khỏi logic quản lý state và gọi service.
 */
export const useAudioRecorder = (): UseAudioRecorderReturn => {
  const [isRecording, setIsRecording] = useState(false);
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const [recordedFilePath, setRecordedFilePath] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Tải danh sách thiết bị khi khởi tạo
  useEffect(() => {
    const fetchDevices = async () => {
      setLoading(true);
      try {
        const list = await AudioService.listDevices();
        setDevices(list);
        const defaultDevice = list.find((d) => d.is_default);
        if (defaultDevice) {
          setSelectedDeviceId(defaultDevice.id);
        } else if (list.length > 0) {
          setSelectedDeviceId(list[0].id);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Không thể lấy danh sách microphone");
      } finally {
        setLoading(false);
      }
    };

    fetchDevices();
  }, []);

  const selectDevice = useCallback((deviceId: string) => {
    setSelectedDeviceId(deviceId);
  }, []);

  const startRecording = useCallback(
    async (sampleRate: number = 44100) => {
      setLoading(true);
      setError(null);
      try {
        const config: RecordConfig = {
          device_id: selectedDeviceId || null,
          sample_rate: sampleRate,
          channels: 1, // Mặc định Mono cho giọng nói
          bit_depth: 16,
        };
        await AudioService.startRecording(config);
        setIsRecording(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Lỗi khi bắt đầu ghi âm");
      } finally {
        setLoading(false);
      }
    },
    [selectedDeviceId]
  );

  const stopRecording = useCallback(async (): Promise<string | null> => {
    setLoading(true);
    setError(null);
    try {
      const path = await AudioService.stopRecording();
      setIsRecording(false);
      setRecordedFilePath(path);
      return path;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi khi dừng ghi âm");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    isRecording,
    devices,
    selectedDeviceId,
    recordedFilePath,
    loading,
    error,
    selectDevice,
    startRecording,
    stopRecording,
    clearError,
  };
};
