import React, { useState } from "react";

interface WaveformEditorProps {
  filePath: string;
  onTrim: (startMs: number, endMs: number) => void;
}

/**
 * Presentational component for visual waveform trimming & editing.
 */
export const WaveformEditor: React.FC<WaveformEditorProps> = ({ filePath, onTrim }) => {
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(5000); // 5 seconds default

  const handleTrimClick = () => {
    onTrim(start, end);
  };

  return (
    <div className="p-4 bg-slate-800 rounded-lg text-slate-50 border border-slate-700 shadow-md">
      <h3 className="m-0 mb-2 text-xs text-slate-400 font-medium truncate" title={filePath}>
        Editing: {filePath}
      </h3>
      <div className="flex gap-4 mb-4">
        <div className="flex-1">
          <label className="block text-xs text-slate-400 mb-1 font-semibold">Start (ms)</label>
          <input
            type="number"
            value={start}
            onChange={(e) => setStart(Number(e.target.value))}
            className="w-full p-2 rounded bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-blue-500 text-sm"
          />
        </div>
        <div className="flex-1">
          <label className="block text-xs text-slate-400 mb-1 font-semibold">End (ms)</label>
          <input
            type="number"
            value={end}
            onChange={(e) => setEnd(Number(e.target.value))}
            className="w-full p-2 rounded bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-blue-500 text-sm"
          />
        </div>
      </div>
      <button
        onClick={handleTrimClick}
        className="w-full py-2 px-4 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 transition-colors rounded text-white font-bold cursor-pointer text-sm shadow-sm"
      >
        Trim Selected Area
      </button>
    </div>
  );
};
