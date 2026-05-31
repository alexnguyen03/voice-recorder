import React, { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, Scissors, X } from "lucide-react";
import { WaveformEditor, WaveformEditorHandle } from "../components/editor/WaveformEditor";
import { VoiceFiltersPanel } from "../components/editor/VoiceFiltersPanel";
import { VocalSeparationPanel } from "../components/editor/VocalSeparationPanel";
import { useVoiceFilters } from "../hooks/useVoiceFilters";
import { VoiceEffectOptions } from "../services/audioService";

interface VoiceDetailStudioProps {
  selectedFile: string;
  onBack: () => void;
  onTrim: (startMs: number, endMs: number) => Promise<void>;
  onCut: (startMs: number, endMs: number) => Promise<void>;
  onApplyEffects: (effects: VoiceEffectOptions) => Promise<void>;
  statusMessage: string;
}

type ActionMode = "trim" | "cut" | null;

export const VoiceDetailStudio: React.FC<VoiceDetailStudioProps> = ({
  selectedFile,
  onBack,
  onTrim,
  onCut,
  onApplyEffects,
  statusMessage,
}) => {
  const waveformRef = useRef<WaveformEditorHandle>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [actionMode, setActionMode] = useState<ActionMode>(null);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  // When the user clicks "Edit Vocals with Filters" we swap the filter source
  // to the separated vocals stem without changing the waveform / player.
  const [filterSourceFile, setFilterSourceFile] = useState(selectedFile);

  const {
    filters,
    activeAudioUrl,
    hasPreview,
    isProcessing,
    previewError,
    isFiltersActive,
    processingLabel,
    updateFilters,
    resetFilters,
    exportWithFilters,
  } = useVoiceFilters({ selectedFile: filterSourceFile, onApplyEffects });

  // Reset filterSourceFile whenever the user switches to a different recording
  useEffect(() => {
    setFilterSourceFile(selectedFile);
  }, [selectedFile]);

  const handleUseVocals = (vocalsPath: string) => {
    setFilterSourceFile(vocalsPath);
    setShowFilters(true);
  };

  const isEditingVocalStem = filterSourceFile !== selectedFile;

  const handleConfirm = useCallback(async () => {
    if (actionMode === "trim") await onTrim(trimStart, trimEnd);
    if (actionMode === "cut") await onCut(trimStart, trimEnd);
    setActionMode(null);
  }, [actionMode, trimStart, trimEnd, onTrim, onCut]);

  useEffect(() => {
    if (!actionMode) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleConfirm();
      }
      if (e.key === "Escape") setActionMode(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [actionMode, handleConfirm]);

  useEffect(() => {
    if (hasPreview) setShowFilters(true);
  }, [hasPreview]);

  const getFileName = (path: string) => path.split(/[/\\]/).pop() ?? "";

  const formatMs = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const rem = s % 60;
    const msRem = ms % 1000;
    return `${m}:${rem.toString().padStart(2, "0")}.${msRem.toString().padStart(3, "0").slice(0, 2)}`;
  };

  return (
    <div className="w-full flex flex-col gap-0 animate-fade-in">
      <Header
        fileName={getFileName(selectedFile)}
        hasPreview={hasPreview}
        isProcessing={isProcessing}
        processingLabel={processingLabel}
        isEditingVocalStem={isEditingVocalStem}
        onBack={onBack}
      />

      <WaveformEditor
        ref={waveformRef}
        filePath={selectedFile}
        audioUrl={activeAudioUrl}
        onTrim={onTrim}
        editMode={actionMode}
        onPlayStateChange={setIsPlaying}
        onTrimRangeChange={(start, end) => {
          setTrimStart(start);
          setTrimEnd(end);
        }}
      />

      <ConfirmBar
        actionMode={actionMode}
        trimStart={trimStart}
        trimEnd={trimEnd}
        formatMs={formatMs}
        onConfirm={handleConfirm}
        onCancel={() => setActionMode(null)}
      />

      <TransportControls
        isPlaying={isPlaying}
        actionMode={actionMode}
        onTogglePlay={() => waveformRef.current?.togglePlay()}
        onSkipBackward={() => waveformRef.current?.skipBackward()}
        onSkipForward={() => waveformRef.current?.skipForward()}
        onSetActionMode={setActionMode}
      />

      <ErrorText message={statusMessage.toLowerCase().includes("error") ? statusMessage : ""} />
      <ErrorText message={previewError ?? ""} />

      <VoiceFiltersPanel
        show={showFilters}
        setShow={setShowFilters}
        filters={filters}
        isActive={isFiltersActive}
        hasPreview={hasPreview}
        isProcessing={isProcessing}
        processingLabel={processingLabel}
        updateFilters={updateFilters}
        resetFilters={resetFilters}
        exportWithFilters={exportWithFilters}
      />

      <VocalSeparationPanel
        selectedFile={selectedFile}
        onUseVocals={handleUseVocals}
      />
    </div>
  );
};

interface HeaderProps {
  fileName: string;
  hasPreview: boolean;
  isProcessing: boolean;
  processingLabel: string;
  isEditingVocalStem: boolean;
  onBack: () => void;
}

const Header: React.FC<HeaderProps> = ({ fileName, hasPreview, isProcessing, processingLabel, isEditingVocalStem, onBack }) => (
  <div className="flex items-center gap-3 mb-4">
    <button
      onClick={onBack}
      className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 cursor-pointer transition-colors active:scale-95"
    >
      <ArrowLeft className="w-4 h-4" />
      Back
    </button>
    <span className="text-slate-300 dark:text-slate-600 select-none">.</span>
    <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">{fileName}</span>
    {isEditingVocalStem && (
      <span className="ml-auto px-1.5 py-0.5 rounded-sm bg-fuchsia-100 dark:bg-fuchsia-950/50 text-fuchsia-600 dark:text-fuchsia-400 text-[10px] font-bold tracking-wide flex-shrink-0">
        VOCAL STEM
      </span>
    )}
    {hasPreview && !isProcessing && !isEditingVocalStem && (
      <span className="ml-auto px-1.5 py-0.5 rounded-sm bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold tracking-wide flex-shrink-0">
        RUST PREVIEW
      </span>
    )}
    {hasPreview && !isProcessing && isEditingVocalStem && (
      <span className="px-1.5 py-0.5 rounded-sm bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold tracking-wide flex-shrink-0">
        PREVIEW
      </span>
    )}
    {isProcessing && (
      <span className="ml-auto flex items-center gap-1 px-1.5 py-0.5 rounded-sm bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 text-[10px] font-bold tracking-wide flex-shrink-0">
        {processingLabel}
      </span>
    )}
  </div>
);

interface ConfirmBarProps {
  actionMode: ActionMode;
  trimStart: number;
  trimEnd: number;
  formatMs: (ms: number) => string;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

const ConfirmBar: React.FC<ConfirmBarProps> = ({ actionMode, trimStart, trimEnd, formatMs, onConfirm, onCancel }) => (
  <div className={`overflow-hidden transition-all duration-200 ease-out ${actionMode ? "max-h-16 opacity-100 mt-2" : "max-h-0 opacity-0"}`}>
    <div className={`flex items-center justify-between px-3 py-2 rounded-sm text-xs ${
      actionMode === "trim" ? "bg-emerald-50 dark:bg-emerald-950/30" : "bg-rose-50 dark:bg-rose-950/30"
    }`}>
      <span className="font-mono text-slate-600 dark:text-slate-300 tabular-nums">
        {formatMs(trimStart)}
        <span className="mx-1.5 text-slate-400">to</span>
        {formatMs(trimEnd)}
      </span>
      <div className="flex items-center gap-1.5">
        <button
          onClick={onConfirm}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-sm font-bold cursor-pointer transition-all active:scale-95 ${
            actionMode === "trim" ? "bg-emerald-600 hover:bg-emerald-500 text-white" : "bg-rose-600 hover:bg-rose-500 text-white"
          }`}
        >
          <Check className="w-3 h-3" />
          Apply
        </button>
        <button
          onClick={onCancel}
          className="flex items-center px-2 py-1 rounded-sm font-bold cursor-pointer transition-all active:scale-95 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 bg-slate-200 dark:bg-slate-700"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    </div>
  </div>
);

interface TransportControlsProps {
  isPlaying: boolean;
  actionMode: ActionMode;
  onTogglePlay: () => void;
  onSkipBackward: () => void;
  onSkipForward: () => void;
  onSetActionMode: (mode: ActionMode) => void;
}

const TransportControls: React.FC<TransportControlsProps> = ({
  isPlaying,
  actionMode,
  onTogglePlay,
  onSkipBackward,
  onSkipForward,
  onSetActionMode,
}) => (
  <div className="flex items-center gap-2 mt-3 px-1">
    <RoundButton title="Rewind 15 s" onClick={onSkipBackward}>15</RoundButton>
    <button
      onClick={onTogglePlay}
      className="w-8 h-8 flex items-center justify-center text-slate-800 hover:text-black dark:text-slate-200 dark:hover:text-white active:scale-90 transition-all cursor-pointer"
    >
      {isPlaying ? "Pause" : "Play"}
    </button>
    <RoundButton title="Skip 15 s" onClick={onSkipForward}>15</RoundButton>
    <div className="w-px h-4 bg-slate-300 dark:bg-slate-600 mx-1 flex-shrink-0" />
    <EditModeButton active={actionMode === "trim"} tone="trim" onClick={() => onSetActionMode(actionMode === "trim" ? null : "trim")}>
      Trim
    </EditModeButton>
    <EditModeButton active={actionMode === "cut"} tone="cut" onClick={() => onSetActionMode(actionMode === "cut" ? null : "cut")}>
      Cut Out
    </EditModeButton>
  </div>
);

const RoundButton: React.FC<React.PropsWithChildren<{ title: string; onClick: () => void }>> = ({ title, onClick, children }) => (
  <button
    onClick={onClick}
    title={title}
    className="w-7 h-7 flex items-center justify-center text-[10px] font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 active:scale-90 transition-all cursor-pointer bg-slate-100 dark:bg-slate-800 rounded-full"
  >
    {children}
  </button>
);

const EditModeButton: React.FC<React.PropsWithChildren<{ active: boolean; tone: "trim" | "cut"; onClick: () => void }>> = ({
  active,
  tone,
  onClick,
  children,
}) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-sm text-xs font-bold cursor-pointer transition-all duration-150 active:scale-95 ${
      active
        ? tone === "trim" ? "bg-emerald-600 text-white shadow-sm" : "bg-rose-600 text-white shadow-sm"
        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
    }`}
  >
    <Scissors className={`w-3.5 h-3.5 ${tone === "cut" ? "scale-x-[-1]" : ""}`} />
    {children}
  </button>
);

const ErrorText: React.FC<{ message: string }> = ({ message }) => {
  if (!message) return null;
  return (
    <div className="mt-2 text-xs text-red-600 dark:text-red-400 font-semibold bg-red-50 dark:bg-red-950/20 px-3 py-2 rounded-sm">
      {message}
    </div>
  );
};
