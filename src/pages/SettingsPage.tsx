import React from "react";

type ThemeType = "light" | "dark" | "system";

interface SettingsPageProps {
  devices: Array<{ id: string; name: string }>;
  selectedDeviceId: string;
  selectDevice: (id: string) => void;
  isRecording: boolean;
  theme: ThemeType;
  setTheme: (theme: ThemeType) => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  devices,
  selectedDeviceId,
  selectDevice,
  isRecording,
  theme,
  setTheme,
}) => {
  return (
    <section className="flex flex-col bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm max-w-md mx-auto w-full transition-colors duration-300 animate-fade-in">
      <h2 className="text-lg font-bold text-slate-850 dark:text-slate-100 mb-6 pb-2 border-b border-slate-200 dark:border-slate-700 text-left">
        Recording Settings
      </h2>

      {/* Device configuration */}
      <div className="w-full mb-6 text-left">
        <label className="block text-xs font-semibold text-slate-505 dark:text-slate-400 mb-2">
          Input Microphone Device
        </label>
        <select
          value={selectedDeviceId}
          onChange={(e) => selectDevice(e.target.value)}
          disabled={isRecording}
          className="w-full p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 text-sm cursor-pointer shadow-sm"
        >
          {devices.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        {isRecording && (
          <p className="text-[10px] text-amber-500 dark:text-amber-400 mt-2">
            ⚠️ Microphone cannot be changed while recording is active.
          </p>
        )}
      </div>

      {/* Theme Selector Section */}
      <div className="w-full mb-6 text-left border-t border-slate-200 dark:border-slate-700/60 pt-5">
        <label className="block text-xs font-semibold text-slate-550 dark:text-slate-400 mb-2.5">
          Theme Mode
        </label>
        <div className="flex bg-slate-100 dark:bg-slate-955 p-1 rounded-xl border border-slate-200 dark:border-slate-850 gap-1 self-start w-full">
          {(["light", "dark", "system"] as ThemeType[]).map((t) => (
            <button
              key={t}
              onClick={() => setTheme(t)}
              className={`flex-1 py-2 text-xs font-bold rounded-lg cursor-pointer transition-all duration-200 capitalize flex items-center justify-center gap-1.5 ${
                theme === t
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              {t === "light" && "☀️"}
              {t === "dark" && "🌙"}
              {t === "system" && "💻"}
              <span>{t}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="text-left bg-slate-50 dark:bg-slate-900/40 p-4 rounded-xl border border-slate-200 dark:border-slate-700/40">
        <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
          Audio Properties
        </h4>
        <ul className="text-xs text-slate-500 dark:text-slate-400 space-y-1.5">
          <li>
            • Format: <span className="text-slate-700 dark:text-slate-300 font-semibold">WAV (PCM)</span>
          </li>
          <li>
            • Sample Rate: <span className="text-slate-700 dark:text-slate-300 font-semibold">44,100 Hz</span>
          </li>
          <li>
            • Channels: <span className="text-slate-700 dark:text-slate-300 font-semibold">Mono (1 channel)</span>
          </li>
          <li>
            • Bit Depth: <span className="text-slate-700 dark:text-slate-300 font-semibold">16-bit</span>
          </li>
        </ul>
      </div>
    </section>
  );
};
