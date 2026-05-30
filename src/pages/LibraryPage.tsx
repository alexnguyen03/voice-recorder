import React, { useEffect } from "react";
import { FolderOpen, Music } from "lucide-react";

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
              className="flex items-center justify-between p-3.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-900/50 dark:hover:bg-slate-900 rounded-sm cursor-pointer transition-all duration-200 group"
            >
              <div className="flex items-center gap-3 overflow-hidden pr-4">
                <Music className="w-5 h-5 text-slate-400 dark:text-slate-500 group-hover:text-blue-500 dark:group-hover:text-blue-400 flex-shrink-0" />
                <div className="text-left overflow-hidden">
                  <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400">
                    {getFileName(file)}
                  </div>
                  <div className="text-[10px] text-slate-500 truncate max-w-xs md:max-w-md mt-0.5">
                    {file}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
