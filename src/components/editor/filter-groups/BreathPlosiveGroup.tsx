import React, { useState } from "react";
import { FilterGroupHeader } from "./FilterGroupHeader";
import { ToggleWithSlider } from "./ToggleWithSlider";
import { VoiceFilterState } from "../../../hooks/useVoiceFilters";

interface Props {
  filters: VoiceFilterState;
  disabled: boolean;
  updateFilters: (patch: Partial<VoiceFilterState>) => void;
}

const pctLabel = (v: number) => `${Math.round(v * 100)}%`;

/**
 * Breath & Plosive filter group.
 * SRP: knows only about breath-suppressor and plosive-reducer controls.
 */
export const BreathPlosiveGroup: React.FC<Props> = ({ filters, disabled, updateFilters }) => {
  const [open, setOpen] = useState(true);

  const activeCount = [
    filters.reduce_breath,
    filters.reduce_plosive,
  ].filter(Boolean).length;

  return (
    <div className="border-b border-white/5">
      <FilterGroupHeader
        icon="💨"
        label="Breath & Plosive"
        open={open}
        onToggle={() => setOpen(o => !o)}
        activeCount={activeCount}
        accentClass="bg-orange-950/60 text-orange-300"
      />

      <div className={`overflow-hidden transition-all duration-300 ease-out
        ${open ? "max-h-[320px] opacity-100 pb-3" : "max-h-0 opacity-0"}`}
      >
        <div className="flex flex-col gap-3 px-1">
          {/* Breath Suppressor */}
          <ToggleWithSlider
            toggleLabel="Breath Suppressor"
            toggleHelper='Removes "phì phì" inhale/exhale noise'
            toggleChecked={filters.reduce_breath}
            sliderLabel="Sensitivity"
            sliderValue={filters.breath_sensitivity}
            sliderValueLabel={pctLabel(filters.breath_sensitivity)}
            disabled={disabled}
            onToggleChange={v => updateFilters({ reduce_breath: v })}
            onSliderChange={v => updateFilters({ breath_sensitivity: v })}
          />

          {/* Plosive Reducer */}
          <ToggleWithSlider
            toggleLabel="Plosive Control (Pop Filter)"
            toggleHelper='Tames "p" and "b" mic thumps'
            toggleChecked={filters.reduce_plosive}
            sliderLabel="Sensitivity"
            sliderValue={filters.plosive_sensitivity}
            sliderValueLabel={pctLabel(filters.plosive_sensitivity)}
            disabled={disabled}
            onToggleChange={v => updateFilters({ reduce_plosive: v })}
            onSliderChange={v => updateFilters({ plosive_sensitivity: v })}
          />
        </div>
      </div>
    </div>
  );
};
