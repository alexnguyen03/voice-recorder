import React, { useEffect, useState, useMemo, useCallback } from "react";
import { FolderOpen, Music, Search, X, Trash2, Clock, Calendar } from "lucide-react";
import { AudioService, RecordingInfo } from "../services/audioService";

interface LibraryPageProps {
  filesList: string[];
  onSelectFile: (file: string) => void;
  getFileName: (path: string) => string;
  refreshFiles: () => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(secs: number): string {
  if (!secs || secs <= 0) return "--:--";
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatDate(epochSecs: number): string {
  if (!epochSecs) return "";
  const d = new Date(epochSecs * 1000);
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

// ── Component ─────────────────────────────────────────────────────────────────

export const LibraryPage: React.FC<LibraryPageProps> = ({
  filesList,
  onSelectFile,
  getFileName,
  refreshFiles,
}) => {
  const [query,       setQuery]       = useState("");
  const [selected,    setSelected]    = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting,    setDeleting]    = useState(false);
  // Map<path, RecordingInfo>
  const [meta, setMeta] = useState<Map<string, RecordingInfo>>(new Map());

  useEffect(() => { refreshFiles(); }, [refreshFiles]);

  // Load metadata whenever filesList changes
  useEffect(() => {
    if (filesList.length === 0) { setMeta(new Map()); return; }
    AudioService.getRecordingsInfo(filesList).then(infos => {
      setMeta(new Map(infos.map(i => [i.path, i])));
    });
  }, [filesList]);

  const filtered = useMemo(() =>
    filesList.filter(f => getFileName(f).toLowerCase().includes(query.toLowerCase())),
    [filesList, query, getFileName]
  );

  const allSelected   = filtered.length > 0 && filtered.every(f => selected.has(f));
  const someSelected  = filtered.some(f => selected.has(f));
  const selectedCount = [...selected].filter(f => filtered.includes(f)).length;

  const toggleMaster = useCallback(() => {
    setSelected(prev => {
      const next = new Set(prev);
      allSelected ? filtered.forEach(f => next.delete(f)) : filtered.forEach(f => next.add(f));
      return next;
    });
    setConfirmOpen(false);
  }, [allSelected, filtered]);

  const toggleRow = useCallback((file: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(file) ? next.delete(file) : next.add(file);
      return next;
    });
    setConfirmOpen(false);
  }, []);

  const handleRowClick = (file: string) => {
    if (someSelected || allSelected) toggleRow(file);
    else onSelectFile(file);
  };

  const handleConfirmDelete = async () => {
    setDeleting(true);
    const toDelete = filtered.filter(f => selected.has(f));
    for (const file of toDelete) {
      try { await AudioService.deleteRecording(file); } catch (_) {}
    }
    setDeleting(false);
    setConfirmOpen(false);
    setSelected(new Set());
    refreshFiles();
  };

  const isSelectMode = someSelected || allSelected;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-sm shadow-sm
      transition-colors duration-300 w-full animate-fade-in text-left">

      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="px-6 pt-6 pb-4">
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-4">
          Recorded Library
          {filesList.length > 0 && (
            <span className="ml-2 text-sm font-normal text-slate-400">({filesList.length})</span>
          )}
        </h2>

        {filesList.length > 0 && (
          <div className="flex items-center gap-2">
            {/* Master checkbox */}
            <button
              onClick={toggleMaster}
              title={allSelected ? "Deselect all" : "Select all"}
              className="flex-shrink-0 cursor-pointer active:scale-90 transition-transform"
            >
              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center
                transition-all duration-150
                ${allSelected
                  ? "bg-violet-600 border-violet-600"
                  : someSelected
                    ? "bg-violet-200 border-violet-400 dark:bg-violet-900/40 dark:border-violet-500"
                    : "border-slate-300 dark:border-slate-600 hover:border-violet-400"
                }`}>
                {allSelected && (
                  <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2.2"
                      strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
                {someSelected && !allSelected && (
                  <div className="w-2 h-0.5 bg-violet-500 rounded-full" />
                )}
              </div>
            </button>

            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5
                text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={query}
                onChange={e => { setQuery(e.target.value); setConfirmOpen(false); }}
                placeholder="Search recordings…"
                className="w-full pl-9 pr-8 py-2 rounded-lg text-sm
                  bg-slate-100 dark:bg-slate-900/60
                  text-slate-800 dark:text-slate-200
                  placeholder-slate-400 dark:placeholder-slate-500
                  border border-transparent focus:border-violet-400/50 outline-none
                  transition-all duration-150"
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded
                    text-slate-400 hover:text-slate-700 dark:hover:text-slate-200
                    cursor-pointer transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── List ────────────────────────────────────────────────────── */}
      <div className="px-6 pb-4">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12
            text-slate-400 dark:text-slate-500 text-sm">
            {filesList.length === 0 ? (
              <>
                <FolderOpen className="w-12 h-12 mb-3 text-slate-300 dark:text-slate-600" />
                <span>No recordings found. Go to the Record tab.</span>
              </>
            ) : (
              <>
                <Search className="w-8 h-8 mb-3 text-slate-300 dark:text-slate-600" />
                <span>No results for "<strong>{query}</strong>"</span>
              </>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {filtered.map(file => {
              const isChecked = selected.has(file);
              const info = meta.get(file);
              return (
                <div
                  key={file}
                  onClick={() => handleRowClick(file)}
                  className={`flex items-center gap-3 px-3.5 py-3 rounded-lg cursor-pointer
                    transition-all duration-150 group
                    ${isChecked
                      ? "bg-violet-50 dark:bg-violet-950/30 ring-1 ring-violet-400/30"
                      : "bg-slate-50 hover:bg-slate-100 dark:bg-slate-900/50 dark:hover:bg-slate-900"
                    }`}
                >
                  {/* Checkbox */}
                  <div
                    onClick={e => { e.stopPropagation(); toggleRow(file); }}
                    className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center
                      justify-center transition-all duration-150 cursor-pointer
                      ${isChecked
                        ? "bg-violet-600 border-violet-600"
                        : "border-slate-300 dark:border-slate-600 group-hover:border-violet-400"
                      }`}
                  >
                    {isChecked && (
                      <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2.2"
                          strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>

                  {/* Icon */}
                  <Music className={`w-4 h-4 flex-shrink-0 transition-colors
                    ${isChecked ? "text-violet-400" : "text-slate-400 dark:text-slate-500"}`} />

                  {/* File info */}
                  <div className="overflow-hidden min-w-0 flex-1">
                    <div className={`text-sm font-semibold truncate transition-colors
                      ${isChecked
                        ? "text-violet-700 dark:text-violet-300"
                        : "text-slate-800 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400"
                      }`}>
                      {getFileName(file)}
                    </div>

                    {/* Duration + Date row */}
                    <div className="flex items-center gap-3 mt-0.5">
                      {info ? (
                        <>
                          <span className="flex items-center gap-1 text-[11px] text-slate-400">
                            <Clock className="w-3 h-3 flex-shrink-0" />
                            {formatDuration(info.duration_secs)}
                          </span>
                          <span className="flex items-center gap-1 text-[11px] text-slate-400">
                            <Calendar className="w-3 h-3 flex-shrink-0" />
                            {formatDate(info.created_at_secs)}
                          </span>
                        </>
                      ) : (
                        <span className="text-[10px] text-slate-400 truncate">{file}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Sticky action bar ───────────────────────────────────────── */}
      <div className={`overflow-hidden transition-all duration-300 ease-out
        ${isSelectMode ? "max-h-20 opacity-100" : "max-h-0 opacity-0"}`}>
        <div className="px-6 py-3 border-t border-slate-100 dark:border-slate-700
          flex items-center justify-between gap-3
          bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm rounded-b-sm">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex-shrink-0">
            {selectedCount} file{selectedCount !== 1 ? "s" : ""} selected
          </span>

          {/* Inline confirm pill */}
          <div className={`flex items-center overflow-hidden transition-all duration-300 ease-out
            rounded-full h-10
            ${confirmOpen
              ? "w-56 bg-slate-100 dark:bg-slate-900/90 px-2"
              : "w-36 bg-rose-600 hover:bg-rose-500 px-0"
            }`}>
            {confirmOpen ? (
              <div className="flex items-center justify-between w-full">
                <button
                  onClick={() => setConfirmOpen(false)}
                  className="w-8 h-8 rounded-full bg-slate-200 hover:bg-slate-300
                    dark:bg-slate-700 dark:hover:bg-slate-600
                    flex items-center justify-center cursor-pointer active:scale-95 transition-all"
                >
                  <X className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                </button>
                <span className="text-xs font-bold text-rose-600 dark:text-rose-400
                  uppercase tracking-widest select-none text-center flex-1 px-1">
                  Delete?
                </span>
                <button
                  onClick={handleConfirmDelete}
                  disabled={deleting}
                  className="w-8 h-8 rounded-full bg-rose-600 hover:bg-rose-500
                    flex items-center justify-center cursor-pointer active:scale-95
                    transition-all disabled:opacity-60"
                >
                  {deleting
                    ? <span className="w-3.5 h-3.5 border-2 border-white/30
                        border-t-white rounded-full animate-spin" />
                    : <svg className="w-4 h-4 text-white fill-none stroke-current"
                        viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                  }
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmOpen(true)}
                className="w-full h-full flex items-center justify-center gap-1.5
                  text-white text-xs font-bold cursor-pointer px-4"
              >
                <Trash2 className="w-3.5 h-3.5 flex-shrink-0" />
                Delete {selectedCount > 1 ? `${selectedCount} files` : "file"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
