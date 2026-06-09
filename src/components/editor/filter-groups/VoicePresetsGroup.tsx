import React from "react";
import { Brain, MessageSquare, Mic, Radio, Sparkles, Volume2 } from "lucide-react";
import { VoiceFilterState } from "../../../hooks/useVoiceFilters";
import { Slider } from "./ToggleWithSlider";

interface Props {
  filters: VoiceFilterState;
  disabled: boolean;
  updateFilters: (patch: Partial<VoiceFilterState>) => void;
}

// ── Preset recipes ────────────────────────────────────────────────────────────

const PRESETS = [
  {
    id: "clean_voice",
    label: "Clean Voice",
    icon: <Volume2 className="w-3 h-3" />,
    desc: "Balanced mic cleanup",
    accent: "from-blue-600 to-cyan-500",
    accentBg: "bg-blue-950/40",
    accentText: "text-cyan-300",
    accentBorder: "border-cyan-700/40",
    values: (): Partial<VoiceFilterState> => ({
      preset: "clean_voice",
      enhance_mode: "fast_clean",
      hum_removal_enabled: true,
      enable_noise_suppression: true,
      noise_gate_sensitivity: 0.58,
      de_hiss_enabled: true,
      mic_eq_enhancement: true,
      volume_boost: 0.54,
    }),
  },
  {
    id: "podcast_warm",
    label: "Podcast Warm",
    icon: <Radio className="w-3 h-3" />,
    desc: "Warm and steady voice",
    accent: "from-amber-500 to-orange-500",
    accentBg: "bg-amber-950/40",
    accentText: "text-amber-300",
    accentBorder: "border-amber-700/40",
    values: (): Partial<VoiceFilterState> => ({
      preset: "podcast_warm",
      enhance_mode: "fast_clean",
      hum_removal_enabled: true,
      de_hiss_enabled: true,
      mic_eq_enhancement: true,
      bass_boost: 0.62,
      treble_boost: 0.54,
      volume_boost: 0.58,
      reduce_plosive: true,
      plosive_sensitivity: 0.52,
      smooth_voice_cutoff: true,
    }),
  },
  {
    id: "meeting_clear",
    label: "Meeting Clear",
    icon: <MessageSquare className="w-3 h-3" />,
    desc: "Speech clarity first",
    accent: "from-emerald-600 to-teal-500",
    accentBg: "bg-emerald-950/40",
    accentText: "text-emerald-300",
    accentBorder: "border-emerald-700/40",
    values: (): Partial<VoiceFilterState> => ({
      preset: "meeting_clear",
      enhance_mode: "fast_clean",
      hum_removal_enabled: true,
      enable_noise_suppression: true,
      noise_gate_sensitivity: 0.68,
      de_hiss_enabled: true,
      mic_eq_enhancement: true,
      treble_boost: 0.60,
      mid_cut_freq: 450,
      mid_cut_q: 1.2,
      mid_cut_gain_db: -2,
      reduce_sibilance: true,
    }),
  },
  {
    id: "low_mic_rescue",
    label: "Low Mic Rescue",
    icon: <Mic className="w-3 h-3" />,
    desc: "Lift quiet recordings",
    accent: "from-violet-600 to-fuchsia-500",
    accentBg: "bg-violet-950/40",
    accentText: "text-violet-300",
    accentBorder: "border-violet-700/40",
    values: (): Partial<VoiceFilterState> => ({
      preset: "low_mic_rescue",
      enhance_mode: "best_quality",
      hum_removal_enabled: true,
      enable_noise_suppression: true,
      noise_gate_sensitivity: 0.72,
      de_hiss_enabled: true,
      mic_eq_enhancement: true,
      volume_boost: 0.72,
      bass_boost: 0.58,
      treble_boost: 0.58,
      ml_voice_layers_enabled: true,
      smooth_voice_cutoff: true,
    }),
  },
  {
    id: "noisy_room_rescue",
    label: "Noisy Room",
    icon: <Sparkles className="w-3 h-3" />,
    desc: "Strong background cleanup",
    accent: "from-rose-600 to-red-500",
    accentBg: "bg-rose-950/40",
    accentText: "text-rose-300",
    accentBorder: "border-rose-700/40",
    values: (): Partial<VoiceFilterState> => ({
      preset: "noisy_room_rescue",
      enhance_mode: "best_quality",
      hum_removal_enabled: true,
      enable_noise_suppression: true,
      noise_gate_sensitivity: 0.78,
      de_hiss_enabled: true,
      wind_suppression: true,
      wind_intensity: 0.62,
      mic_eq_enhancement: true,
      reduce_breath: true,
      breath_sensitivity: 0.62,
      reduce_plosive: true,
      plosive_sensitivity: 0.58,
      reduce_sibilance: true,
      ml_voice_layers_enabled: true,
      smooth_voice_cutoff: true,
    }),
  },
] as const;

/** Check if the current filters match a preset's values (partial match — only preset keys). */
function isPresetActive(filters: VoiceFilterState, preset: typeof PRESETS[number]): boolean {
  const vals = preset.values();
  return (Object.keys(vals) as (keyof VoiceFilterState)[]).every(k => {
    const a = filters[k];
    const b = vals[k as keyof typeof vals];
    if (typeof a === "number" && typeof b === "number") return Math.abs(a - b) < 0.01;
    return a === b;
  });
}

/**
 * VoicePresetsGroup — CapCut-style one-click preset bar.
 * SRP: only knows how to map a preset recipe onto VoiceFilterState.
 */
export const VoicePresetsGroup: React.FC<Props> = ({ filters, disabled, updateFilters }) => {
  return (
    <div className="px-3 pt-3 pb-2 border-b border-white/5">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
          Voice Enhance Engine
        </p>
        <div className="flex gap-1">
          {(["fast_clean", "best_quality"] as const).map(mode => (
            <button
              key={mode}
              disabled={disabled}
              onClick={() => updateFilters({ enhance_mode: mode })}
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-bold cursor-pointer transition-colors disabled:opacity-40
                ${filters.enhance_mode === mode
                  ? "bg-violet-600 text-white"
                  : "bg-slate-800/60 text-slate-400 hover:text-slate-200"
                }`}
              title={mode === "fast_clean" ? "Realtime-style cleanup" : "Offline stronger deterministic cleanup"}
            >
              {mode === "fast_clean" ? <Sparkles className="w-3 h-3" /> : <Brain className="w-3 h-3" />}
              {mode === "fast_clean" ? "Fast" : "Best"}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {PRESETS.map(preset => {
          const active = isPresetActive(filters, preset);
          return (
            <button
              key={preset.id}
              disabled={disabled}
              onClick={() => updateFilters(preset.values())}
              className={`
                relative flex flex-col gap-0.5 px-2.5 py-2 rounded-lg text-left
                border transition-all duration-150 active:scale-95 cursor-pointer
                disabled:opacity-40 disabled:cursor-not-allowed
                ${active
                  ? `${preset.accentBg} ${preset.accentBorder} ${preset.accentText}`
                  : "bg-slate-800/60 border-slate-700/40 text-slate-400 hover:border-slate-600 hover:text-slate-200"
                }
              `}
            >
              {/* Active glow dot */}
              {active && (
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-current opacity-80 animate-pulse" />
              )}
              <span className="flex items-center gap-1.5 font-bold text-[11px]">
                {preset.icon}
                {preset.label}
              </span>
              <span className="text-[9px] opacity-70 leading-tight">{preset.desc}</span>
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex flex-col gap-2">
        <Slider
          label="Enhance Strength"
          value={filters.enhance_strength}
          valueLabel={`${Math.round(filters.enhance_strength * 100)}%`}
          disabled={disabled}
          onChange={v => updateFilters({ enhance_strength: v })}
        />
        <Slider
          label="Natural to Clean"
          value={filters.natural_clean_balance}
          valueLabel={filters.natural_clean_balance < 0.4 ? "Natural" : filters.natural_clean_balance > 0.65 ? "Clean" : "Balanced"}
          disabled={disabled}
          onChange={v => updateFilters({ natural_clean_balance: v })}
        />
      </div>
    </div>
  );
};
