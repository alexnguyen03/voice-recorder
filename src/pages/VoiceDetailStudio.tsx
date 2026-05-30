import React, { useState } from "react";
import { WaveformEditor } from "../components/editor/WaveformEditor";

interface VoiceDetailStudioProps {
  selectedFile: string;
  audioUrl: string;
  onBack: () => void;
  onTrim: (startMs: number, endMs: number) => Promise<void>;
  onApplyEffects: (effects: {
    enable_noise_suppression: boolean;
    bass_boost: number;
    treble_boost: number;
  }) => Promise<void>;
  statusMessage: string;
}

export const VoiceDetailStudio: React.FC<VoiceDetailStudioProps> = ({
  selectedFile,
  audioUrl,
  onBack,
  onTrim,
  onApplyEffects,
  statusMessage,
}) => {
  const [effectsEnabled, setEffectsEnabled] = useState(false);
  const [bass, setBass] = useState(0.5);
  const [treble, setTreble] = useState(0.5);

  const handleApplyEffects = () => {
    onApplyEffects({
      enable_noise_suppression: effectsEnabled,
      bass_boost: bass,
      treble_boost: treble,
    });
  };

  return (
    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm transition-colors duration-300 w-full text-left animate-fade-in">
      <button
        onClick={onBack}
        className="mb-6 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 rounded-lg text-xs font-bold cursor-pointer transition-colors shadow-sm flex items-center gap-1.5 active:scale-95"
      >
        ⬅️ Back to Recordings List
      </button>

      <h2 className="text-lg font-bold text-slate-850 dark:text-slate-100 mb-4 border-b border-slate-200 dark:border-slate-700 pb-2">
        Voice Detail Studio
      </h2>

      {/* High-fidelity Waveform Player & Editor */}
      <div className="mb-6 bg-slate-55 dark:bg-slate-900/40 p-6 rounded-2xl border border-slate-200 dark:border-slate-700/60">
        <WaveformEditor
          filePath={selectedFile}
          audioUrl={audioUrl}
          onTrim={onTrim}
        />
      </div>

      {/* Browser Preview Mode Warning Banner */}
      {selectedFile.startsWith("[BROWSER_PREVIEW_MODE]") && (
        <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-955/20 border border-amber-200 dark:border-amber-500/30 rounded-lg text-amber-800 dark:text-amber-200 text-xs text-left leading-relaxed shadow-sm">
          <span className="font-bold block mb-1">⚠️ Browser Preview Mode Active</span>
          You are currently running the app in a standard web browser. Recording and audio processing are simulated for preview purposes, and **no actual files are written to your physical drive**. To record real audio and save WAV files, please install the Rust toolchain and execute <strong>npm run tauri dev</strong>.
        </div>
      )}

      {/* Voice Detail Filters */}
      <div className="p-6 bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-slate-200 dark:border-slate-700/60 mb-6">
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-300 mb-4 text-left">Voice Detail Filters</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
          <div>
            <div className="flex items-center gap-2.5 mb-5">
              <input
                type="checkbox"
                id="noise-cancellation"
                checked={effectsEnabled}
                onChange={(e) => setEffectsEnabled(e.target.checked)}
                className="cursor-pointer w-4 h-4 rounded accent-blue-500"
              />
              <label htmlFor="noise-cancellation" className="text-slate-700 dark:text-slate-200 text-sm cursor-pointer select-none font-medium">
                Enable Noise Suppression (RNNoise)
              </label>
            </div>

            <div className="mb-4">
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Bass Boost (Warmth)
                </label>
                <span className="text-[10px] bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold px-1.5 py-0.5 rounded">
                  {Math.round(bass * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={bass}
                onChange={(e) => setBass(Number(e.target.value))}
                className="w-full accent-blue-500 cursor-pointer h-1 bg-slate-200 dark:bg-slate-955 rounded-lg appearance-none"
              />
            </div>
          </div>

          <div>
            <div className="mb-6">
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Treble Boost (Clarity)
                </label>
                <span className="text-[10px] bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold px-1.5 py-0.5 rounded">
                  {Math.round(treble * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={treble}
                onChange={(e) => setTreble(Number(e.target.value))}
                className="w-full accent-blue-500 cursor-pointer h-1 bg-slate-200 dark:bg-slate-955 rounded-lg appearance-none"
              />
            </div>

            <button
              onClick={handleApplyEffects}
              className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 active:bg-purple-700 transition-colors rounded-lg text-white font-bold cursor-pointer text-sm shadow-sm"
            >
              Apply Voice Filters
            </button>
          </div>
        </div>
      </div>

      {statusMessage && statusMessage.toLowerCase().includes("error") && (
        <div className="mt-6 text-xs text-red-400 font-semibold text-center break-all bg-red-950/20 p-2.5 px-4 rounded border border-red-500/35">
          {statusMessage}
        </div>
      )}
    </div>
  );
};
