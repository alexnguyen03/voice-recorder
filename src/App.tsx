import { useState } from "react";
import { useAudioRecorder } from "./hooks/useAudioRecorder";
import { AudioVisualizer } from "./components/visualizer/AudioVisualizer";
import { WaveformEditor } from "./components/editor/WaveformEditor";
import { AudioService } from "./services/audioService";
import { convertFileSrc } from "@tauri-apps/api/core";
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

  const isTauri = typeof window !== "undefined" && (window as any).__TAURI_INTERNALS__ !== undefined;

  const audioUrl = recordedFilePath
    ? isTauri
      ? convertFileSrc(recordedFilePath)
      : "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3"
    : "";

  const handleToggleRecording = async () => {
    if (isRecording) {
      const path = await stopRecording();
      if (path) {
        setStatusMessage(`Successfully recorded audio to: ${path}`);
      }
    } else {
      setStatusMessage("Starting audio recording stream...");
      await startRecording();
      if (!error) {
        setStatusMessage("Recording live...");
      }
    }
  };

  const handleTrim = async (startMs: number, endMs: number) => {
    if (!recordedFilePath) return;
    setStatusMessage("Trimming audio file...");
    try {
      const newPath = await AudioService.trimAudio(recordedFilePath, startMs, endMs);
      setStatusMessage(`Successfully trimmed file to: ${newPath}`);
    } catch (err) {
      setStatusMessage(`Trim error: ${err}`);
    }
  };

  const handleApplyEffects = async () => {
    if (!recordedFilePath) return;
    setStatusMessage("Applying noise suppression and detail enhancement...");
    try {
      const newPath = await AudioService.applyVoiceEffects(recordedFilePath, {
        enable_noise_suppression: effectsEnabled,
        bass_boost: bass,
        treble_boost: treble,
      });
      setStatusMessage(`Successfully applied effects to: ${newPath}`);
    } catch (err) {
      setStatusMessage(`Effects error: ${err}`);
    }
  };

  return (
    <main className="max-w-3xl mx-auto px-6 py-10 min-h-screen text-slate-100">
      <header className="text-center mb-8">
        <h1 className="text-3xl font-extrabold text-slate-50 tracking-tight mb-2">
          Desktop Voice Recorder
        </h1>
        <p className="text-sm text-slate-400">Local-First Studio-Grade Voice Recording & Enhancement</p>
      </header>

      {error && (
        <div className="flex justify-between items-center p-3 px-4 bg-red-950/30 border border-red-500/50 rounded-lg text-red-200 mb-6 text-sm shadow-sm">
          <span>{error}</span>
          <button onClick={clearError} className="text-red-400 hover:text-red-200 cursor-pointer font-medium text-xs">Close</button>
        </div>
      )}

      <section className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Column 1: Config & Controls */}
        <div className="bg-slate-800 p-5 rounded-xl border border-slate-700 shadow-md flex flex-col justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-200 mb-4">Device Configuration</h2>
            
            <div className="mb-6">
              <label className="block text-xs font-semibold text-slate-400 mb-2">
                Input Microphone
              </label>
              <select
                value={selectedDeviceId}
                onChange={(e) => selectDevice(e.target.value)}
                disabled={isRecording}
                className="w-full p-2 px-3 rounded bg-slate-900 border border-slate-700 text-slate-200 focus:outline-none focus:border-blue-500 text-sm cursor-pointer"
              >
                {devices.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            onClick={handleToggleRecording}
            disabled={loading}
            className={`w-full py-3 text-white font-bold rounded-lg transition-colors cursor-pointer shadow-sm text-sm active:scale-[0.98] ${
              isRecording 
                ? "bg-red-600 hover:bg-red-500 active:bg-red-700" 
                : "bg-blue-600 hover:bg-blue-500 active:bg-blue-700"
            }`}
          >
            {isRecording ? "Stop Recording" : "Start Recording"}
          </button>
        </div>

        {/* Column 2: Waveform Visualizer */}
        <div className="bg-slate-800 p-5 rounded-xl border border-slate-700 shadow-md flex flex-col justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-200 mb-4">Waveform Visualizer</h2>
            <AudioVisualizer isRecording={isRecording} />
          </div>
          {statusMessage && (
            <div className="mt-3 text-xs text-sky-400 font-medium break-all bg-slate-900/50 p-2 rounded border border-slate-700/50">
              {statusMessage}
            </div>
          )}
        </div>
      </section>

      {recordedFilePath && (
        <section className="bg-slate-800 p-5 rounded-xl border border-slate-700 shadow-md mt-6">
          <h2 className="text-lg font-bold text-slate-100 mb-4 border-b border-slate-700 pb-2">
            File Processing & Editing
          </h2>

          {/* Live Playback Preview */}
          <div className="mb-6 bg-slate-900/60 p-4 rounded-lg border border-slate-700/50 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-left">
              <h4 className="text-sm font-semibold text-slate-200">Recording Playback</h4>
              <p className="text-xs text-slate-400 mt-1 truncate max-w-xs md:max-w-md" title={recordedFilePath}>
                Path: {recordedFilePath}
              </p>
            </div>
            <audio
              src={audioUrl}
              controls
              className="w-full md:max-w-md h-9 rounded bg-slate-950 border border-slate-700 accent-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Lọc tiếng ồn & EQ */}
            <div className="flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-400 mb-3">Voice Detail Filters</h3>
                
                <div className="flex items-center gap-2 mb-4">
                  <input
                    type="checkbox"
                    id="noise-cancellation"
                    checked={effectsEnabled}
                    onChange={(e) => setEffectsEnabled(e.target.checked)}
                    className="cursor-pointer"
                  />
                  <label htmlFor="noise-cancellation" className="text-slate-200 text-sm cursor-pointer select-none font-medium">
                    Enable Noise Suppression (RNNoise)
                  </label>
                </div>

                <div className="mb-4">
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-xs font-semibold text-slate-400">
                      Bass Boost (Warmth)
                    </label>
                    <span className="text-[10px] bg-slate-700 text-slate-300 font-bold px-1.5 py-0.5 rounded">{Math.round(bass * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={bass}
                    onChange={(e) => setBass(Number(e.target.value))}
                    className="w-full accent-blue-500 cursor-pointer h-1 bg-slate-900 rounded-lg appearance-none"
                  />
                </div>

                <div className="mb-6">
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-xs font-semibold text-slate-400">
                      Treble Boost (Clarity)
                    </label>
                    <span className="text-[10px] bg-slate-700 text-slate-300 font-bold px-1.5 py-0.5 rounded">{Math.round(treble * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={treble}
                    onChange={(e) => setTreble(Number(e.target.value))}
                    className="w-full accent-blue-500 cursor-pointer h-1 bg-slate-900 rounded-lg appearance-none"
                  />
                </div>
              </div>

              <button
                onClick={handleApplyEffects}
                className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 active:bg-purple-700 transition-colors rounded-lg text-white font-bold cursor-pointer text-sm shadow-sm"
              >
                Apply Voice Filters
              </button>
            </div>

            {/* Trình Trim biên tập */}
            <div>
              <h3 className="text-sm font-semibold text-slate-400 mb-3">Audio Editing & Trimming</h3>
              <WaveformEditor filePath={recordedFilePath} onTrim={handleTrim} />
            </div>
          </div>
        </section>
      )}
    </main>
  );
}

export default App;
