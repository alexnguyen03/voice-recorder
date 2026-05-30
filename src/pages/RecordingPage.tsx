import React from "react";
import { AudioVisualizer } from "../components/visualizer/AudioVisualizer";

interface RecordingPageProps {
  isRecording: boolean;
  isPaused: boolean;
  showDiscardConfirm: boolean;
  setShowDiscardConfirm: (show: boolean) => void;
  handleToggleRecording: () => Promise<void>;
  handleDiscardRecording: () => Promise<void>;
  executeDiscard: () => Promise<void>;
  resumeRecording: () => Promise<void>;
  pauseRecording: () => Promise<void>;
  statusMessage: string;
}

export const RecordingPage: React.FC<RecordingPageProps> = ({
  isRecording,
  isPaused,
  showDiscardConfirm,
  setShowDiscardConfirm,
  handleToggleRecording,
  handleDiscardRecording,
  executeDiscard,
  resumeRecording,
  pauseRecording,
  statusMessage,
}) => {
  return (
    <section className="flex flex-col items-center bg-slate-100 dark:bg-slate-800 shadow-sm rounded-sm max-w-lg mx-auto w-full transition-colors duration-300 animate-fade-in">
      {/* Waveform Visualizer shown always */}
      <div className="w-full mb-8">
        <AudioVisualizer isRecording={isRecording} isPaused={isPaused} />
      </div>

      <div className="pb-4">
        {isRecording || isPaused ? (
          <div className="flex items-center justify-center h-24 w-full transition-all duration-500">
            <div className={`flex items-center justify-center transition-all duration-500 ${showDiscardConfirm ? "gap-0" : "gap-6"}`}>
              {/* Discard Action Selector */}
              <div
                className={`h-24 rounded-full flex items-center overflow-hidden transition-all duration-500 ease-out ${
                  showDiscardConfirm
                    ? "w-64 bg-slate-100 dark:bg-slate-900/90 p-2 px-3.5 border-0"
                    : "w-24 border-[10px] border-slate-200 dark:border-white bg-rose-600 hover:bg-rose-500 dark:bg-rose-900 dark:hover:bg-rose-800 p-0"
                }`}
              >
                {showDiscardConfirm ? (
                  <div className="flex items-center justify-between w-full transition-all duration-300">
                    {/* Keep Recording / Cancel Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowDiscardConfirm(false);
                      }}
                      className="w-14 h-14 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 flex items-center justify-center cursor-pointer   active:scale-95 transition-all duration-200 flex-shrink-0"
                      title="Keep recording"
                    >
                      <svg className="w-5 h-5 fill-none stroke-current" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                    {/* Discard Title text inside the pill */}
                    <span className="text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-widest text-center select-none px-2 whitespace-nowrap">
                      Discard?
                    </span>
                    {/* Discard / Confirm Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        executeDiscard();
                      }}
                      className="w-14 h-14 rounded-full bg-rose-600 hover:bg-rose-500 flex items-center justify-center cursor-pointer   active:scale-95 transition-all duration-200 text-white flex-shrink-0"
                      title="Confirm discard"
                    >
                      <svg className="w-5 h-5 fill-none stroke-current" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleDiscardRecording}
                    className="w-full h-full flex items-center justify-center cursor-pointer text-rose-100 focus:outline-none"
                    title="Discard recording"
                  >
                    {/* Trash icon */}
                    <svg className="w-6 h-6 fill-none stroke-current" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18" />
                      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                      <line x1="10" y1="11" x2="10" y2="17" />
                      <line x1="14" y1="11" x2="14" y2="17" />
                    </svg>
                  </button>
                )}
              </div>
              {/* Pause / Resume Button */}
              <div
                className={`transition-all duration-500 ease-out overflow-hidden flex items-center justify-center ${
                  showDiscardConfirm ? "w-0 opacity-0 pointer-events-none" : "w-24 opacity-100"
                }`}
              >
                <button
                  onClick={isPaused ? resumeRecording : pauseRecording}
                  className={`w-24 h-24 rounded-full border-[10px] border-slate-200 dark:border-white flex items-center justify-center cursor-pointer shadow-lg active:scale-95 transition-all duration-300 ${
                    isPaused
                      ? "bg-emerald-600 hover:bg-emerald-500"
                      : "bg-amber-600 hover:bg-amber-500"
                  }`}
                  title={isPaused ? "Resume recording" : "Pause recording"}
                >
                  {isPaused ? (
                    // Resume play triangle icon
                    <svg className="w-6 h-6 fill-current text-white pl-1" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  ) : (
                    // Pause double bars icon
                    <svg className="w-6 h-6 fill-current text-white" viewBox="0 0 24 24">
                      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                    </svg>
                  )}
                </button>
              </div>
              {/* Stop Button */}
              <div
                className={`transition-all duration-500 ease-out overflow-hidden flex items-center justify-center ${
                  showDiscardConfirm ? "w-0 opacity-0 pointer-events-none" : "w-24 opacity-100"
                }`}
              >
                <button
                  onClick={handleToggleRecording}
                  className="w-24 h-24 rounded-full border-[10px] border-slate-200 dark:border-white bg-red-600 hover:bg-red-500 flex items-center justify-center cursor-pointer shadow-lg active:scale-95 transition-all duration-300"
                  title="Stop and save recording"
                >
                  {/* Stop white square icon */}
                  <div className="w-6 h-6 bg-white rounded-md" />
                </button>
              </div>
            </div>
          </div>
        ) : (
          <button
            onClick={handleToggleRecording}
            className="w-24 h-24 rounded-full border-[10px] border-slate-200 dark:border-white bg-red-600 hover:bg-red-500 active:scale-95 hover:scale-105 transition-all duration-300 cursor-pointer shadow-xl flex items-center justify-center"
            title="Start recording"
          />
        )}
      </div>

      {statusMessage && statusMessage.toLowerCase().includes("error") && (
        <div className="mt-6 text-xs text-red-700 dark:text-red-300 font-semibold text-center break-all bg-red-100 dark:bg-red-955/20 p-2.5 px-4 rounded-xl w-full">
          {statusMessage}
        </div>
      )}
    </section>
  );
};
