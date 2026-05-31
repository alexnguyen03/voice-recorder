import { useCallback, useEffect, useRef, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { AudioService, VoiceEffectOptions, VoiceLayerFrame } from "../services/audioService";

const PREVIEW_DEBOUNCE_MS = 500;
const isTauri = typeof window !== "undefined" && (window as any).__TAURI_INTERNALS__ !== undefined;

export type VoiceFilterState = Required<VoiceEffectOptions>;

const DEFAULT_FILTERS: VoiceFilterState = {
  enable_noise_suppression: false,
  bass_boost: 0.5,
  treble_boost: 0.5,
  volume_boost: 0.5,
  mic_eq_enhancement: false,
  ml_voice_layers_enabled: false,
  reduce_sibilance: false,
  reduce_breath: false,
  reduce_plosive: false,
};

export const toAudioUrl = (filePath: string): string => {
  if (!filePath) return "";
  if (!isTauri) return "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3";
  return convertFileSrc(filePath);
};

const isDefaultFilters = (filters: VoiceFilterState): boolean => (
  filters.bass_boost === 0.5 &&
  filters.treble_boost === 0.5 &&
  filters.volume_boost === 0.5 &&
  !filters.enable_noise_suppression &&
  !filters.mic_eq_enhancement &&
  !filters.ml_voice_layers_enabled &&
  !filters.reduce_sibilance &&
  !filters.reduce_breath &&
  !filters.reduce_plosive
);

interface UseVoiceFiltersArgs {
  selectedFile: string;
  onApplyEffects: (effects: VoiceEffectOptions) => Promise<void>;
}

export const useVoiceFilters = ({ selectedFile, onApplyEffects }: UseVoiceFiltersArgs) => {
  const [filters, setFilters] = useState<VoiceFilterState>(DEFAULT_FILTERS);
  const [activeAudioUrl, setActiveAudioUrl] = useState(() => toAudioUrl(selectedFile));
  const [hasPreview, setHasPreview] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [voiceLayers, setVoiceLayers] = useState<VoiceLayerFrame[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const schedulePreview = useCallback((nextFilters: VoiceFilterState) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (isDefaultFilters(nextFilters)) {
      setActiveAudioUrl(toAudioUrl(selectedFile));
      setHasPreview(false);
      setPreviewError(null);
      AudioService.clearPreview(selectedFile);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setIsProcessing(true);
      setPreviewError(null);
      try {
        const previewPath = await AudioService.createPreview(selectedFile, nextFilters);
        setActiveAudioUrl(toAudioUrl(previewPath) + `?t=${Date.now()}`);
        setHasPreview(true);
      } catch (err) {
        console.error("[useVoiceFilters] createPreview failed:", err);
        setPreviewError(`Preview error: ${err}`);
      } finally {
        setIsProcessing(false);
      }
    }, PREVIEW_DEBOUNCE_MS);
  }, [selectedFile]);

  const updateFilters = useCallback((patch: Partial<VoiceFilterState>) => {
    setFilters((current) => {
      const next = { ...current, ...patch };
      schedulePreview(next);
      return next;
    });
  }, [schedulePreview]);

  const resetFilters = useCallback(async () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setFilters(DEFAULT_FILTERS);
    setActiveAudioUrl(toAudioUrl(selectedFile));
    setHasPreview(false);
    setPreviewError(null);
    await AudioService.clearPreview(selectedFile);
  }, [selectedFile]);

  const exportWithFilters = useCallback(async () => {
    await onApplyEffects(filters);
  }, [filters, onApplyEffects]);

  useEffect(() => {
    let active = true;
    if (debounceRef.current) clearTimeout(debounceRef.current);

    setFilters(DEFAULT_FILTERS);
    setActiveAudioUrl(toAudioUrl(selectedFile));
    setHasPreview(false);
    setIsProcessing(false);
    setPreviewError(null);

    AudioService.loadPreviewMeta(selectedFile).then((meta) => {
      if (!active || !meta) return;
      const restored: VoiceFilterState = {
        enable_noise_suppression: meta.filters.noise_suppression,
        bass_boost: meta.filters.bass_boost,
        treble_boost: meta.filters.treble_boost,
        volume_boost: meta.filters.volume_boost,
        mic_eq_enhancement: meta.filters.mic_eq_enhancement,
        ml_voice_layers_enabled: meta.filters.ml_voice_layers_enabled ?? false,
        reduce_sibilance: meta.filters.reduce_sibilance ?? false,
        reduce_breath: meta.filters.reduce_breath ?? false,
        reduce_plosive: meta.filters.reduce_plosive ?? false,
      };
      setFilters(restored);
      setActiveAudioUrl(toAudioUrl(meta.preview_file));
      setHasPreview(true);
    });

    return () => {
      active = false;
    };
  }, [selectedFile]);

  useEffect(() => {
    let active = true;
    setVoiceLayers([]);
    AudioService.analyzeVoiceLayers(selectedFile).then((frames) => {
      if (active) setVoiceLayers(frames);
    });
    return () => {
      active = false;
    };
  }, [selectedFile]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return {
    filters,
    activeAudioUrl,
    hasPreview,
    isProcessing,
    previewError,
    voiceLayers,
    isFiltersActive: !isDefaultFilters(filters),
    processingLabel: filters.ml_voice_layers_enabled ? "DOWNLOADING MODEL / RENDERING" : "RENDERING",
    updateFilters,
    resetFilters,
    exportWithFilters,
  };
};
