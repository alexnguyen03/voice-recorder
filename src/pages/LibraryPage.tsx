import React, { useEffect } from "react";

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
  // Always refresh recordings list when library is mounted
  useEffect(() => {
    refreshFiles();
  }, [refreshFiles]);

  return (
    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-lg transition-colors duration-300 w-full animate-fade-in">
      <h2 className="text-lg font-bold text-slate-850 dark:text-slate-200 mb-4 pb-2 border-b border-slate-200 dark:border-slate-700 text-left">
        Recorded Library
      </h2>

      {filesList.length === 0 ? (
        <div className="text-center py-10 text-slate-500 text-sm">
          📁 No recordings found. Go to the Record tab to capture your first voice file.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filesList.map((file) => (
            <div
              key={file}
              onClick={() => onSelectFile(file)}
              className="flex items-center justify-between p-3.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-900/50 dark:hover:bg-slate-900 border border-slate-200 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700 rounded-xl cursor-pointer transition-all duration-200 group"
            >
              <div className="flex items-center gap-3 overflow-hidden pr-4">
                <span className="text-lg">🎵</span>
                <div className="text-left overflow-hidden">
                  <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400">
                    {getFileName(file)}
                  </div>
                  <div className="text-[10px] text-slate-500 truncate max-w-xs md:max-w-md mt-0.5">
                    {file}
                  </div>
                </div>
              </div>
              <button className="text-slate-550 group-hover:text-blue-600 dark:text-slate-400 dark:group-hover:text-blue-400 text-sm font-bold flex items-center gap-1 cursor-pointer">
                Edit & Play <span className="text-xs">➡️</span>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
