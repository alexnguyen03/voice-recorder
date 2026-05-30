import { useState } from "react";
import { useAudioRecorder } from "./hooks/useAudioRecorder";
import { AudioVisualizer } from "./components/visualizer/AudioVisualizer";
import { WaveformEditor } from "./components/editor/WaveformEditor";
import { AudioService } from "./services/audioService";
import "./App.css";

function App() {
  const {
    isRecording,
    devices,
    selectedDeviceId,
    recordedFilePath,
    loading,
    error,
    selectDevice,
    startRecording,
    stopRecording,
    clearError,
  } = useAudioRecorder();

  const [effectsEnabled, setEffectsEnabled] = useState(false);
  const [bass, setBass] = useState(0.5);
  const [treble, setTreble] = useState(0.5);
  const [statusMessage, setStatusMessage] = useState("");

  const handleToggleRecording = async () => {
    if (isRecording) {
      const path = await stopRecording();
      if (path) {
        setStatusMessage(`Đã ghi âm thành công: ${path}`);
      }
    } else {
      setStatusMessage("Đang bắt đầu ghi âm...");
      await startRecording();
      if (!error) {
        setStatusMessage("Đang ghi âm...");
      }
    }
  };

  const handleTrim = async (startMs: number, endMs: number) => {
    if (!recordedFilePath) return;
    setStatusMessage("Đang cắt file âm thanh...");
    try {
      const newPath = await AudioService.trimAudio(recordedFilePath, startMs, endMs);
      setStatusMessage(`Đã cắt file thành công tại: ${newPath}`);
    } catch (err) {
      setStatusMessage(`Lỗi cắt file: ${err}`);
    }
  };

  const handleApplyEffects = async () => {
    if (!recordedFilePath) return;
    setStatusMessage("Đang áp dụng hiệu ứng lọc nhiễu và tăng độ chi tiết...");
    try {
      const newPath = await AudioService.applyVoiceEffects(recordedFilePath, {
        enable_noise_suppression: effectsEnabled,
        bass_boost: bass,
        treble_boost: treble,
      });
      setStatusMessage(`Đã áp dụng hiệu ứng thành công tại: ${newPath}`);
    } catch (err) {
      setStatusMessage(`Lỗi áp dụng hiệu ứng: ${err}`);
    }
  };

  return (
    <main className="container" style={{ maxWidth: "800px", margin: "0 auto", padding: "40px 20px", fontFamily: "system-ui, sans-serif" }}>
      <header style={{ textAlign: "center", marginBottom: "32px" }}>
        <h1 style={{ fontSize: "28px", fontWeight: "bold", color: "#f8fafc", margin: "0 0 8px 0" }}>
          Desktop Voice Recorder
        </h1>
        <p style={{ color: "#94a3b8", margin: 0 }}>Studio Ghi âm & Khử nhiễu chuyên nghiệp chạy cục bộ</p>
      </header>

      {error && (
        <div style={{ padding: "12px 16px", backgroundColor: "#ef444420", border: "1px solid #ef4444", borderRadius: "6px", color: "#fca5a5", marginBottom: "24px", display: "flex", justifyContent: "space-between" }}>
          <span>{error}</span>
          <button onClick={clearError} style={{ background: "none", border: "none", color: "#fca5a5", cursor: "pointer" }}>Đóng</button>
        </div>
      )}

      <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", marginBottom: "24px" }}>
        {/* Cột 1: Cấu hình và Điều khiển */}
        <div style={{ backgroundColor: "#1e293b", padding: "20px", borderRadius: "12px", border: "1px solid #334155" }}>
          <h2 style={{ fontSize: "16px", color: "#f1f5f9", margin: "0 0 16px 0" }}>Cấu hình thiết bị</h2>
          
          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", fontSize: "12px", color: "#94a3b8", marginBottom: "6px" }}>
              Microphone đầu vào
            </label>
            <select
              value={selectedDeviceId}
              onChange={(e) => selectDevice(e.target.value)}
              disabled={isRecording}
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: "6px",
                backgroundColor: "#0f172a",
                border: "1px solid #475569",
                color: "#f8fafc",
                outline: "none",
              }}
            >
              {devices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleToggleRecording}
            disabled={loading}
            style={{
              width: "100%",
              padding: "12px",
              borderRadius: "8px",
              backgroundColor: isRecording ? "#ef4444" : "#3b82f6",
              color: "#fff",
              border: "none",
              fontWeight: "bold",
              cursor: "pointer",
              transition: "background-color 0.2s",
            }}
          >
            {isRecording ? "Dừng Ghi Âm" : "Bắt Đầu Ghi Âm"}
          </button>
        </div>

        {/* Cột 2: Visualizer & Trạng thái */}
        <div style={{ backgroundColor: "#1e293b", padding: "20px", borderRadius: "12px", border: "1px solid #334155", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <h2 style={{ fontSize: "16px", color: "#f1f5f9", margin: "0 0 16px 0" }}>Trực quan dạng sóng</h2>
            <AudioVisualizer isRecording={isRecording} />
          </div>
          {statusMessage && (
            <div style={{ marginTop: "12px", fontSize: "12px", color: "#38bdf8", wordBreak: "break-all" }}>
              {statusMessage}
            </div>
          )}
        </div>
      </section>

      {recordedFilePath && (
        <section style={{ backgroundColor: "#1e293b", padding: "20px", borderRadius: "12px", border: "1px solid #334155" }}>
          <h2 style={{ fontSize: "18px", color: "#f1f5f9", margin: "0 0 16px 0", borderBottom: "1px solid #334155", paddingBottom: "8px" }}>
            Xử lý & Chỉnh sửa tệp
          </h2>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: "24px" }}>
            {/* Lọc tiếng ồn & EQ */}
            <div>
              <h3 style={{ fontSize: "14px", color: "#94a3b8", margin: "0 0 12px 0" }}>Bộ lọc chi tiết giọng nói</h3>
              
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
                <input
                  type="checkbox"
                  id="noise-cancellation"
                  checked={effectsEnabled}
                  onChange={(e) => setEffectsEnabled(e.target.checked)}
                />
                <label htmlFor="noise-cancellation" style={{ color: "#f1f5f9", fontSize: "14px", cursor: "pointer" }}>
                  Bật Khử Nhiễu (RNNoise)
                </label>
              </div>

              <div style={{ marginBottom: "12px" }}>
                <label style={{ display: "block", fontSize: "12px", color: "#94a3b8", marginBottom: "4px" }}>
                  Tăng Bass (Độ trầm): {Math.round(bass * 100)}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={bass}
                  onChange={(e) => setBass(Number(e.target.value))}
                  style={{ width: "100%" }}
                />
              </div>

              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontSize: "12px", color: "#94a3b8", marginBottom: "4px" }}>
                  Tăng Treble (Độ chi tiết): {Math.round(treble * 100)}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={treble}
                  onChange={(e) => setTreble(Number(e.target.value))}
                  style={{ width: "100%" }}
                />
              </div>

              <button
                onClick={handleApplyEffects}
                style={{
                  width: "100%",
                  padding: "10px",
                  borderRadius: "6px",
                  backgroundColor: "#a855f7",
                  color: "#fff",
                  border: "none",
                  fontWeight: "bold",
                  cursor: "pointer",
                }}
              >
                Áp dụng bộ lọc giọng
              </button>
            </div>

            {/* Trình Trim biên tập */}
            <div>
              <h3 style={{ fontSize: "14px", color: "#94a3b8", margin: "0 0 12px 0" }}>Cắt ghép âm thanh</h3>
              <WaveformEditor filePath={recordedFilePath} onTrim={handleTrim} />
            </div>
          </div>
        </section>
      )}
    </main>
  );
}

export default App;

