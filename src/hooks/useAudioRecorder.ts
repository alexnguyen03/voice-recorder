import { useState, useEffect, useCallback } from "react";
import { AudioService, DeviceInfo, RecordConfig } from "../services/audioService";

export interface UseAudioRecorderReturn {
  isRecording: boolean;
  isPaused: boolean;
  devices: DeviceInfo[];
  selectedDeviceId: string;
  recordedFilePath: string | null;
  loading: boolean;
  error: string | null;
  selectDevice: (deviceId: string) => void;
  startRecording: (sampleRate?: number) => Promise<void>;
  stopRecording: () => Promise<string | null>;
  pauseRecording: () => Promise<void>;
  resumeRecording: () => Promise<void>;
  discardRecording: () => Promise<void>;
  clearError: () => void;
}

/**
 * Custom hook to manage recording state and interact with AudioService.
 * Isolates React components from state management and direct service calls.
 */
export const useAudioRecorder = (): UseAudioRecorderReturn => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const [recordedFilePath, setRecordedFilePath] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch available devices on mount
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
        setError(err instanceof Error ? err.message : "Unable to retrieve microphone list");
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
          channels: 1, // Default Mono for speech recording
          bit_depth: 16,
        };
        await AudioService.startRecording(config);
        setIsRecording(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error starting audio recording");
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
      setIsPaused(false);
      setRecordedFilePath(path);
      return path;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error stopping audio recording");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const pauseRecording = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await AudioService.pauseRecording();
      setIsPaused(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error pausing audio recording");
    } finally {
      setLoading(false);
    }
  }, []);

  const resumeRecording = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await AudioService.resumeRecording();
      setIsPaused(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error resuming audio recording");
    } finally {
      setLoading(false);
    }
  }, []);

  const discardRecording = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await AudioService.discardRecording();
      setIsRecording(false);
      setIsPaused(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error discarding audio recording");
    } finally {
      setLoading(false);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    isRecording,
    isPaused,
    devices,
    selectedDeviceId,
    recordedFilePath,
    loading,
    error,
    selectDevice,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    discardRecording,
    clearError,
  };
};
