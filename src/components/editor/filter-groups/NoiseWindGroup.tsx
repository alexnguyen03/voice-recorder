import React, { useState } from "react";
import { FilterGroupHeader } from "./FilterGroupHeader";
import { ToggleWithSlider, Toggle } from "./ToggleWithSlider";
import { VoiceFilterState } from "../../../hooks/useVoiceFilters";

interface Props {
  filters: VoiceFilterState;
  disabled: boolean;
  updateFilters: (patch: Partial<VoiceFilterState>) => void;
}

const pctLabel = (v: number) => `${Math.round(v * 100)}%`;

/**
 * Noise & Wind filter group.
 * SRP: knows only about noise-gate, wind-suppressor, and de-hiss controls.
 * Observer: receives state via props and emits changes through updateFilters.
 */
export const NoiseWindGroup: React.FC<Props> = ({ filters, disabled, updateFilters }) => {
  const [open, setOpen] = useState(true);

  const activeCount = [
    filters.enable_noise_suppression,
    filters.wind_suppression,
    filters.de_hiss_enabled,
  ].filter(Boolean).length;

  return (
    <div className="border-b border-white/5">
      <FilterGroupHeader
        icon="🌬"
        label="Noise & Wind"
        open={open}
        onToggle={() => setOpen(o => !o)}
        activeCount={activeCount}
        accentClass="bg-blue-950/60 text-blue-300"
      />

      <div className={`overflow-hidden transition-all duration-300 ease-out
        ${open ? "max-h-[400px] opacity-100 pb-3" : "max-h-0 opacity-0"}`}
      >
        <div className="flex flex-col gap-3 px-1">
          {/* Wind Suppressor */}
          <ToggleWithSlider
            toggleLabel="Wind Suppressor"
            toggleHelper="Kills outdoor gust & rumble (HPF adaptive)"
            toggleChecked={filters.wind_suppression}
            sliderLabel="Intensity"
            sliderValue={filters.wind_intensity}
            sliderValueLabel={pctLabel(filters.wind_intensity)}
            disabled={disabled}
            onToggleChange={v => updateFilters({ wind_suppression: v })}
            onSliderChange={v => updateFilters({ wind_intensity: v })}
          />

          {/* Noise Gate */}
          <ToggleWithSlider
            toggleLabel="Noise Gate"
            toggleHelper="Silences background hum & static"
            toggleChecked={filters.enable_noise_suppression}
            sliderLabel="Gate Sensitivity"
            sliderValue={filters.noise_gate_sensitivity}
            sliderValueLabel={pctLabel(filters.noise_gate_sensitivity)}
            disabled={disabled}
            onToggleChange={v => updateFilters({ enable_noise_suppression: v })}
            onSliderChange={v => updateFilters({ noise_gate_sensitivity: v })}
          />

          {/* Spectral De-hiss */}
          <Toggle
            label="Spectral De-hiss"
            helper="Dynamic HF reduction during quiet passages"
            checked={filters.de_hiss_enabled}
            disabled={disabled}
            onChange={v => updateFilters({ de_hiss_enabled: v })}
          />
        </div>
      </div>
    </div>
  );
};
