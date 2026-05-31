import React, { useState, useEffect, useCallback, useRef } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { ArrowLeft, Scissors, Wand2, ChevronDown, Check, X, RotateCcw, Download, Loader2 } from "lucide-react";
import { WaveformEditor, WaveformEditorHandle, VoiceLayerFrame } from "../components/editor/WaveformEditor";
import { AudioService } from "../services/audioService";

interface VoiceDetailStudioProps {
  selectedFile: string;
  onBack: () => void;
  onTrim: (startMs: number, endMs: number) => Promise<void>;
  onCut: (startMs: number, endMs: number) => Promise<void>;
  /**
   * Called when user clicks "Export with Filters".
   * App.tsx handles the actual DSP + refreshFiles().
   */
  onApplyEffects: (effects: {
    enable_noise_suppression: boolean;
    bass_boost: number;
    treble_boost: number;
    volume_boost: number;
    mic_eq_enhancement: boolean;
    ml_voice_layers_enabled?: boolean;
    reduce_sibilance?: boolean;
    reduce_breath?: boolean;
    reduce_plosive?: boolean;
  }) => Promise<void>;
  statusMessage: string;
}

type ActionMode = "trim" | "cut" | null;

const isTauri = typeof window !== "undefined" && (window as any).__TAURI_INTERNALS__ !== undefined;

/** Derive a playable asset URL from an absolute file path. */
const toAudioUrl = (filePath: string): string => {
  if (!filePath) return "";
  if (!isTauri) return "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3";
  return convertFileSrc(filePath);
};

// ─── Debounce delay before firing a Rust preview render ───────────────────────
const PREVIEW_DEBOUNCE_MS = 500;

export const VoiceDetailStudio: React.FC<VoiceDetailStudioProps> = ({
  selectedFile,
  onBack,
  onTrim,
  onCut,
  onApplyEffects,
  statusMessage,
}) => {
  const waveformRef = useRef<WaveformEditorHandle>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // ── Audio URL state ──────────────────────────────────────────────────────────
  // Starts as the original file. Switches to the Rust-processed preview WAV
  // whenever filters are active. This is the ONLY URL the player sees.
  const [activeAudioUrl, setActiveAudioUrl] = useState(() => toAudioUrl(selectedFile));
  const [hasPreview, setHasPreview] = useState(false);  // true = player is on preview
  const [isProcessing, setIsProcessing] = useState(false); // Rust is rendering
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [voiceLayers, setVoiceLayers] = useState<VoiceLayerFrame[]>([]);

  // ── Filter state ─────────────────────────────────────────────────────────────
  const [noiseSuppression, setNoiseSuppression] = useState(false);
  const [micEqEnhancement, setMicEqEnhancement] = useState(false);
  const [bass,   setBass]   = useState(0.5); // 0.5 = neutral
  const [treble, setTreble] = useState(0.5);
  const [volume, setVolume] = useState(0.5);
  const [mlVoiceLayers, setMlVoiceLayers] = useState(false);
  const [reduceSibilance, setReduceSibilance] = useState(false);
  const [reduceBreath, setReduceBreath] = useState(false);
  const [reducePlosive, setReducePlosive] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const isFiltersActive = bass !== 0.5 || treble !== 0.5 || volume !== 0.5 || noiseSuppression || micEqEnhancement ||
    mlVoiceLayers || reduceSibilance || reduceBreath || reducePlosive;

  // ── Edit mode (trim/cut) ─────────────────────────────────────────────────────
  const [actionMode, setActionMode] = useState<ActionMode>(null);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd]   = useState(0);

  // ── Debounce ref ─────────────────────────────────────────────────────────────
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Load preview meta when file changes ──────────────────────────────────────
  useEffect(() => {
    // Reset to original file URL immediately
    setActiveAudioUrl(toAudioUrl(selectedFile));
    setHasPreview(false);
    setIsProcessing(false);
    setPreviewError(null);

    // Reset filter state
    setBass(0.5); setTreble(0.5); setVolume(0.5);
    setNoiseSuppression(false); setMicEqEnhancement(false);
    setMlVoiceLayers(false); setReduceSibilance(false); setReduceBreath(false); setReducePlosive(false);

    // Check if a preview session was saved for this file
    AudioService.loadPreviewMeta(selectedFile).then((meta) => {
      if (!meta) return;
      // Restore saved filter params
      setBass(meta.filters.bass_boost);
      setTreble(meta.filters.treble_boost);
      setVolume(meta.filters.volume_boost);
      setNoiseSuppression(meta.filters.noise_suppression);
      setMicEqEnhancement(meta.filters.mic_eq_enhancement);
      setMlVoiceLayers(meta.filters.ml_voice_layers_enabled ?? false);
      setReduceSibilance(meta.filters.reduce_sibilance ?? false);
      setReduceBreath(meta.filters.reduce_breath ?? false);
      setReducePlosive(meta.filters.reduce_plosive ?? false);
      // Load the saved preview WAV directly
      setActiveAudioUrl(toAudioUrl(meta.preview_file));
      setHasPreview(true);
      setShowFilters(true); // expand panel so user sees restored settings
    });
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

  // ── Core: trigger Rust preview generation (debounced) ────────────────────────
  const schedulePreview = useCallback((filters: {
    bass: number; treble: number; volume: number;
    noiseSuppression: boolean; micEqEnhancement: boolean;
    mlVoiceLayers: boolean; reduceSibilance: boolean; reduceBreath: boolean; reducePlosive: boolean;
  }) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const allFlat = filters.bass === 0.5 && filters.treble === 0.5 &&
                    filters.volume === 0.5 && !filters.noiseSuppression && !filters.micEqEnhancement &&
                    !filters.mlVoiceLayers && !filters.reduceSibilance && !filters.reduceBreath && !filters.reducePlosive;

    if (allFlat) {
      // All filters neutral → revert to original, clear preview cache
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
        const previewPath = await AudioService.createPreview(selectedFile, {
          enable_noise_suppression: filters.noiseSuppression,
          bass_boost:               filters.bass,
          treble_boost:             filters.treble,
          volume_boost:             filters.volume,
          mic_eq_enhancement:       filters.micEqEnhancement,
          ml_voice_layers_enabled:  filters.mlVoiceLayers,
          reduce_sibilance:         filters.reduceSibilance,
          reduce_breath:            filters.reduceBreath,
          reduce_plosive:           filters.reducePlosive,
        });
        // Bust the URL so the audio element re-loads (add timestamp cache-buster)
        setActiveAudioUrl(toAudioUrl(previewPath) + `?t=${Date.now()}`);
        setHasPreview(true);
      } catch (err) {
        console.error("[VoiceDetailStudio] createPreview failed:", err);
        setPreviewError(`Preview error: ${err}`);
      } finally {
        setIsProcessing(false);
      }
    }, PREVIEW_DEBOUNCE_MS);
  }, [selectedFile]);

  // ── Filter change handlers ────────────────────────────────────────────────────
  // Each handler updates local state immediately (instant slider movement)
  // and schedules a debounced Rust render.
  const handleBassChange = (v: number) => {
    setBass(v);
    schedulePreview({ bass: v, treble, volume, noiseSuppression, micEqEnhancement, mlVoiceLayers, reduceSibilance, reduceBreath, reducePlosive });
  };
  const handleTrebleChange = (v: number) => {
    setTreble(v);
    schedulePreview({ bass, treble: v, volume, noiseSuppression, micEqEnhancement, mlVoiceLayers, reduceSibilance, reduceBreath, reducePlosive });
  };
  const handleVolumeChange = (v: number) => {
    setVolume(v);
    schedulePreview({ bass, treble, volume: v, noiseSuppression, micEqEnhancement, mlVoiceLayers, reduceSibilance, reduceBreath, reducePlosive });
  };
  const handleNoiseSuppressionChange = (v: boolean) => {
    setNoiseSuppression(v);
    schedulePreview({ bass, treble, volume, noiseSuppression: v, micEqEnhancement, mlVoiceLayers, reduceSibilance, reduceBreath, reducePlosive });
  };
  const handleMicEqChange = (v: boolean) => {
    setMicEqEnhancement(v);
    schedulePreview({ bass, treble, volume, noiseSuppression, micEqEnhancement: v, mlVoiceLayers, reduceSibilance, reduceBreath, reducePlosive });
  };

  const handleVoiceLayerChange = (next: {
    mlVoiceLayers?: boolean;
    reduceSibilance?: boolean;
    reduceBreath?: boolean;
    reducePlosive?: boolean;
  }) => {
    const nextMl = next.mlVoiceLayers ?? mlVoiceLayers;
    const nextSibilance = next.reduceSibilance ?? reduceSibilance;
    const nextBreath = next.reduceBreath ?? reduceBreath;
    const nextPlosive = next.reducePlosive ?? reducePlosive;

    setMlVoiceLayers(nextMl);
    setReduceSibilance(nextSibilance);
    setReduceBreath(nextBreath);
    setReducePlosive(nextPlosive);
    schedulePreview({
      bass,
      treble,
      volume,
      noiseSuppression,
      micEqEnhancement,
      mlVoiceLayers: nextMl,
      reduceSibilance: nextSibilance,
      reduceBreath: nextBreath,
      reducePlosive: nextPlosive,
    });
  };

  // ── Reset all filters ─────────────────────────────────────────────────────────
  const resetFilters = useCallback(async () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setBass(0.5); setTreble(0.5); setVolume(0.5);
    setNoiseSuppression(false); setMicEqEnhancement(false);
    setMlVoiceLayers(false); setReduceSibilance(false); setReduceBreath(false); setReducePlosive(false);
    setActiveAudioUrl(toAudioUrl(selectedFile));
    setHasPreview(false);
    setPreviewError(null);
    await AudioService.clearPreview(selectedFile);
  }, [selectedFile]);

  // ── Export with current filters ───────────────────────────────────────────────
  // Always bakes from the ORIGINAL file (not from preview) with current params.
  const handleExport = useCallback(async () => {
    await onApplyEffects({
      enable_noise_suppression: noiseSuppression,
      bass_boost:               bass,
      treble_boost:             treble,
      volume_boost:             volume,
      mic_eq_enhancement:       micEqEnhancement,
      ml_voice_layers_enabled:  mlVoiceLayers,
      reduce_sibilance:         reduceSibilance,
      reduce_breath:            reduceBreath,
      reduce_plosive:           reducePlosive,
    });
  }, [onApplyEffects, noiseSuppression, bass, treble, volume, micEqEnhancement, mlVoiceLayers, reduceSibilance, reduceBreath, reducePlosive]);

  // ── Trim/Cut confirm ──────────────────────────────────────────────────────────
  const handleConfirm = useCallback(async () => {
    if (actionMode === "trim") await onTrim(trimStart, trimEnd);
    else if (actionMode === "cut") await onCut(trimStart, trimEnd);
    setActionMode(null);
  }, [actionMode, trimStart, trimEnd, onTrim, onCut]);

  const handleCancel = () => setActionMode(null);

  useEffect(() => {
    if (!actionMode) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter")  { e.preventDefault(); handleConfirm(); }
      if (e.key === "Escape") { handleCancel(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [actionMode, handleConfirm]);

  // ── Helpers ───────────────────────────────────────────────────────────────────
  const getFileName = (path: string) => {
    if (!path) return "";
    return path.split(/[/\\]/).pop() ?? "";
  };

  const formatMs = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const rem = s % 60;
    const msRem = ms % 1000;
    return `${m}:${rem.toString().padStart(2, "0")}.${msRem.toString().padStart(3, "0").slice(0, 2)}`;
  };

  const processingLabel = mlVoiceLayers ? "DOWNLOADING MODEL / RENDERING" : "RENDERING";

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="w-full flex flex-col gap-0 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 cursor-pointer transition-colors active:scale-95"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <span className="text-slate-300 dark:text-slate-600 select-none">·</span>
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">
          {getFileName(selectedFile)}
        </span>
        {/* Preview badge */}
        {hasPreview && !isProcessing && (
          <span className="ml-auto px-1.5 py-0.5 rounded-sm bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold tracking-wide flex-shrink-0">
            RUST PREVIEW
          </span>
        )}
        {isProcessing && (
          <span className="ml-auto flex items-center gap-1 px-1.5 py-0.5 rounded-sm bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 text-[10px] font-bold tracking-wide flex-shrink-0">
            <Loader2 className="w-2.5 h-2.5 animate-spin" />
            {processingLabel}
          </span>
        )}
      </div>

      {/* Waveform — plays activeAudioUrl (original OR Rust preview) */}
      <WaveformEditor
        ref={waveformRef}
        filePath={selectedFile}
        audioUrl={activeAudioUrl}
        voiceLayers={voiceLayers}
        onTrim={onTrim}
        editMode={actionMode}
        onPlayStateChange={setIsPlaying}
        onTrimRangeChange={(start, end) => {
          setTrimStart(start);
          setTrimEnd(end);
        }}
      />

      {voiceLayers.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mt-2 px-1 text-[10px] text-slate-400 dark:text-slate-500">
          <span className="font-bold text-slate-500 dark:text-slate-400">Layer map</span>
          <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-500/70" /> Main voice</span>
          <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-amber-500/80" /> Xì/Sibilance</span>
          <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-sky-500/70" /> Breath</span>
          <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-rose-500/80" /> Phì/Plosive</span>
        </div>
      )}

      {/* Confirm bar — slides in when trim/cut is active */}
      <div
        className={`overflow-hidden transition-all duration-200 ease-out ${
          actionMode ? "max-h-16 opacity-100 mt-2" : "max-h-0 opacity-0"
        }`}
      >
        <div className={`flex items-center justify-between px-3 py-2 rounded-sm text-xs ${
          actionMode === "trim"
            ? "bg-emerald-50 dark:bg-emerald-950/30"
            : "bg-rose-50 dark:bg-rose-950/30"
        }`}>
          <span className="font-mono text-slate-600 dark:text-slate-300 tabular-nums">
            {formatMs(trimStart)}
            <span className="mx-1.5 text-slate-400">→</span>
            {formatMs(trimEnd)}
          </span>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-slate-400 dark:text-slate-500 mr-1 hidden sm:inline">
              Enter to confirm
            </span>
            <button
              onClick={handleConfirm}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-sm font-bold cursor-pointer transition-all active:scale-95 ${
                actionMode === "trim"
                  ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                  : "bg-rose-600 hover:bg-rose-500 text-white"
              }`}
            >
              <Check className="w-3 h-3" />
              Apply
            </button>
            <button
              onClick={handleCancel}
              className="flex items-center px-2 py-1 rounded-sm font-bold cursor-pointer transition-all active:scale-95 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 bg-slate-200 dark:bg-slate-700"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Playback controls */}
      <div className="flex items-center gap-2 mt-3 px-1">
        <button
          onClick={() => waveformRef.current?.skipBackward()}
          className="w-7 h-7 flex items-center justify-center text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 active:scale-90 transition-all cursor-pointer bg-slate-100 dark:bg-slate-800 rounded-full"
          title="Rewind 15 s"
        >
          <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
            <path d="M12.5 3C17.15 3 21 6.85 21 11.5c0 4.65-3.85 8.5-8.5 8.5-4.14 0-7.61-2.99-8.37-6.95H6.2C6.9 15.89 9.44 18 12.5 18c3.58 0 6.5-2.92 6.5-6.5S16.08 5 12.5 5c-2.04 0-3.86 1-5 2.54V5H5v6h6V9H8.55c.98-1.78 2.87-3 4.95-3z"/>
            <text x="12.5" y="15" fontSize="6.5" fontWeight="bold" textAnchor="middle" fill="currentColor">15</text>
          </svg>
        </button>

        <button
          onClick={() => waveformRef.current?.togglePlay()}
          className="w-8 h-8 flex items-center justify-center text-slate-800 hover:text-black dark:text-slate-200 dark:hover:text-white active:scale-90 transition-all cursor-pointer"
        >
          {isPlaying ? (
            <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
            </svg>
          ) : (
            <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z"/>
            </svg>
          )}
        </button>

        <button
          onClick={() => waveformRef.current?.skipForward()}
          className="w-7 h-7 flex items-center justify-center text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 active:scale-90 transition-all cursor-pointer bg-slate-100 dark:bg-slate-800 rounded-full"
          title="Skip 15 s"
        >
          <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
            <path d="M11.5 3C6.85 3 3 6.85 3 11.5c0 4.65 3.85 8.5 8.5 8.5 4.14 0 7.61-2.99 8.37-6.95h-2.06c-.7 2.84-3.24 4.95-6.31 4.95-3.58 0-6.5-2.92-6.5-6.5S7.92 5 11.5 5c2.04 0 3.86 1 5 2.54V5h2.5v6H13V9h2.45c-.98-1.78-2.87-3-4.95-3z"/>
            <text x="11.5" y="15" fontSize="6.5" fontWeight="bold" textAnchor="middle" fill="currentColor">15</text>
          </svg>
        </button>

        <div className="w-px h-4 bg-slate-300 dark:bg-slate-600 mx-1 flex-shrink-0" />

        {/* Trim */}
        <button
          onClick={() => setActionMode(actionMode === "trim" ? null : "trim")}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-sm text-xs font-bold cursor-pointer transition-all duration-150 active:scale-95 ${
            actionMode === "trim"
              ? "bg-emerald-600 text-white shadow-sm"
              : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
          }`}
          title="Keep selected region"
        >
          <Scissors className="w-3.5 h-3.5" />
          Trim
        </button>

        {/* Cut Out */}
        <button
          onClick={() => setActionMode(actionMode === "cut" ? null : "cut")}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-sm text-xs font-bold cursor-pointer transition-all duration-150 active:scale-95 ${
            actionMode === "cut"
              ? "bg-rose-600 text-white shadow-sm"
              : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
          }`}
          title="Remove selected region"
        >
          <Scissors className="w-3.5 h-3.5 scale-x-[-1]" />
          Cut Out
        </button>
      </div>

      {/* Error messages */}
      {statusMessage && statusMessage.toLowerCase().includes("error") && (
        <div className="mt-2 text-xs text-red-600 dark:text-red-400 font-semibold bg-red-50 dark:bg-red-950/20 px-3 py-2 rounded-sm">
          {statusMessage}
        </div>
      )}
      {previewError && (
        <div className="mt-2 text-xs text-red-600 dark:text-red-400 font-semibold bg-red-50 dark:bg-red-950/20 px-3 py-2 rounded-sm">
          {previewError}
        </div>
      )}

      {/* Voice Filters */}
      <div className="mt-3">
        <button
          onClick={() => setShowFilters((v) => !v)}
          className="flex items-center gap-2 w-full text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer transition-colors py-2 select-none"
        >
          <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${showFilters ? "rotate-180" : ""}`} />
          <Wand2 className="w-3.5 h-3.5" />
          Voice Filters
          {isFiltersActive && hasPreview && !isProcessing && (
            <span className="ml-1 px-1.5 py-0.5 rounded-sm bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold tracking-wide">
              ACTIVE
            </span>
          )}
          {isProcessing && (
            <span className="ml-1 flex items-center gap-1 px-1.5 py-0.5 rounded-sm bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 text-[10px] font-bold">
              <Loader2 className="w-2.5 h-2.5 animate-spin" />
              {processingLabel}...
            </span>
          )}
        </button>

        <div className={`overflow-hidden transition-all duration-300 ease-out ${showFilters ? "max-h-[760px] opacity-100" : "max-h-0 opacity-0"}`}>
          <div className="bg-slate-100 dark:bg-slate-800 rounded-sm p-4 flex flex-col gap-4">

            {/* Info notice */}
            <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-relaxed">
              Filters are processed by the <strong>Rust DSP engine</strong> — what you hear
              is exactly what gets exported. No engine mismatch.
            </p>

            {/* Noise suppression & Mic EQ */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2.5">
                <input
                  type="checkbox"
                  id="noise-suppression"
                  checked={noiseSuppression}
                  onChange={(e) => handleNoiseSuppressionChange(e.target.checked)}
                  className="cursor-pointer w-4 h-4 rounded accent-violet-500"
                />
                <label htmlFor="noise-suppression" className="text-xs text-slate-700 dark:text-slate-200 cursor-pointer select-none font-medium">
                  Noise Gate
                </label>
                <span className="text-[10px] text-slate-400 ml-auto">RNNoise-style gate</span>
              </div>

              <div className="flex items-center gap-2.5">
                <input
                  type="checkbox"
                  id="mic-eq"
                  checked={micEqEnhancement}
                  onChange={(e) => handleMicEqChange(e.target.checked)}
                  className="cursor-pointer w-4 h-4 rounded accent-violet-500"
                />
                <label htmlFor="mic-eq" className="text-xs text-slate-700 dark:text-slate-200 cursor-pointer select-none font-medium">
                  Low Quality Mic Fix
                </label>
                <span className="text-[10px] text-slate-400 ml-auto">Removes rumble & hiss</span>
              </div>
            </div>

            {/* Voice Layers */}
            <div className="flex flex-col gap-3 border-t border-slate-200 dark:border-slate-700 pt-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                  Voice Layers
                </span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500">
                  Applies to preview/export only
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <label className="flex items-center gap-2.5 p-2 rounded-sm bg-white/60 dark:bg-slate-900/40 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={mlVoiceLayers}
                    onChange={(e) => handleVoiceLayerChange({ mlVoiceLayers: e.target.checked })}
                    disabled={isProcessing}
                    className="cursor-pointer w-4 h-4 rounded accent-violet-500 disabled:cursor-not-allowed"
                  />
                  <span className="flex flex-col">
                    <span className="text-xs text-slate-700 dark:text-slate-200 font-medium">Main Vocal Focus</span>
                    <span className="text-[10px] text-slate-400">Downloads ML model on first use</span>
                  </span>
                </label>

                <label className="flex items-center gap-2.5 p-2 rounded-sm bg-white/60 dark:bg-slate-900/40 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={reduceSibilance}
                    onChange={(e) => handleVoiceLayerChange({ reduceSibilance: e.target.checked })}
                    disabled={isProcessing}
                    className="cursor-pointer w-4 h-4 rounded accent-violet-500 disabled:cursor-not-allowed"
                  />
                  <span className="flex flex-col">
                    <span className="text-xs text-slate-700 dark:text-slate-200 font-medium">Reduce Xì / Sibilance</span>
                    <span className="text-[10px] text-slate-400">Softens harsh s, sh, xì bands</span>
                  </span>
                </label>

                <label className="flex items-center gap-2.5 p-2 rounded-sm bg-white/60 dark:bg-slate-900/40 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={reduceBreath}
                    onChange={(e) => handleVoiceLayerChange({ reduceBreath: e.target.checked })}
                    disabled={isProcessing}
                    className="cursor-pointer w-4 h-4 rounded accent-violet-500 disabled:cursor-not-allowed"
                  />
                  <span className="flex flex-col">
                    <span className="text-xs text-slate-700 dark:text-slate-200 font-medium">Reduce Breath</span>
                    <span className="text-[10px] text-slate-400">Lowers close-mic inhale/exhale</span>
                  </span>
                </label>

                <label className="flex items-center gap-2.5 p-2 rounded-sm bg-white/60 dark:bg-slate-900/40 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={reducePlosive}
                    onChange={(e) => handleVoiceLayerChange({ reducePlosive: e.target.checked })}
                    disabled={isProcessing}
                    className="cursor-pointer w-4 h-4 rounded accent-violet-500 disabled:cursor-not-allowed"
                  />
                  <span className="flex flex-col">
                    <span className="text-xs text-slate-700 dark:text-slate-200 font-medium">Reduce Phì / Plosive</span>
                    <span className="text-[10px] text-slate-400">Tames p, b, phì thumps</span>
                  </span>
                </label>
              </div>
            </div>

            {/* Bass Boost */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Bass Boost (Warmth)</label>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-sm ${
                  bass === 0.5 ? "bg-slate-200 dark:bg-slate-700 text-slate-500" : "bg-violet-100 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400"
                }`}>
                  {bass === 0.5 ? "Flat" : bass > 0.5 ? `+${Math.round((bass - 0.5) * 30)}dB` : `${Math.round((bass - 0.5) * 30)}dB`}
                </span>
              </div>
              <input
                type="range" min="0" max="1" step="0.025" value={bass}
                onChange={(e) => handleBassChange(Number(e.target.value))}
                disabled={isProcessing}
                className="w-full accent-violet-500 cursor-pointer h-1 bg-slate-200 dark:bg-slate-700 rounded-sm appearance-none disabled:opacity-50"
              />
            </div>

            {/* Treble Boost */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Treble Boost (Clarity)</label>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-sm ${
                  treble === 0.5 ? "bg-slate-200 dark:bg-slate-700 text-slate-500" : "bg-violet-100 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400"
                }`}>
                  {treble === 0.5 ? "Flat" : treble > 0.5 ? `+${Math.round((treble - 0.5) * 30)}dB` : `${Math.round((treble - 0.5) * 30)}dB`}
                </span>
              </div>
              <input
                type="range" min="0" max="1" step="0.025" value={treble}
                onChange={(e) => handleTrebleChange(Number(e.target.value))}
                disabled={isProcessing}
                className="w-full accent-violet-500 cursor-pointer h-1 bg-slate-200 dark:bg-slate-700 rounded-sm appearance-none disabled:opacity-50"
              />
            </div>

            {/* Volume Gain */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Volume Gain</label>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-sm ${
                  volume === 0.5 ? "bg-slate-200 dark:bg-slate-700 text-slate-500" : "bg-violet-100 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400"
                }`}>
                  {volume === 0.5 ? "1x" : volume > 0.5 ? `${(1.0 + (volume - 0.5) * 6.0).toFixed(1)}x` : `${(0.25 + (volume / 0.5) * 0.75).toFixed(1)}x`}
                </span>
              </div>
              <input
                type="range" min="0" max="1" step="0.025" value={volume}
                onChange={(e) => handleVolumeChange(Number(e.target.value))}
                disabled={isProcessing}
                className="w-full accent-violet-500 cursor-pointer h-1 bg-slate-200 dark:bg-slate-700 rounded-sm appearance-none disabled:opacity-50"
              />
            </div>

            {/* Action row */}
            <div className="flex gap-2">
              <button
                onClick={resetFilters}
                disabled={!isFiltersActive || isProcessing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-bold cursor-pointer transition-all active:scale-95 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed"
                title="Reset all filters and revert to original file"
              >
                <RotateCcw className="w-3 h-3" />
                Reset
              </button>
              <button
                onClick={handleExport}
                disabled={isProcessing}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-sm text-xs font-bold cursor-pointer transition-all active:scale-95 bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-60 disabled:cursor-not-allowed"
                title="Bake filters into a new file — original is never modified"
              >
                {isProcessing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                {isProcessing ? "Processing…" : "Export with Filters"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
