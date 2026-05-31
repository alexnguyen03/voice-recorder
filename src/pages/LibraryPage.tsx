import React, { useEffect, useState, useMemo, useCallback } from "react";
import {
  FolderOpen, Music, Trash2, AlertTriangle, Search, X,
  CheckSquare, Square, CheckCheck,
} from "lucide-react";
import { AudioService } from "../services/audioService";

interface LibraryPageProps {
  filesList: string[];
  onSelectFile: (file: string) => void;
  getFileName: (path: string) => string;
  refreshFiles: () => void;
}

export const LibraryPage: React.FC<LibraryPageProps> = ({
  filesList,
  onSelectFile,
  getFileName,
  refreshFiles,
}) => {
  const [query,         setQuery]         = useState("");
  const [selectMode,    setSelectMode]    = useState(false);
  const [selected,      setSelected]      = useState<Set<string>>(new Set());
  const [pendingDelete, setPendingDelete] = useState<string[] | null>(null); // null = closed
  const [deleting,      setDeleting]      = useState(false);
  const [deleteError,   setDeleteError]   = useState<string | null>(null);

  useEffect(() => { refreshFiles(); }, [refreshFiles]);

  // Exit select mode when list changes or mode toggled off
  useEffect(() => {
    if (!selectMode) setSelected(new Set());
  }, [selectMode]);

  // Filtered list based on search query
  const filtered = useMemo(() =>
    filesList.filter(f =>
      getFileName(f).toLowerCase().includes(query.toLowerCase())
    ),
    [filesList, query, getFileName]
  );

  const allSelected   = filtered.length > 0 && filtered.every(f => selected.has(f));
  const selectedCount = [...selected].filter(f => filtered.includes(f)).length;

  const toggleSelect = useCallback((file: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelected(prev => {
      const next = new Set(prev);
      next.has(file) ? next.delete(file) : next.add(file);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelected(prev => {
      if (allSelected) return new Set();
      return new Set([...prev, ...filtered]);
    });
  }, [allSelected, filtered]);

  // Open single-file delete modal
  const promptDeleteSingle = (e: React.MouseEvent, file: string) => {
    e.stopPropagation();
    setDeleteError(null);
    setPendingDelete([file]);
  };

  // Open bulk delete modal
  const promptDeleteSelected = () => {
    setDeleteError(null);
    const toDelete = filtered.filter(f => selected.has(f));
    if (toDelete.length === 0) return;
    setPendingDelete(toDelete);
  };

  const cancelDelete = () => {
    setPendingDelete(null);
    setDeleteError(null);
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    setDeleteError(null);
    const errors: string[] = [];
    for (const file of pendingDelete) {
      try { await AudioService.deleteRecording(file); }
      catch (err) { errors.push(getFileName(file) + ": " + String(err)); }
    }
    setDeleting(false);
    if (errors.length > 0) {
      setDeleteError(errors.join("\n"));
      return;
    }
    setPendingDelete(null);
    setSelected(new Set());
    if (pendingDelete.length === filesList.length) setSelectMode(false);
    refreshFiles();
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-sm shadow-sm
      transition-colors duration-300 w-full animate-fade-in text-left">

      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="px-6 pt-6 pb-3">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">
            Recorded Library
            {filesList.length > 0 && (
              <span className="ml-2 text-sm font-normal text-slate-400">
                ({filesList.length})
              </span>
            )}
          </h2>

          {filesList.length > 0 && (
            <button
              onClick={() => setSelectMode(s => !s)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold
                cursor-pointer transition-all duration-200 active:scale-95
                ${selectMode
                  ? "bg-violet-600 text-white hover:bg-violet-500"
                  : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
                }`}
            >
              <CheckSquare className="w-3.5 h-3.5" />
              {selectMode ? "Done" : "Select"}
            </button>
          )}
        </div>

        {/* Search bar */}
        {filesList.length > 0 && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5
              text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search recordings…"
              className="w-full pl-9 pr-8 py-2 rounded-lg text-sm
                bg-slate-100 dark:bg-slate-900/60 text-slate-800 dark:text-slate-200
                placeholder-slate-400 dark:placeholder-slate-500
                border border-transparent focus:border-violet-400/50 dark:focus:border-violet-500/50
                outline-none transition-all duration-150"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md
                  text-slate-400 hover:text-slate-700 dark:hover:text-slate-200
                  cursor-pointer transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Select-mode toolbar ─────────────────────────────────────── */}
      {selectMode && filtered.length > 0 && (
        <div className="px-6 py-2 flex items-center gap-3
          border-b border-slate-100 dark:border-slate-700/60">
          {/* Select all checkbox */}
          <button
            onClick={toggleAll}
            className="flex items-center gap-1.5 text-xs font-semibold
              text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100
              cursor-pointer transition-colors"
          >
            {allSelected
              ? <CheckCheck className="w-4 h-4 text-violet-500" />
              : <Square    className="w-4 h-4" />
            }
            {allSelected ? "Deselect all" : "Select all"}
          </button>

          {selectedCount > 0 && (
            <span className="ml-auto text-xs text-slate-500">
              {selectedCount} selected
            </span>
          )}
        </div>
      )}

      {/* ── List ────────────────────────────────────────────────────── */}
      <div className="px-6 py-3">
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
                <span>No recordings match "<strong>{query}</strong>"</span>
              </>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {filtered.map((file) => {
              const isSelected = selected.has(file);
              return (
                <div
                  key={file}
                  onClick={selectMode
                    ? (e) => toggleSelect(file, e)
                    : () => onSelectFile(file)
                  }
                  className={`flex items-center justify-between p-3.5 rounded-lg cursor-pointer
                    transition-all duration-150 group
                    ${isSelected && selectMode
                      ? "bg-violet-50 dark:bg-violet-950/30 ring-1 ring-violet-400/40"
                      : "bg-slate-50 hover:bg-slate-100 dark:bg-slate-900/50 dark:hover:bg-slate-900"
                    }`}
                >
                  <div className="flex items-center gap-3 overflow-hidden flex-1 min-w-0">
                    {/* Checkbox in select mode */}
                    {selectMode ? (
                      <div className={`w-5 h-5 rounded-md flex-shrink-0 flex items-center
                        justify-center border-2 transition-all duration-150
                        ${isSelected
                          ? "bg-violet-600 border-violet-600"
                          : "border-slate-300 dark:border-slate-600"
                        }`}
                      >
                        {isSelected && (
                          <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2"
                              strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>
                    ) : (
                      <Music className="w-5 h-5 flex-shrink-0 text-slate-400
                        dark:text-slate-500 group-hover:text-blue-500
                        dark:group-hover:text-blue-400" />
                    )}

                    <div className="text-left overflow-hidden min-w-0">
                      <div className={`text-sm font-semibold truncate transition-colors
                        ${isSelected && selectMode
                          ? "text-violet-700 dark:text-violet-300"
                          : "text-slate-800 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400"
                        }`}
                      >
                        {getFileName(file)}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate mt-0.5">
                        {file}
                      </div>
                    </div>
                  </div>

                  {/* Single-delete button (hidden in select mode) */}
                  {!selectMode && (
                    <button
                      onClick={(e) => promptDeleteSingle(e, file)}
                      title="Delete recording"
                      className="flex-shrink-0 p-2 rounded-md ml-2 text-slate-400
                        opacity-0 group-hover:opacity-100
                        hover:text-rose-500 hover:bg-rose-50
                        dark:hover:text-rose-400 dark:hover:bg-rose-950/30
                        transition-all duration-150 cursor-pointer active:scale-90"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Bulk-delete action bar (sticky bottom) ──────────────────── */}
      {selectMode && selectedCount > 0 && (
        <div className="sticky bottom-0 px-6 py-3
          bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm
          border-t border-slate-200 dark:border-slate-700
          flex items-center justify-between gap-3 rounded-b-sm">
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
            {selectedCount} file{selectedCount > 1 ? "s" : ""} selected
          </span>
          <button
            onClick={promptDeleteSelected}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg
              text-xs font-bold cursor-pointer transition-all active:scale-95
              bg-rose-600 hover:bg-rose-500 text-white shadow-sm"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete {selectedCount > 1 ? `${selectedCount} files` : "file"}
          </button>
        </div>
      )}

      {/* ── Delete confirmation modal ────────────────────────────────── */}
      {pendingDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center
            bg-black/40 backdrop-blur-sm animate-fade-in"
          onClick={cancelDelete}
        >
          <div
            className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl p-6 mx-4
              max-w-sm w-full border border-slate-200 dark:border-slate-700"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-950/40
                flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-500" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                  {pendingDelete.length > 1
                    ? `Delete ${pendingDelete.length} recordings?`
                    : "Delete recording?"
                  }
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Also removes preview & stem files. Cannot be undone.
                </p>
              </div>
            </div>

            {/* File list preview (max 5) */}
            <div className="my-3 rounded-lg bg-slate-100 dark:bg-slate-900/60
              text-xs text-slate-600 dark:text-slate-300 font-mono
              max-h-32 overflow-y-auto divide-y divide-slate-200 dark:divide-slate-700/60">
              {pendingDelete.slice(0, 8).map(f => (
                <div key={f} className="px-3 py-1.5 truncate">{getFileName(f)}</div>
              ))}
              {pendingDelete.length > 8 && (
                <div className="px-3 py-1.5 text-slate-400 italic">
                  …and {pendingDelete.length - 8} more
                </div>
              )}
            </div>

            {deleteError && (
              <p className="text-xs text-rose-500 mb-2 whitespace-pre-wrap">{deleteError}</p>
            )}

            <div className="flex gap-2 mt-4">
              <button
                onClick={cancelDelete}
                disabled={deleting}
                className="flex-1 py-2 rounded-lg text-sm font-semibold cursor-pointer
                  bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200
                  hover:bg-slate-200 dark:hover:bg-slate-600 transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="flex-1 py-2 rounded-lg text-sm font-bold cursor-pointer
                  bg-rose-600 hover:bg-rose-500 text-white transition-all active:scale-95
                  disabled:opacity-60 disabled:cursor-not-allowed
                  flex items-center justify-center gap-1.5"
              >
                {deleting
                  ? <span className="w-3.5 h-3.5 border-2 border-white/30
                      border-t-white rounded-full animate-spin inline-block" />
                  : <Trash2 className="w-3.5 h-3.5" />
                }
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
