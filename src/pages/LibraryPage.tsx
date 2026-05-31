import React, { useEffect, useState } from "react";
import { FolderOpen, Music, Trash2, AlertTriangle } from "lucide-react";
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
  // Which file is pending delete confirmation (null = none)
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Always refresh recordings list when library is mounted
  useEffect(() => {
    refreshFiles();
  }, [refreshFiles]);

  const handleDeleteClick = (e: React.MouseEvent, file: string) => {
    e.stopPropagation(); // prevent row click → open file
    setErrorMsg(null);
    setPendingDelete(file);
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await AudioService.deleteRecording(pendingDelete);
      setPendingDelete(null);
      refreshFiles(); // reload list
    } catch (err) {
      setErrorMsg(String(err));
    } finally {
      setDeleting(false);
    }
  };

  const cancelDelete = () => {
    setPendingDelete(null);
    setErrorMsg(null);
  };

  return (
    <div className="bg-white dark:bg-slate-800 p-6 rounded-sm shadow-sm transition-colors duration-300 w-full animate-fade-in text-left">
      <h2 className="text-lg font-bold text-slate-850 dark:text-slate-200 mb-6 text-left">
        Recorded Library
      </h2>

      {filesList.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-slate-450 dark:text-slate-550 text-sm">
          <FolderOpen className="w-12 h-12 mb-3 text-slate-350 dark:text-slate-600" />
          <span>No recordings found. Go to the Record tab to capture your first voice file.</span>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filesList.map((file) => (
            <div
              key={file}
              onClick={() => onSelectFile(file)}
              className="flex items-center justify-between p-3.5 bg-slate-50 hover:bg-slate-100
                dark:bg-slate-900/50 dark:hover:bg-slate-900 rounded-sm cursor-pointer
                transition-all duration-200 group"
            >
              <div className="flex items-center gap-3 overflow-hidden pr-4">
                <Music className="w-5 h-5 text-slate-400 dark:text-slate-500
                  group-hover:text-blue-500 dark:group-hover:text-blue-400 flex-shrink-0" />
                <div className="text-left overflow-hidden">
                  <div className="text-sm font-semibold text-slate-800 dark:text-slate-200
                    truncate group-hover:text-blue-600 dark:group-hover:text-blue-400">
                    {getFileName(file)}
                  </div>
                  <div className="text-[10px] text-slate-500 truncate max-w-xs md:max-w-md mt-0.5">
                    {file}
                  </div>
                </div>
              </div>

              {/* Delete button — visible on hover */}
              <button
                onClick={(e) => handleDeleteClick(e, file)}
                title="Delete recording"
                className="flex-shrink-0 p-2 rounded-md text-slate-400
                  opacity-0 group-hover:opacity-100 hover:text-rose-500 hover:bg-rose-50
                  dark:hover:text-rose-400 dark:hover:bg-rose-950/30
                  transition-all duration-150 cursor-pointer active:scale-90"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Delete confirmation overlay ─────────────────────────────── */}
      {pendingDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center
            bg-black/40 backdrop-blur-sm animate-fade-in"
          onClick={cancelDelete}
        >
          <div
            className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl p-6 mx-4 max-w-sm w-full
              border border-slate-200 dark:border-slate-700 animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Icon + title */}
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-950/40
                flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-500" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                  Delete Recording?
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  This will also remove preview & stem files.
                </p>
              </div>
            </div>

            {/* File name */}
            <div className="my-3 px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-900/60
              text-xs text-slate-600 dark:text-slate-300 font-mono truncate">
              {getFileName(pendingDelete)}
            </div>

            {/* Error */}
            {errorMsg && (
              <p className="text-xs text-rose-500 mb-2">{errorMsg}</p>
            )}

            {/* Buttons */}
            <div className="flex gap-2 mt-4">
              <button
                onClick={cancelDelete}
                disabled={deleting}
                className="flex-1 py-2 rounded-lg text-sm font-semibold cursor-pointer
                  bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200
                  hover:bg-slate-200 dark:hover:bg-slate-600 transition-all
                  disabled:opacity-50"
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
                {deleting ? (
                  <span className="inline-block w-3.5 h-3.5 border-2 border-white/30
                    border-t-white rounded-full animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
