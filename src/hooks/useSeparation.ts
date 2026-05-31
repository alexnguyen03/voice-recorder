import { useState, useEffect, useCallback, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { convertFileSrc } from "@tauri-apps/api/core";
import { AudioService, SeparationResult } from "../services/audioService";

export type SeparationOutputMode = "vocals_only" | "accompaniment_only" | "both";

export interface SeparationState {
  status:            "idle" | "downloading" | "processing" | "done" | "error";
  downloadProgress:  number; // 0-100
  processingProgress: number; // 0-100
  result:            SeparationResult | null;
  errorMessage:      string | null;
}

const INITIAL: SeparationState = {
  status:             "idle",
  downloadProgress:   0,
  processingProgress: 0,
  result:             null,
  errorMessage:       null,
};

export const useSeparation = (selectedFile: string) => {
  const [state, setState] = useState<SeparationState>(INITIAL);
  const unlistenDownload  = useRef<(() => void) | null>(null);
  const unlistenProcess   = useRef<(() => void) | null>(null);

  // Reset when file changes
  useEffect(() => {
    setState(INITIAL);
  }, [selectedFile]);

  // Register Tauri event listeners
  useEffect(() => {
    const setup = async () => {
      unlistenDownload.current = await listen<{ percent: number; downloaded: number; total: number }>(
        "separation:download_progress",
        ({ payload }) => {
          setState(s => ({
            ...s,
            status:           "downloading",
            downloadProgress: payload.percent,
          }));
        }
      );

      unlistenProcess.current = await listen<{ percent: number }>(
        "separation:progress",
        ({ payload }) => {
          setState(s => ({
            ...s,
            status:             "processing",
            processingProgress: payload.percent,
          }));
        }
      );
    };
    setup();

    return () => {
      unlistenDownload.current?.();
      unlistenProcess.current?.();
    };
  }, []);

  const startSeparation = useCallback(async (mode: SeparationOutputMode = "vocals_only") => {
    if (!selectedFile) return;
    setState({ ...INITIAL, status: "processing" });
    try {
      const result = await AudioService.separateVocals(selectedFile, mode);
      setState(s => ({ ...s, status: "done", result }));
    } catch (err) {
      setState(s => ({
        ...s,
        status:       "error",
        errorMessage: String(err),
      }));
    }
  }, [selectedFile]);

  const reset = useCallback(() => setState(INITIAL), []);

  const vocalsAudioUrl = state.result?.vocals_path
    ? convertFileSrc(state.result.vocals_path) + `?t=${Date.now()}`
    : null;

  const accompanimentAudioUrl = state.result?.accompaniment_path
    ? convertFileSrc(state.result.accompaniment_path) + `?t=${Date.now()}`
    : null;

  return {
    state,
    vocalsAudioUrl,
    accompanimentAudioUrl,
    startSeparation,
    reset,
  };
};
