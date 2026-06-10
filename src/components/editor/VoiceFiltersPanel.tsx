import React from "react";
import { AlertTriangle, ChevronDown, Download, Loader2, RotateCcw, Wand2 } from "lucide-react";
import { VoiceFilterState } from "../../hooks/useVoiceFilters";
import { AudioAnalysis, InputQuality } from "../../services/audioService";
import { Toggle, Slider, ToggleWithSlider } from "./filter-groups/ToggleWithSlider";

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

const pctLabel = (v: number) => `${Math.round(v * 100)}%`;

const dbLabel = (v: number) =>
  v === 0.5 ? "Flat" : v > 0.5 ? `+${Math.round((v - 0.5) * 30)}dB` : `${Math.round((v - 0.5) * 30)}dB`;

const midCutLabel = (db: number) =>
  db === 0 ? "Off" : `${db.toFixed(0)}dB`;

const volLabel = (v: number) =>
  v === 0.5 ? "1.0×" : v > 0.5
    ? `${(1.0 + (v - 0.5) * 6.0).toFixed(1)}×`
    : `${(0.25 + (v / 0.5) * 0.75).toFixed(2)}×`;

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
        <span>Audio Effects & EQ</span>

        {hasPreview && !isProcessing && (
          <span className="ml-2 px-1.5 py-0.5 rounded-sm bg-emerald-100 dark:bg-emerald-950/40
            text-emerald-600 dark:text-emerald-400 text-[10px] font-bold tracking-wide">
            PREVIEW READY
          </span>
        )}
        {isProcessing && (
          <span className="ml-2 flex items-center gap-1 px-1.5 py-0.5 rounded-sm
            bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400
            text-[10px] font-bold">
            <Loader2 className="w-2.5 h-2.5 animate-spin" />
            {processingLabel}...
          </span>
        )}
      </button>

      {/* ── Expandable panel ──────────────────────────────────────────── */}
      <div className={`overflow-hidden transition-all duration-300 ease-out
        ${show ? "max-h-[1600px] opacity-100" : "max-h-0 opacity-0"}`}
      >
        <div className="rounded-lg overflow-hidden
          bg-slate-50 dark:bg-slate-900/60
          border border-slate-200 dark:border-slate-800
          backdrop-blur-sm"
        >
          <InputAnalysisStrip analysis={analysis} />

          {/* ── Form content ───────────────────────────────────────── */}
          <div className="px-4 py-4 flex flex-col gap-6">
            
            {/* 1. Noise & Static Group */}
            <div className="flex flex-col gap-3">
              <h4 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest border-b border-slate-200/50 dark:border-slate-800 pb-1">
                Noise & Static
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Toggle
                  label="Electrical Hum Removal"
                  helper="Cuts 50Hz/60Hz ground buzz"
                  checked={filters.hum_removal_enabled}
                  disabled={isProcessing}
                  onChange={v => updateFilters({ hum_removal_enabled: v })}
                />
                <Toggle
                  label="Spectral De-hiss"
                  helper="Dynamic high frequency noise reduction"
                  checked={filters.de_hiss_enabled}
                  disabled={isProcessing}
                  onChange={v => updateFilters({ de_hiss_enabled: v })}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-1">
                <ToggleWithSlider
                  toggleLabel="Noise Gate"
                  toggleHelper="Mutes microphone static in silent gaps"
                  toggleChecked={filters.enable_noise_suppression}
                  sliderLabel="Gate Sensitivity"
                  sliderValue={filters.noise_gate_sensitivity}
                  sliderValueLabel={pctLabel(filters.noise_gate_sensitivity)}
                  disabled={isProcessing}
                  onToggleChange={v => updateFilters({ enable_noise_suppression: v })}
                  onSliderChange={v => updateFilters({ noise_gate_sensitivity: v })}
                />
                <ToggleWithSlider
                  toggleLabel="Wind Suppressor"
                  toggleHelper="Cuts outdoor wind rumble"
                  toggleChecked={filters.wind_suppression}
                  sliderLabel="Intensity"
                  sliderValue={filters.wind_intensity}
                  sliderValueLabel={pctLabel(filters.wind_intensity)}
                  disabled={isProcessing}
                  onToggleChange={v => updateFilters({ wind_suppression: v })}
                  onSliderChange={v => updateFilters({ wind_intensity: v })}
                />
              </div>
            </div>

            {/* 2. Speech Cleanup Group */}
            <div className="flex flex-col gap-3">
              <h4 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest border-b border-slate-200/50 dark:border-slate-800 pb-1">
                Speech Cleanup
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <ToggleWithSlider
                  toggleLabel="Breath Suppressor"
                  toggleHelper="Tames loud inhale/exhale breath sounds"
                  toggleChecked={filters.reduce_breath}
                  sliderLabel="Sensitivity"
                  sliderValue={filters.breath_sensitivity}
                  sliderValueLabel={pctLabel(filters.breath_sensitivity)}
                  disabled={isProcessing}
                  onToggleChange={v => updateFilters({ reduce_breath: v })}
                  onSliderChange={v => updateFilters({ breath_sensitivity: v })}
                />
                <ToggleWithSlider
                  toggleLabel="Plosive Control"
                  toggleHelper="Tames 'p' and 'b' air blasts (Pop Filter)"
                  toggleChecked={filters.reduce_plosive}
                  sliderLabel="Sensitivity"
                  sliderValue={filters.plosive_sensitivity}
                  sliderValueLabel={pctLabel(filters.plosive_sensitivity)}
                  disabled={isProcessing}
                  onToggleChange={v => updateFilters({ reduce_plosive: v })}
                  onSliderChange={v => updateFilters({ plosive_sensitivity: v })}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-1">
                <Toggle
                  label="Vocal Focus"
                  helper="Focuses on principal vocal frequencies"
                  checked={filters.ml_voice_layers_enabled}
                  disabled={isProcessing}
                  onChange={v => updateFilters({ ml_voice_layers_enabled: v })}
                />
                <Toggle
                  label="De-esser (Sibilance)"
                  helper="Softens harsh 's' and 'sh' sounds"
                  checked={filters.reduce_sibilance}
                  disabled={isProcessing}
                  onChange={v => updateFilters({ reduce_sibilance: v })}
                />
                <Toggle
                  label="Smooth Voice Cutoff"
                  helper="Soft ceiling to avoid signal clipping"
                  checked={filters.smooth_voice_cutoff}
                  disabled={isProcessing}
                  onChange={v => updateFilters({ smooth_voice_cutoff: v })}
                />
              </div>
            </div>

            {/* 3. EQ & Tone Group */}
            <div className="flex flex-col gap-3">
              <h4 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest border-b border-slate-200/50 dark:border-slate-800 pb-1">
                EQ & Tone
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-3">
                  <Toggle
                    label="Mic EQ Enhancer"
                    helper="Applies speech correction curve for cheap mics"
                    checked={filters.mic_eq_enhancement}
                    disabled={isProcessing}
                    onChange={v => updateFilters({ mic_eq_enhancement: v })}
                  />

                  {/* Mid Cut — resonance killer */}
                  <div className="flex flex-col gap-2 p-2 rounded-md bg-slate-100/50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/40">
                    <Slider
                      label={`Mid Cut (Resonance @ ${filters.mid_cut_freq >= 1000
                        ? `${(filters.mid_cut_freq / 1000).toFixed(1)}kHz`
                        : `${filters.mid_cut_freq}Hz`})`}
                      value={filters.mid_cut_gain_db}
                      valueLabel={midCutLabel(filters.mid_cut_gain_db)}
                      min={-12} max={0} step={0.5}
                      disabled={isProcessing}
                      onChange={v => updateFilters({ mid_cut_gain_db: v })}
                    />
                    <div className="flex gap-1.5 flex-wrap mt-0.5">
                      {[
                        { label: "Phone Cut", freq: 2000, q: 2.5, db: -6 },
                        { label: "Cheap Mic Cut", freq: 1500, q: 2.0, db: -4 },
                        { label: "Nasal Cut", freq: 1000, q: 1.5, db: -3 },
                      ].map(preset => {
                        const isActive = Math.abs(filters.mid_cut_freq - preset.freq) < 10
                          && Math.abs(filters.mid_cut_gain_db - preset.db) < 0.6;
                        return (
                          <button
                            key={preset.label}
                            type="button"
                            disabled={isProcessing}
                            onClick={() => updateFilters({
                              mid_cut_freq:    preset.freq,
                              mid_cut_q:       preset.q,
                              mid_cut_gain_db: preset.db,
                            })}
                            className={`text-[9px] font-bold px-2 py-0.5 rounded-sm transition-all cursor-pointer
                              ${isActive
                                ? "bg-violet-600 text-white"
                                : "bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-350 dark:hover:bg-slate-700"}`}
                          >
                            {preset.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <Slider
                    label="Bass Boost (Warmth)"
                    value={filters.bass_boost}
                    valueLabel={dbLabel(filters.bass_boost)}
                    disabled={isProcessing}
                    onChange={v => updateFilters({ bass_boost: v })}
                  />
                  <Slider
                    label="Treble Boost (Clarity)"
                    value={filters.treble_boost}
                    valueLabel={dbLabel(filters.treble_boost)}
                    disabled={isProcessing}
                    onChange={v => updateFilters({ treble_boost: v })}
                  />
                  <Slider
                    label="Volume Gain"
                    value={filters.volume_boost}
                    valueLabel={volLabel(filters.volume_boost)}
                    disabled={isProcessing}
                    onChange={v => updateFilters({ volume_boost: v })}
                  />
                </div>
              </div>
            </div>

          </div>

          {/* ── Action buttons ───────────────────────────────────────── */}
          <div className="flex gap-2 px-4 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-100/30 dark:bg-slate-950/20">
            <button
              onClick={resetFilters}
              disabled={!isActive || isProcessing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold
                cursor-pointer transition-all active:scale-95
                bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400
                hover:bg-slate-300 dark:hover:bg-slate-700
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
                disabled:opacity-60 disabled:cursor-not-allowed"
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
    <div className="grid grid-cols-3 gap-2 px-4 py-2 border-b border-slate-200 dark:border-slate-800 bg-slate-100/50 dark:bg-slate-900/30">
      <div className="min-w-0">
        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-450 dark:text-slate-500">Input Quality</p>
        <p className={`text-[11px] font-bold ${qualityClass(analysis.input_quality)}`}>
          {qualityText(analysis.input_quality)}
        </p>
      </div>
      <div className="min-w-0">
        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-450 dark:text-slate-500">Noise Level</p>
        <p className={`text-[11px] font-bold ${qualityClass(analysis.noise_level)}`}>
          {qualityText(analysis.noise_level)}
        </p>
      </div>
      <div className="min-w-0">
        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-450 dark:text-slate-500">Digital Clipping</p>
        <p className={`flex items-center gap-1 text-[11px] font-bold ${clipped ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>
          {clipped && <AlertTriangle className="w-3 h-3" />}
          {clipped ? `${analysis.clipping_count} peaks` : "None"}
        </p>
      </div>
    </div>
  );
};
