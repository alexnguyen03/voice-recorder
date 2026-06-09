import React from "react";
import { AlertTriangle, ChevronDown, Download, Loader2, RotateCcw, Wand2 } from "lucide-react";
import { VoiceFilterState } from "../../hooks/useVoiceFilters";
import { AudioAnalysis, InputQuality } from "../../services/audioService";
import { NoiseWindGroup }    from "./filter-groups/NoiseWindGroup";
import { BreathPlosiveGroup } from "./filter-groups/BreathPlosiveGroup";
import { EqToneGroup }       from "./filter-groups/EqToneGroup";
import { VocalCleanupGroup } from "./filter-groups/VocalCleanupGroup";
import { VoicePresetsGroup } from "./filter-groups/VoicePresetsGroup";

interface VoiceFiltersPanelProps {
  show: boolean;
  setShow: (show: boolean) => void;
  filters: VoiceFilterState;
  isActive: boolean;
  hasPreview: boolean;
  isProcessing: boolean;
  processingLabel: string;
  updateFilters: (patch: Partial<VoiceFilterState>) => void;
  resetFilters: () => Promise<void>;
  exportWithFilters: () => Promise<void>;
  analysis: AudioAnalysis | null;
}

/**
 * VoiceFiltersPanel — Composite root.
 *
 * Pattern: Composite
 *   This component owns only the outer shell, the panel toggle header,
 *   and the action buttons. All filter controls are delegated to
 *   purpose-built sub-components (SRP).
 *
 * Pattern: Observer
 *   State flows down via `filters` prop; mutations bubble up via `updateFilters`.
 *   This component knows nothing about individual filter logic.
 */
export const VoiceFiltersPanel: React.FC<VoiceFiltersPanelProps> = ({
  show,
  setShow,
  filters,
  isActive,
  hasPreview,
  isProcessing,
  processingLabel,
  updateFilters,
  resetFilters,
  exportWithFilters,
  analysis,
}) => {
  const totalActive = [
    filters.hum_removal_enabled,
    filters.enable_noise_suppression,
    filters.wind_suppression,
    filters.de_hiss_enabled,
    filters.reduce_breath,
    filters.reduce_plosive,
    filters.mic_eq_enhancement,
    filters.mid_cut_gain_db < 0,
    filters.bass_boost !== 0.5,
    filters.treble_boost !== 0.5,
    filters.volume_boost !== 0.5,
    filters.ml_voice_layers_enabled,
    filters.reduce_sibilance,
    filters.smooth_voice_cutoff,
    filters.enhance_mode === "best_quality",
    filters.preset !== null,
    filters.enhance_strength !== 0.5,
    filters.natural_clean_balance !== 0.5,
  ].filter(Boolean).length;

  return (
    <div className="mt-3">
      {/* ── Panel toggle header ────────────────────────────────────────── */}
      <button
        onClick={() => setShow(!show)}
        className="flex items-center gap-2 w-full text-xs font-bold text-slate-500
          dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200
          cursor-pointer transition-colors py-2 select-none"
      >
        <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${show ? "rotate-180" : ""}`} />
        <Wand2 className="w-3.5 h-3.5" />
        <span>Pro Studio EQ</span>

        {totalActive > 0 && !isProcessing && (
          <span className="ml-1 px-1.5 py-0.5 rounded-sm bg-violet-100 dark:bg-violet-950/40
            text-violet-600 dark:text-violet-400 text-[10px] font-bold tracking-wide">
            {totalActive} ACTIVE
          </span>
        )}
        {hasPreview && !isProcessing && (
          <span className="px-1.5 py-0.5 rounded-sm bg-emerald-100 dark:bg-emerald-950/40
            text-emerald-600 dark:text-emerald-400 text-[10px] font-bold tracking-wide">
            PREVIEW
          </span>
        )}
        {isProcessing && (
          <span className="ml-1 flex items-center gap-1 px-1.5 py-0.5 rounded-sm
            bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400
            text-[10px] font-bold">
            <Loader2 className="w-2.5 h-2.5 animate-spin" />
            {processingLabel}...
          </span>
        )}
      </button>

      {/* ── Expandable panel ──────────────────────────────────────────── */}
      <div className={`overflow-hidden transition-all duration-300 ease-out
        ${show ? "max-h-[1400px] opacity-100" : "max-h-0 opacity-0"}`}
      >
        <div className="rounded-lg overflow-hidden
          bg-slate-100/80 dark:bg-slate-800/80
          border border-slate-200 dark:border-slate-700/60
          backdrop-blur-sm"
        >
          {/* Engine note */}
          <div className="px-4 py-2.5 bg-violet-50/50 dark:bg-violet-950/20 border-b border-violet-100 dark:border-violet-900/30">
            <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-relaxed">
              All filters processed by the{" "}
              <strong className="text-violet-500 dark:text-violet-400">Rust DSP engine</strong>{" "}
              — 10-stage pipeline. What you hear = what gets exported.
            </p>
          </div>

          <InputAnalysisStrip analysis={analysis} />

          {/* ── Preset quick-apply bar ─────────────────────────────── */}
          <VoicePresetsGroup
            filters={filters}
            disabled={isProcessing}
            updateFilters={updateFilters}
          />

          {/* ── Filter groups (Composite children) ──────────────────── */}
          <div className="px-3 pt-1">
            <NoiseWindGroup
              filters={filters}
              disabled={isProcessing}
              updateFilters={updateFilters}
            />
            <BreathPlosiveGroup
              filters={filters}
              disabled={isProcessing}
              updateFilters={updateFilters}
            />
            <EqToneGroup
              filters={filters}
              disabled={isProcessing}
              updateFilters={updateFilters}
            />
            <VocalCleanupGroup
              filters={filters}
              disabled={isProcessing}
              updateFilters={updateFilters}
            />
          </div>

          {/* ── Action buttons ───────────────────────────────────────── */}
          <div className="flex gap-2 px-3 py-3 border-t border-slate-200 dark:border-slate-700/60 mt-1">
            <button
              onClick={resetFilters}
              disabled={!isActive || isProcessing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold
                cursor-pointer transition-all active:scale-95
                bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300
                hover:bg-slate-300 dark:hover:bg-slate-600
                disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <RotateCcw className="w-3 h-3" />
              Reset
            </button>

            <button
              onClick={exportWithFilters}
              disabled={isProcessing}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md
                text-xs font-bold cursor-pointer transition-all active:scale-95
                bg-violet-600 hover:bg-violet-500 text-white shadow-sm
                shadow-violet-900/30 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isProcessing
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Processing...</>
                : <><Download className="w-3.5 h-3.5" /> Export with Filters</>
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const qualityText = (q: InputQuality): string =>
  q === "good" ? "Good" : q === "okay" ? "Okay" : "Poor";

const qualityClass = (q: InputQuality): string =>
  q === "good"
    ? "text-emerald-600 dark:text-emerald-400"
    : q === "okay"
    ? "text-amber-600 dark:text-amber-400"
    : "text-red-600 dark:text-red-400";

const InputAnalysisStrip: React.FC<{ analysis: AudioAnalysis | null }> = ({ analysis }) => {
  if (!analysis) return null;
  const clipped = analysis.clipping_detected;
  return (
    <div className="grid grid-cols-3 gap-2 px-3 py-2 border-b border-slate-200 dark:border-slate-700/60 bg-slate-50/60 dark:bg-slate-900/30">
      <div className="min-w-0">
        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Input</p>
        <p className={`text-[11px] font-bold ${qualityClass(analysis.input_quality)}`}>
          {qualityText(analysis.input_quality)}
        </p>
      </div>
      <div className="min-w-0">
        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Noise</p>
        <p className={`text-[11px] font-bold ${qualityClass(analysis.noise_level)}`}>
          {qualityText(analysis.noise_level)}
        </p>
      </div>
      <div className="min-w-0">
        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Clipping</p>
        <p className={`flex items-center gap-1 text-[11px] font-bold ${clipped ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>
          {clipped && <AlertTriangle className="w-3 h-3" />}
          {clipped ? `${analysis.clipping_count}` : "None"}
        </p>
      </div>
    </div>
  );
};
