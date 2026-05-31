import { useCallback, useEffect, useRef, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { AudioService, VoiceEffectOptions, FilterParams } from "../services/audioService";

const PREVIEW_DEBOUNCE_MS = 500;
const isTauri = typeof window !== "undefined" && (window as any).__TAURI_INTERNALS__ !== undefined;

/** Full filter state — every field Required so callers never have to handle undefined. */
export type VoiceFilterState = Required<VoiceEffectOptions>;

export const DEFAULT_FILTERS: VoiceFilterState = {
  // Noise & Wind
  enable_noise_suppression:  false,
  noise_gate_sensitivity:    0.5,
  wind_suppression:          false,
  wind_intensity:            0.5,
  de_hiss_enabled:           false,
  // Breath & Plosive
  reduce_breath:             false,
  breath_sensitivity:        0.5,
  reduce_plosive:            false,
  plosive_sensitivity:       0.5,
  // EQ & Tone
  mic_eq_enhancement:        false,
  bass_boost:                0.5,
  treble_boost:              0.5,
  mid_cut_freq:              1500,
  mid_cut_q:                 2.0,
  mid_cut_gain_db:           0,
  // Volume
  volume_boost:              0.5,
  // Vocal Cleanup (ML)
  ml_voice_layers_enabled:   false,
  reduce_sibilance:          false,
  smooth_voice_cutoff:       false,
};

export const toAudioUrl = (filePath: string): string => {
  if (!filePath) return "";
  if (!isTauri) return "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3";
  return convertFileSrc(filePath);
};

const isDefaultFilters = (f: VoiceFilterState): boolean =>
  !f.enable_noise_suppression &&
  f.noise_gate_sensitivity    === 0.5 &&
  !f.wind_suppression &&
  f.wind_intensity             === 0.5 &&
  !f.de_hiss_enabled &&
  !f.reduce_breath &&
  f.breath_sensitivity         === 0.5 &&
  !f.reduce_plosive &&
  f.plosive_sensitivity        === 0.5 &&
  !f.mic_eq_enhancement &&
  f.bass_boost                 === 0.5 &&
  f.treble_boost               === 0.5 &&
  f.mid_cut_freq               === 1500 &&
  f.mid_cut_q                  === 2.0 &&
  f.mid_cut_gain_db            === 0 &&
  f.volume_boost               === 0.5 &&
  !f.ml_voice_layers_enabled &&
  !f.reduce_sibilance &&
  !f.smooth_voice_cutoff;

/** Restore saved FilterParams from meta sidecar into VoiceFilterState. */
const fromFilterParams = (fp: FilterParams): VoiceFilterState => ({
  enable_noise_suppression: fp.noise_suppression,
  noise_gate_sensitivity:   fp.noise_gate_sensitivity ?? 0.5,
  wind_suppression:         fp.wind_suppression       ?? false,
  wind_intensity:           fp.wind_intensity         ?? 0.5,
  de_hiss_enabled:          fp.de_hiss_enabled        ?? false,
  reduce_breath:            fp.reduce_breath          ?? false,
  breath_sensitivity:       fp.breath_sensitivity     ?? 0.5,
  reduce_plosive:           fp.reduce_plosive         ?? false,
  plosive_sensitivity:      fp.plosive_sensitivity    ?? 0.5,
  mic_eq_enhancement:       fp.mic_eq_enhancement,
  bass_boost:               fp.bass_boost,
  treble_boost:             fp.treble_boost,
  mid_cut_freq:             fp.mid_cut_freq           ?? 1500,
  mid_cut_q:                fp.mid_cut_q              ?? 2.0,
  mid_cut_gain_db:          fp.mid_cut_gain_db        ?? 0,
  volume_boost:             fp.volume_boost,
  ml_voice_layers_enabled:  fp.ml_voice_layers_enabled ?? false,
  reduce_sibilance:         fp.reduce_sibilance        ?? false,
  smooth_voice_cutoff:      fp.smooth_voice_cutoff     ?? false,
});

interface UseVoiceFiltersArgs {
  selectedFile: string;
  onApplyEffects: (effects: VoiceEffectOptions) => Promise<void>;
}

export const useVoiceFilters = ({ selectedFile, onApplyEffects }: UseVoiceFiltersArgs) => {
  const [filters, setFilters]           = useState<VoiceFilterState>(DEFAULT_FILTERS);
  const [activeAudioUrl, setActiveAudioUrl] = useState(() => toAudioUrl(selectedFile));
  const [hasPreview, setHasPreview]     = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
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
    setFilters(current => {
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

  // Restore session when file changes
  useEffect(() => {
    let active = true;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setFilters(DEFAULT_FILTERS);
    setActiveAudioUrl(toAudioUrl(selectedFile));
    setHasPreview(false);
    setIsProcessing(false);
    setPreviewError(null);

    AudioService.loadPreviewMeta(selectedFile).then(meta => {
      if (!active || !meta) return;
      setFilters(fromFilterParams(meta.filters));
      setActiveAudioUrl(toAudioUrl(meta.preview_file));
      setHasPreview(true);
    });

    return () => { active = false; };
  }, [selectedFile]);

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  const processingLabel = filters.ml_voice_layers_enabled
    ? "DOWNLOADING MODEL / RENDERING"
    : "RENDERING";

  return {
    filters,
    activeAudioUrl,
    hasPreview,
    isProcessing,
    previewError,
    isFiltersActive: !isDefaultFilters(filters),
    processingLabel,
    updateFilters,
    resetFilters,
    exportWithFilters,
  };
};
