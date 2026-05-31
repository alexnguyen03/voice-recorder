import React, { useState } from "react";
import { Mic } from "lucide-react";
import { FilterGroupHeader } from "./FilterGroupHeader";
import { Toggle } from "./ToggleWithSlider";
import { VoiceFilterState } from "../../../hooks/useVoiceFilters";

interface Props {
  filters: VoiceFilterState;
  disabled: boolean;
  updateFilters: (patch: Partial<VoiceFilterState>) => void;
}

/**
 * Vocal Cleanup filter group — ML-powered and spectral voice processing.
 * SRP: knows only about vocal-focus, sibilance, and smooth-cutoff controls.
 */
export const VocalCleanupGroup: React.FC<Props> = ({ filters, disabled, updateFilters }) => {
  const [open, setOpen] = useState(false); // collapsed by default — less common

  const activeCount = [
    filters.ml_voice_layers_enabled,
    filters.reduce_sibilance,
    filters.smooth_voice_cutoff,
  ].filter(Boolean).length;

  return (
    <div className="border-b border-white/5">
      <FilterGroupHeader
        icon={<Mic className="w-3.5 h-3.5" />}
        label="Vocal Cleanup"
        open={open}
        onToggle={() => setOpen(o => !o)}
        activeCount={activeCount}
        accentClass="bg-emerald-950/60 text-emerald-300"
      />

      <div className={`overflow-hidden transition-all duration-300 ease-out
        ${open ? "max-h-[280px] opacity-100 pb-3" : "max-h-0 opacity-0"}`}
      >
        <div className="flex flex-col gap-2 px-1">
          <Toggle
            label="Main Vocal Focus"
            helper="Spectral gate isolates voice — downloads model on first use"
            checked={filters.ml_voice_layers_enabled}
            disabled={disabled}
            onChange={v => updateFilters({ ml_voice_layers_enabled: v })}
          />
          <Toggle
            label="Reduce Sibilance"
            helper='Softens harsh "s" and "sh" — dynamic de-esser'
            checked={filters.reduce_sibilance}
            disabled={disabled}
            onChange={v => updateFilters({ reduce_sibilance: v })}
          />
          <Toggle
            label="Smooth Voice Cutoff"
            helper="Adaptive ceiling that tames level spikes without compression artefacts"
            checked={filters.smooth_voice_cutoff}
            disabled={disabled}
            onChange={v => updateFilters({ smooth_voice_cutoff: v })}
          />
        </div>
      </div>
    </div>
  );
};
