import React, { useState } from "react";
import { FilterGroupHeader } from "./FilterGroupHeader";
import { Toggle, Slider } from "./ToggleWithSlider";
import { VoiceFilterState } from "../../../hooks/useVoiceFilters";

interface Props {
  filters: VoiceFilterState;
  disabled: boolean;
  updateFilters: (patch: Partial<VoiceFilterState>) => void;
}

const dbLabel = (v: number) =>
  v === 0.5 ? "Flat" : v > 0.5 ? `+${Math.round((v - 0.5) * 30)}dB` : `${Math.round((v - 0.5) * 30)}dB`;

const midCutLabel = (db: number) =>
  db === 0 ? "Off" : `${db.toFixed(0)}dB`;

const volLabel = (v: number) =>
  v === 0.5 ? "1.0×" : v > 0.5
    ? `${(1.0 + (v - 0.5) * 6.0).toFixed(1)}×`
    : `${(0.25 + (v / 0.5) * 0.75).toFixed(2)}×`;

/**
 * EQ & Tone filter group.
 * SRP: knows only about mic-eq, mid-cut, bass, treble, and volume controls.
 */
export const EqToneGroup: React.FC<Props> = ({ filters, disabled, updateFilters }) => {
  const [open, setOpen] = useState(true);

  const activeCount = [
    filters.mic_eq_enhancement,
    filters.mid_cut_gain_db < 0,
    filters.bass_boost !== 0.5,
    filters.treble_boost !== 0.5,
    filters.volume_boost !== 0.5,
  ].filter(Boolean).length;

  return (
    <div className="border-b border-white/5">
      <FilterGroupHeader
        icon="🎛"
        label="EQ & Tone"
        open={open}
        onToggle={() => setOpen(o => !o)}
        activeCount={activeCount}
        accentClass="bg-yellow-950/60 text-yellow-300"
      />

      <div className={`overflow-hidden transition-all duration-300 ease-out
        ${open ? "max-h-[520px] opacity-100 pb-3" : "max-h-0 opacity-0"}`}
      >
        <div className="flex flex-col gap-3 px-1">
          {/* Mic EQ Fix */}
          <Toggle
            label="Low Quality Mic Fix"
            helper="HPF + notch 50/60Hz + hiss LP for cheap mics"
            checked={filters.mic_eq_enhancement}
            disabled={disabled}
            onChange={v => updateFilters({ mic_eq_enhancement: v })}
          />

          {/* Mid Cut — resonance killer */}
          <div className="flex flex-col gap-2">
            <Slider
              label={`Mid Cut — Resonance @ ${filters.mid_cut_freq >= 1000
                ? `${(filters.mid_cut_freq / 1000).toFixed(1)}kHz`
                : `${filters.mid_cut_freq}Hz`}`}
              value={filters.mid_cut_gain_db}
              valueLabel={midCutLabel(filters.mid_cut_gain_db)}
              min={-12} max={0} step={0.5}
              disabled={disabled}
              onChange={v => updateFilters({ mid_cut_gain_db: v })}
            />
            {/* Frequency selector chips */}
            <div className="flex gap-1.5 flex-wrap">
              {[
                { label: "Phone", freq: 2000, q: 2.5, db: -6 },
                { label: "Cheap Mic", freq: 1500, q: 2.0, db: -4 },
                { label: "Nasal", freq: 1000, q: 1.5, db: -3 },
                { label: "Custom", freq: filters.mid_cut_freq, q: filters.mid_cut_q, db: filters.mid_cut_gain_db },
              ].map(preset => {
                const isActive = preset.label === "Custom"
                  ? true
                  : Math.abs(filters.mid_cut_freq - preset.freq) < 10
                    && Math.abs(filters.mid_cut_gain_db - preset.db) < 0.6;
                return (
                  <button
                    key={preset.label}
                    disabled={disabled || preset.label === "Custom"}
                    onClick={() => updateFilters({
                      mid_cut_freq:    preset.freq,
                      mid_cut_q:       preset.q,
                      mid_cut_gain_db: preset.db,
                    })}
                    className={`text-[9px] font-bold px-2 py-0.5 rounded-sm transition-all cursor-pointer
                      ${isActive && preset.label !== "Custom"
                        ? "bg-violet-600 text-white"
                        : "bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-slate-200"}
                      disabled:opacity-40 disabled:cursor-default`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Bass Boost */}
          <Slider
            label="Bass Boost (Warmth)"
            value={filters.bass_boost}
            valueLabel={dbLabel(filters.bass_boost)}
            disabled={disabled}
            onChange={v => updateFilters({ bass_boost: v })}
          />

          {/* Treble Boost */}
          <Slider
            label="Treble Boost (Clarity)"
            value={filters.treble_boost}
            valueLabel={dbLabel(filters.treble_boost)}
            disabled={disabled}
            onChange={v => updateFilters({ treble_boost: v })}
          />

          {/* Volume */}
          <Slider
            label="Volume Gain"
            value={filters.volume_boost}
            valueLabel={volLabel(filters.volume_boost)}
            disabled={disabled}
            onChange={v => updateFilters({ volume_boost: v })}
          />
        </div>
      </div>
    </div>
  );
};
