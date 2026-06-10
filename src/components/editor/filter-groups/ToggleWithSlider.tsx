import React from "react";

interface ToggleProps {
  label: string;
  helper: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}

/** Simple boolean toggle — SRP: only a toggle row. */
export const Toggle: React.FC<ToggleProps> = ({ label, helper, checked, disabled, onChange }) => (
  <label className={`flex items-center gap-2.5 p-2 rounded-md cursor-pointer transition-all
    ${checked
      ? "bg-violet-50/50 dark:bg-violet-950/20 ring-1 ring-inset ring-violet-100 dark:ring-violet-900/30"
      : "bg-slate-100/50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/40"}
    ${disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-slate-100 dark:hover:bg-slate-900/80"}`}
  >
    <div className={`relative w-8 h-4 rounded-full transition-colors flex-shrink-0
      ${checked ? "bg-violet-600" : "bg-slate-300 dark:bg-slate-600"}`}
    >
      <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform
        ${checked ? "translate-x-4" : "translate-x-0.5"}`} />
      <input
        type="checkbox" checked={checked} disabled={disabled}
        onChange={e => onChange(e.target.checked)}
        className="sr-only"
      />
    </div>
    <span className="flex flex-col min-w-0">
      <span className="text-[11px] font-semibold text-slate-800 dark:text-slate-200 leading-tight">{label}</span>
      <span className="text-[9px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5">{helper}</span>
    </span>
  </label>
);

interface SliderProps {
  label: string;
  value: number;
  valueLabel: string;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  onChange: (v: number) => void;
}

/** Standalone slider row — SRP: only a labelled range input. */
export const Slider: React.FC<SliderProps> = ({
  label, value, valueLabel, min = 0, max = 1, step = 0.025, disabled, onChange,
}) => (
  <div className="flex flex-col gap-1.5">
    <div className="flex justify-between items-center">
      <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{label}</span>
      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-sm tabular-nums
        ${value === (min + max) / 2 || value === 0
          ? "bg-slate-250 dark:bg-slate-700 text-slate-600 dark:text-slate-400"
          : "bg-violet-100 dark:bg-violet-950/60 text-violet-600 dark:text-violet-300"}`}
      >
        {valueLabel}
      </span>
    </div>
    <input
      type="range" min={min} max={max} step={step} value={value} disabled={disabled}
      onChange={e => onChange(Number(e.target.value))}
      className="w-full h-1 rounded-full accent-violet-500 cursor-pointer disabled:opacity-40"
    />
  </div>
);

interface ToggleWithSliderProps {
  toggleLabel: string;
  toggleHelper: string;
  toggleChecked: boolean;
  sliderLabel: string;
  sliderValue: number;
  sliderValueLabel: string;
  sliderMin?: number;
  sliderMax?: number;
  sliderStep?: number;
  disabled?: boolean;
  onToggleChange: (v: boolean) => void;
  onSliderChange: (v: number) => void;
}

/**
 * Composite: toggle on top, dependent slider below — always visible but
 * dims when toggle is OFF so the relationship is immediately clear.
 * ISP: receives only the props it needs for both sub-components.
 */
export const ToggleWithSlider: React.FC<ToggleWithSliderProps> = ({
  toggleLabel, toggleHelper, toggleChecked,
  sliderLabel, sliderValue, sliderValueLabel,
  sliderMin = 0, sliderMax = 1, sliderStep = 0.025,
  disabled,
  onToggleChange, onSliderChange,
}) => (
  <div className="flex flex-col gap-2 p-2 rounded-md bg-slate-100/50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/40">
    <Toggle
      label={toggleLabel} helper={toggleHelper}
      checked={toggleChecked} disabled={disabled}
      onChange={onToggleChange}
    />
    <div className={`pl-1 transition-opacity duration-200 ${toggleChecked ? "opacity-100" : "opacity-35 pointer-events-none"}`}>
      <Slider
        label={sliderLabel} value={sliderValue} valueLabel={sliderValueLabel}
        min={sliderMin} max={sliderMax} step={sliderStep}
        disabled={disabled || !toggleChecked}
        onChange={onSliderChange}
      />
    </div>
  </div>
);
