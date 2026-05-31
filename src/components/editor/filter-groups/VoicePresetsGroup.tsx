import React from "react";
import { Sparkles, Mic, Volume2, Zap } from "lucide-react";
import { VoiceFilterState } from "../../../hooks/useVoiceFilters";

interface Props {
  filters: VoiceFilterState;
  disabled: boolean;
  updateFilters: (patch: Partial<VoiceFilterState>) => void;
}

// ── Preset recipes ────────────────────────────────────────────────────────────

const PRESETS = [
  {
    id: "basic_clean",
    label: "Basic Clean",
    icon: <Volume2 className="w-3 h-3" />,
    desc: "Removes hum, hiss & mic artefacts",
    accent: "from-blue-600 to-cyan-500",
    accentBg: "bg-blue-950/40",
    accentText: "text-cyan-300",
    accentBorder: "border-cyan-700/40",
    values: (): Partial<VoiceFilterState> => ({
      hum_removal_enabled: true,
      de_hiss_enabled: true,
      mic_eq_enhancement: true,
    }),
  },
  {
    id: "denoise",
    label: "Denoise",
    icon: <Zap className="w-3 h-3" />,
    desc: "Strong background noise suppression",
    accent: "from-violet-600 to-purple-500",
    accentBg: "bg-violet-950/40",
    accentText: "text-violet-300",
    accentBorder: "border-violet-700/40",
    values: (): Partial<VoiceFilterState> => ({
      hum_removal_enabled: true,
      enable_noise_suppression: true,
      noise_gate_sensitivity: 0.65,
      de_hiss_enabled: true,
      wind_suppression: true,
      wind_intensity: 0.4,
    }),
  },
  {
    id: "voice_focus",
    label: "Voice Focus",
    icon: <Mic className="w-3 h-3" />,
    desc: "Removes breath, pops & sibilance",
    accent: "from-emerald-600 to-teal-500",
    accentBg: "bg-emerald-950/40",
    accentText: "text-emerald-300",
    accentBorder: "border-emerald-700/40",
    values: (): Partial<VoiceFilterState> => ({
      reduce_breath: true,
      breath_sensitivity: 0.6,
      reduce_plosive: true,
      plosive_sensitivity: 0.6,
      reduce_sibilance: true,
      ml_voice_layers_enabled: true,
    }),
  },
  {
    id: "studio_clean",
    label: "Studio Clean",
    icon: <Sparkles className="w-3 h-3" />,
    desc: "All-in-one professional cleanup",
    accent: "from-amber-500 to-orange-500",
    accentBg: "bg-amber-950/40",
    accentText: "text-amber-300",
    accentBorder: "border-amber-700/40",
    values: (): Partial<VoiceFilterState> => ({
      // Hum + noise
      hum_removal_enabled: true,
      enable_noise_suppression: true,
      noise_gate_sensitivity: 0.6,
      de_hiss_enabled: true,
      wind_suppression: true,
      wind_intensity: 0.35,
      // Mic fix
      mic_eq_enhancement: true,
      // Breath + plosive + sibilance
      reduce_breath: true,
      breath_sensitivity: 0.55,
      reduce_plosive: true,
      plosive_sensitivity: 0.55,
      reduce_sibilance: true,
      // ML vocal focus
      ml_voice_layers_enabled: true,
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
      <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-2">
        Quick Presets
      </p>
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
    </div>
  );
};
