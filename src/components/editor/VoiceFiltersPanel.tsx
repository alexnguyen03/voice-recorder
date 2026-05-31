import React from "react";
import { ChevronDown, Download, Loader2, RotateCcw, Wand2 } from "lucide-react";
import { VoiceFilterState } from "../../hooks/useVoiceFilters";

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
}

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
}) => {
  const dbLabel = (value: number) => (
    value === 0.5 ? "Flat" : value > 0.5 ? `+${Math.round((value - 0.5) * 30)}dB` : `${Math.round((value - 0.5) * 30)}dB`
  );

  return (
    <div className="mt-3">
      <button
        onClick={() => setShow(!show)}
        className="flex items-center gap-2 w-full text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer transition-colors py-2 select-none"
      >
        <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${show ? "rotate-180" : ""}`} />
        <Wand2 className="w-3.5 h-3.5" />
        Voice Filters
        {isActive && hasPreview && !isProcessing && (
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

      <div className={`overflow-hidden transition-all duration-300 ease-out ${show ? "max-h-[760px] opacity-100" : "max-h-0 opacity-0"}`}>
        <div className="bg-slate-100 dark:bg-slate-800 rounded-sm p-4 flex flex-col gap-4">
          <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-relaxed">
            Filters are processed by the <strong>Rust DSP engine</strong>. What you hear is what gets exported.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Toggle
              label="Noise Gate"
              helper="Silences low-level static"
              checked={filters.enable_noise_suppression}
              disabled={isProcessing}
              onChange={(v) => updateFilters({ enable_noise_suppression: v })}
            />
            <Toggle
              label="Low Quality Mic Fix"
              helper="Removes rumble and hiss"
              checked={filters.mic_eq_enhancement}
              disabled={isProcessing}
              onChange={(v) => updateFilters({ mic_eq_enhancement: v })}
            />
          </div>

          <div className="border-t border-slate-200 dark:border-slate-700 pt-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Voice Layers</span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500">Preview/export only</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Toggle
                label="Main Vocal Focus"
                helper="Downloads model on first use"
                checked={filters.ml_voice_layers_enabled}
                disabled={isProcessing}
                onChange={(v) => updateFilters({ ml_voice_layers_enabled: v })}
              />
              <Toggle
                label="Reduce Xi / Sibilance"
                helper="Softens harsh s and sh bands"
                checked={filters.reduce_sibilance}
                disabled={isProcessing}
                onChange={(v) => updateFilters({ reduce_sibilance: v })}
              />
              <Toggle
                label="Reduce Breath"
                helper="Lowers close-mic inhale/exhale"
                checked={filters.reduce_breath}
                disabled={isProcessing}
                onChange={(v) => updateFilters({ reduce_breath: v })}
              />
              <Toggle
                label="Reduce Phi / Plosive"
                helper="Tames p and b thumps"
                checked={filters.reduce_plosive}
                disabled={isProcessing}
                onChange={(v) => updateFilters({ reduce_plosive: v })}
              />
            </div>
          </div>

          <Slider
            label="Bass Boost (Warmth)"
            value={filters.bass_boost}
            valueLabel={dbLabel(filters.bass_boost)}
            disabled={isProcessing}
            onChange={(v) => updateFilters({ bass_boost: v })}
          />
          <Slider
            label="Treble Boost (Clarity)"
            value={filters.treble_boost}
            valueLabel={dbLabel(filters.treble_boost)}
            disabled={isProcessing}
            onChange={(v) => updateFilters({ treble_boost: v })}
          />
          <Slider
            label="Volume Gain"
            value={filters.volume_boost}
            valueLabel={filters.volume_boost === 0.5 ? "1x" : filters.volume_boost > 0.5 ? `${(1.0 + (filters.volume_boost - 0.5) * 6.0).toFixed(1)}x` : `${(0.25 + (filters.volume_boost / 0.5) * 0.75).toFixed(1)}x`}
            disabled={isProcessing}
            onChange={(v) => updateFilters({ volume_boost: v })}
          />

          <div className="flex gap-2">
            <button
              onClick={resetFilters}
              disabled={!isActive || isProcessing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-bold cursor-pointer transition-all active:scale-95 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <RotateCcw className="w-3 h-3" />
              Reset
            </button>
            <button
              onClick={exportWithFilters}
              disabled={isProcessing}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-sm text-xs font-bold cursor-pointer transition-all active:scale-95 bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              {isProcessing ? "Processing..." : "Export with Filters"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface ToggleProps {
  label: string;
  helper: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}

const Toggle: React.FC<ToggleProps> = ({ label, helper, checked, disabled, onChange }) => (
  <label className="flex items-center gap-2.5 p-2 rounded-sm bg-white/60 dark:bg-slate-900/40 cursor-pointer">
    <input
      type="checkbox"
      checked={checked}
      disabled={disabled}
      onChange={(e) => onChange(e.target.checked)}
      className="cursor-pointer w-4 h-4 rounded accent-violet-500 disabled:cursor-not-allowed"
    />
    <span className="flex flex-col">
      <span className="text-xs text-slate-700 dark:text-slate-200 font-medium">{label}</span>
      <span className="text-[10px] text-slate-400">{helper}</span>
    </span>
  </label>
);

interface SliderProps {
  label: string;
  value: number;
  valueLabel: string;
  disabled?: boolean;
  onChange: (value: number) => void;
}

const Slider: React.FC<SliderProps> = ({ label, value, valueLabel, disabled, onChange }) => (
  <div>
    <div className="flex justify-between items-center mb-1.5">
      <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{label}</label>
      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-sm ${
        value === 0.5 ? "bg-slate-200 dark:bg-slate-700 text-slate-500" : "bg-violet-100 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400"
      }`}>
        {valueLabel}
      </span>
    </div>
    <input
      type="range"
      min="0"
      max="1"
      step="0.025"
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full accent-violet-500 cursor-pointer h-1 bg-slate-200 dark:bg-slate-700 rounded-sm appearance-none disabled:opacity-50"
    />
  </div>
);
