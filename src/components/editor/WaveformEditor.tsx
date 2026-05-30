import React, { useState } from "react";

interface WaveformEditorProps {
  filePath: string;
  onTrim: (startMs: number, endMs: number) => void;
}

/**
 * Component trình chỉnh sửa dạng sóng âm thanh (Waveform Editor) giả lập.
 */
export const WaveformEditor: React.FC<WaveformEditorProps> = ({ filePath, onTrim }) => {
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(5000); // 5 seconds default

  const handleTrimClick = () => {
    onTrim(start, end);
  };

  return (
    <div style={{ padding: "16px", backgroundColor: "#1e293b", borderRadius: "8px", color: "#f8fafc" }}>
      <h3 style={{ margin: "0 0 8px 0", fontSize: "14px", color: "#94a3b8" }}>Editing: {filePath}</h3>
      <div style={{ display: "flex", gap: "16px", marginBottom: "16px" }}>
        <div>
          <label style={{ display: "block", fontSize: "12px", marginBottom: "4px" }}>Start (ms)</label>
          <input
            type="number"
            value={start}
            onChange={(e) => setStart(Number(e.target.value))}
            style={{ padding: "6px", borderRadius: "4px", border: "1px solid #475569", backgroundColor: "#0f172a", color: "#fff" }}
          />
        </div>
        <div>
          <label style={{ display: "block", fontSize: "12px", marginBottom: "4px" }}>End (ms)</label>
          <input
            type="number"
            value={end}
            onChange={(e) => setEnd(Number(e.target.value))}
            style={{ padding: "6px", borderRadius: "4px", border: "1px solid #475569", backgroundColor: "#0f172a", color: "#fff" }}
          />
        </div>
      </div>
      <button
        onClick={handleTrimClick}
        style={{
          padding: "8px 16px",
          backgroundColor: "#22c55e",
          border: "none",
          borderRadius: "4px",
          color: "#fff",
          cursor: "pointer",
          fontWeight: "bold",
        }}
      >
        Trim Selected Area
      </button>
    </div>
  );
};
