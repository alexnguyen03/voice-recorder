import React, { useState, useEffect, useCallback, useRef } from "react";
import { ArrowLeft, Scissors, Wand2, ChevronDown, Check, X } from "lucide-react";
import { WaveformEditor, WaveformEditorHandle } from "../components/editor/WaveformEditor";

interface VoiceDetailStudioProps {
  selectedFile: string;
  audioUrl: string;
  onBack: () => void;
  onTrim: (startMs: number, endMs: number) => Promise<void>;
  onCut: (startMs: number, endMs: number) => Promise<void>;
  onApplyEffects: (effects: {
    enable_noise_suppression: boolean;
    bass_boost: number;
    treble_boost: number;
  }) => Promise<void>;
  statusMessage: string;
}

type ActionMode = "trim" | "cut" | null;

export const VoiceDetailStudio: React.FC<VoiceDetailStudioProps> = ({
  selectedFile,
  audioUrl,
  onBack,
  onTrim,
  onCut,
  onApplyEffects,
  statusMessage,
}) => {
  const waveformRef = useRef<WaveformEditorHandle>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const [effectsEnabled, setEffectsEnabled] = useState(false);
  const [bass, setBass] = useState(0.5);
  const [treble, setTreble] = useState(0.5);
  const [showFilters, setShowFilters] = useState(false);

  // Action mode: null = idle, "trim" = keep selection, "cut" = remove selection
  const [actionMode, setActionMode] = useState<ActionMode>(null);

  // Trim range driven by waveform handles
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);

  const handleApplyEffects = () => {
    onApplyEffects({
      enable_noise_suppression: effectsEnabled,
      bass_boost: bass,
      treble_boost: treble,
    });
  };

  const getFileName = (path: string) => {
    if (!path) return "";
    const parts = path.split(/[/\\]/);
    return parts[parts.length - 1];
  };

  const handleConfirm = useCallback(async () => {
    if (actionMode === "trim") {
      await onTrim(trimStart, trimEnd);
    } else if (actionMode === "cut") {
      await onCut(trimStart, trimEnd);
    }
    setActionMode(null);
  }, [actionMode, trimStart, trimEnd, onTrim, onCut]);

  const handleCancel = () => setActionMode(null);

  // Enter = confirm, Escape = cancel
  useEffect(() => {
    if (!actionMode) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter") { e.preventDefault(); handleConfirm(); }
      if (e.key === "Escape") { handleCancel(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [actionMode, handleConfirm]);

  const formatMs = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const rem = s % 60;
    const msRem = ms % 1000;
    return `${m}:${rem.toString().padStart(2, "0")}.${msRem.toString().padStart(3, "0").slice(0, 2)}`;
  };

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
      </div>

      {/* ── Waveform ── */}
      <div className="bg-slate-100 dark:bg-slate-800 rounded-sm p-4">
        <WaveformEditor
          ref={waveformRef}
          filePath={selectedFile}
          audioUrl={audioUrl}
          onTrim={onTrim}
          trimMode={actionMode !== null}
          onPlayStateChange={setIsPlaying}
          onTrimRangeChange={(start, end) => {
            setTrimStart(start);
            setTrimEnd(end);
          }}
        />
      </div>

      {/* ── Unified control row: playback + actions ── */}
      <div className="flex items-center gap-2 mt-3 px-1">
        {/* Playback controls */}
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

        {/* Divider */}
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

      {/* Confirm bar — slides in when action is active */}
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

      {/* Errors */}
      {statusMessage && statusMessage.toLowerCase().includes("error") && (
        <div className="mt-2 text-xs text-red-600 dark:text-red-400 font-semibold bg-red-50 dark:bg-red-950/20 px-3 py-2 rounded-sm">
          {statusMessage}
        </div>
      )}

      {/* ── Voice Filters (collapsible) ── */}
      <div className="mt-3">
        <button
          onClick={() => setShowFilters((v) => !v)}
          className="flex items-center gap-2 w-full text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer transition-colors py-2 select-none"
        >
          <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${showFilters ? "rotate-180" : ""}`} />
          <Wand2 className="w-3.5 h-3.5" />
          Voice Filters
        </button>

        <div className={`overflow-hidden transition-all duration-300 ease-out ${showFilters ? "max-h-[400px] opacity-100" : "max-h-0 opacity-0"}`}>
          <div className="bg-slate-100 dark:bg-slate-800 rounded-sm p-4 flex flex-col gap-4">
            <div className="flex items-center gap-2.5">
              <input type="checkbox" id="noise-cancellation" checked={effectsEnabled}
                onChange={(e) => setEffectsEnabled(e.target.checked)}
                className="cursor-pointer w-4 h-4 rounded accent-blue-500" />
              <label htmlFor="noise-cancellation" className="text-xs text-slate-700 dark:text-slate-200 cursor-pointer select-none font-medium">
                Noise Suppression (RNNoise)
              </label>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Bass Boost (Warmth)</label>
                <span className="text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold px-1.5 py-0.5 rounded-sm">{Math.round(bass * 100)}%</span>
              </div>
              <input type="range" min="0" max="1" step="0.05" value={bass}
                onChange={(e) => setBass(Number(e.target.value))}
                className="w-full accent-blue-500 cursor-pointer h-1 bg-slate-200 dark:bg-slate-700 rounded-sm appearance-none" />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Treble Boost (Clarity)</label>
                <span className="text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold px-1.5 py-0.5 rounded-sm">{Math.round(treble * 100)}%</span>
              </div>
              <input type="range" min="0" max="1" step="0.05" value={treble}
                onChange={(e) => setTreble(Number(e.target.value))}
                className="w-full accent-blue-500 cursor-pointer h-1 bg-slate-200 dark:bg-slate-700 rounded-sm appearance-none" />
            </div>

            <button onClick={handleApplyEffects}
              className="w-full py-2 bg-violet-600 hover:bg-violet-500 active:bg-violet-700 transition-colors rounded-sm text-white font-bold cursor-pointer text-xs shadow-sm">
              Apply Voice Filters
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
