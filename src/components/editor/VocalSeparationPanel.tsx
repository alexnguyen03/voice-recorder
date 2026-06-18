import React, { useState, useRef } from "react";
import {
  Scissors, ChevronDown, Loader2, Music2, Mic2,
  Download, AlertCircle, Play, Pause, CheckCircle2, Wand2,
} from "lucide-react";
import { useSeparation, SeparationOutputMode } from "../../hooks/useSeparation";

interface VocalSeparationPanelProps {
  selectedFile: string;
  onFileOpen?: (path: string) => void;
  onUseVocals?: (path: string) => void;
}

const MODE_OPTIONS: { value: SeparationOutputMode; label: string; icon: React.ReactNode; desc: string }[] = [
  { value: "vocals_only",        icon: <Mic2  className="w-3.5 h-3.5" />, label: "Vocals Only",    desc: "Save clean vocal track" },
  { value: "accompaniment_only", icon: <Music2 className="w-3.5 h-3.5" />, label: "Background Only", desc: "Save everything except voice" },
  { value: "both",               icon: <Scissors className="w-3.5 h-3.5" />, label: "Both Stems",  desc: "Save vocals + background separately" },
];

/** Mini HTML5 audio player with play/pause toggle. */
const StemPlayer: React.FC<{ url: string; label: string }> = ({ url, label }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);

  const toggle = () => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) { el.pause(); setPlaying(false); }
    else          { el.play(); setPlaying(true); }
  };

  return (
    <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg
      bg-slate-100/50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800">
      <button
        onClick={toggle}
        className="w-7 h-7 rounded-full flex items-center justify-center
          bg-violet-600 hover:bg-violet-500 text-white transition-colors cursor-pointer"
      >
        {playing
          ? <Pause className="w-3 h-3 text-white" />
          : <Play  className="w-3 h-3 text-white ml-0.5" />}
      </button>
      <span className="text-xs font-semibold text-slate-700 dark:text-slate-350 flex-1">{label}</span>
      <a
        href={url}
        download
        className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
        title="Download"
      >
        <Download className="w-3 h-3" />
      </a>
      <audio ref={audioRef} src={url} onEnded={() => setPlaying(false)} preload="none" />
    </div>
  );
};

export const VocalSeparationPanel: React.FC<VocalSeparationPanelProps> = ({
  selectedFile,
  onUseVocals,
}) => {
  const [open,   setOpen]   = useState(false);
  const [mode,   setMode]   = useState<SeparationOutputMode>("vocals_only");
  const { state, vocalsAudioUrl, accompanimentAudioUrl, startSeparation, reset } =
    useSeparation(selectedFile);

  const busy = state.status === "downloading" || state.status === "processing";

  return (
    <div className="mt-2">
      {/* ── Toggle header ──────────────────────────────────────────────── */}
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 w-full text-xs font-bold text-slate-500
          dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200
          cursor-pointer transition-colors py-2 select-none"
      >
        <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
        <Scissors className="w-3.5 h-3.5" />
        <span>Vocal Isolation (AI Stems)</span>
        {state.status === "done" && (
          <span className="ml-2 px-1.5 py-0.5 rounded-sm bg-emerald-100 dark:bg-emerald-950/40
            text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">DONE</span>
        )}
        {busy && (
          <span className="ml-2 flex items-center gap-1 px-1.5 py-0.5 rounded-sm
            bg-violet-100 dark:bg-violet-950/40 text-violet-500 text-[10px] font-bold">
            <Loader2 className="w-2.5 h-2.5 animate-spin" />
            {state.status === "downloading" ? "Downloading AI model..." : "Separating..."}
          </span>
        )}
      </button>

      {/* ── Expandable content ─────────────────────────────────────────── */}
      <div className={`overflow-hidden transition-all duration-300 ease-out
        ${open ? "max-h-[520px] opacity-100" : "max-h-0 opacity-0"}`}>
        <div className="rounded-lg overflow-hidden
          bg-slate-50 dark:bg-slate-900/60
          border border-slate-200 dark:border-slate-800 backdrop-blur-sm">

          <div className="px-4 py-4 flex flex-col gap-3">
            {/* Mode selector */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                Output Stem
              </label>
              <div className="flex gap-1.5 flex-wrap">
                {MODE_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    disabled={busy}
                    onClick={() => setMode(opt.value)}
                    title={opt.desc}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-bold
                      cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed
                      ${mode === opt.value
                        ? "bg-violet-600 text-white shadow-sm"
                        : "bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-700"
                      }`}
                  >
                    {opt.icon}{opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Download progress */}
            {state.status === "downloading" && (
              <div className="flex flex-col gap-1.5 mt-1">
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>Downloading MDX-Net AI model (approx. 45 MB)...</span>
                  <span>{state.downloadProgress}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-violet-500 transition-all duration-200"
                    style={{ width: `${state.downloadProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Processing progress */}
            {state.status === "processing" && (
              <div className="flex flex-col gap-1.5 mt-1">
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>Processing separation on CPU...</span>
                  <span>{state.processingProgress}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                    style={{ width: `${state.processingProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Error */}
            {state.status === "error" && (
              <div className="flex items-start gap-2 p-2.5 rounded-lg
                bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50">
                <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                <p className="text-[11px] text-red-600 dark:text-red-400 leading-snug">
                  {state.errorMessage}
                </p>
              </div>
            )}

            {/* Results */}
            {state.status === "done" && (
              <div className="flex flex-col gap-2 mt-1">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-500">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Stems ready (processed in {((state.result?.processing_time_ms ?? 0) / 1000).toFixed(1)}s)
                </div>
                {vocalsAudioUrl && (
                  <StemPlayer
                    url={vocalsAudioUrl}
                    label="Vocals Track"
                  />
                )}
                {accompanimentAudioUrl && (
                  <StemPlayer
                    url={accompanimentAudioUrl}
                    label="Instrumental Track"
                  />
                )}
                {/* Edit Vocals with Filters */}
                {vocalsAudioUrl && state.result?.vocals_path && onUseVocals && (
                  <button
                    onClick={() => onUseVocals(state.result!.vocals_path!)}
                    className="flex items-center justify-center gap-1.5 w-full py-2 rounded-lg
                      text-[11px] font-bold cursor-pointer transition-all active:scale-95
                      bg-violet-600 hover:bg-violet-500 text-white shadow-sm mt-1"
                  >
                    <Wand2 className="w-3.5 h-3.5" />
                    Load Vocals into Audio Effects
                  </button>
                )}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-2 mt-2">
              {(state.status === "done" || state.status === "error") && (
                <button
                  onClick={reset}
                  className="flex-1 py-1.5 rounded-lg text-xs font-bold cursor-pointer
                    bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400
                    hover:bg-slate-300 dark:hover:bg-slate-700 transition-all"
                >
                  Reset
                </button>
              )}

              <button
                onClick={() => startSeparation(mode)}
                disabled={busy}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg
                  text-xs font-bold cursor-pointer transition-all active:scale-95
                  bg-violet-600 hover:bg-violet-500 text-white
                  disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
              >
                {busy
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Processing...</>
                  : <><Scissors className="w-3.5 h-3.5" />Separate Stems</>
                }
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
