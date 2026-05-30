import { useState, useEffect, useCallback } from "react";
import { useAudioRecorder } from "./hooks/useAudioRecorder";
import { AudioVisualizer } from "./components/visualizer/AudioVisualizer";
import { WaveformEditor } from "./components/editor/WaveformEditor";
import { AudioService } from "./services/audioService";
import { convertFileSrc } from "@tauri-apps/api/core";
import "./App.css";

function App() {
  // Tabs: 'recording' | 'files'
  const [activeTab, setActiveTab] = useState<"recording" | "files">("recording");
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [filesList, setFilesList] = useState<string[]>([]);
  const [recordingTime, setRecordingTime] = useState(0);

  const {
    isRecording,
    devices,
    selectedDeviceId,
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

  // Resolve audio URL for details preview player
  const audioUrl = selectedFile
    ? isTauri
      ? convertFileSrc(selectedFile)
      : "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3"
    : "";

  // Helper: Get base filename from absolute path
  const getFileName = (path: string): string => {
    if (!path) return "";
    const parts = path.split(/[/\\]/);
    return parts[parts.length - 1];
  };

  // Helper: Format seconds to MM:SS
  const formatTime = (secs: number): string => {
    const minutes = Math.floor(secs / 60);
    const seconds = secs % 60;
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };

  // Scan and refresh recordings from documents directory
  const refreshFiles = useCallback(async () => {
    try {
      const list = await AudioService.listRecordedFiles();
      setFilesList(list);
    } catch (err) {
      console.error("Failed to refresh recordings:", err);
    }
  }, []);

  // Tick timer up when actively recording
  useEffect(() => {
    let interval: any = null;
    if (isRecording) {
      setRecordingTime(0);
      interval = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  // Load files list on mount
  useEffect(() => {
    refreshFiles();
  }, [refreshFiles]);

  const handleToggleRecording = async () => {
    if (isRecording) {
      setStatusMessage("Stopping and saving recording...");
      const path = await stopRecording();
      if (path) {
        setStatusMessage(`Successfully saved voice to: ${getFileName(path)}`);
        // Refresh the documents list automatically
        refreshFiles();
      }
    } else {
      setStatusMessage("Opening mic stream...");
      await startRecording();
      if (!error) {
        setStatusMessage("Recording active");
      }
    }
  };

  const handleTrim = async (startMs: number, endMs: number) => {
    if (!selectedFile) return;
    setStatusMessage("Trimming audio file...");
    try {
      const newPath = await AudioService.trimAudio(selectedFile, startMs, endMs);
      setStatusMessage(`Successfully trimmed: ${getFileName(newPath)}`);
      setSelectedFile(newPath); // Auto-load the trimmed file into the player
      refreshFiles();
    } catch (err) {
      setStatusMessage(`Trim error: ${err}`);
    }
  };

  const handleApplyEffects = async () => {
    if (!selectedFile) return;
    setStatusMessage("Applying digital filters...");
    try {
      const newPath = await AudioService.applyVoiceEffects(selectedFile, {
        enable_noise_suppression: effectsEnabled,
        bass_boost: bass,
        treble_boost: treble,
      });
      setStatusMessage(`Successfully enhanced: ${getFileName(newPath)}`);
      setSelectedFile(newPath); // Auto-load the enhanced file into the player
      refreshFiles();
    } catch (err) {
      setStatusMessage(`Effects error: ${err}`);
    }
  };

  return (
    <main className="max-w-3xl mx-auto px-6 py-10 min-h-screen text-slate-100 flex flex-col">
      <header className="text-center mb-8">
        <h1 className="text-3xl font-extrabold text-slate-50 tracking-tight mb-2">
          Desktop Voice Recorder
        </h1>
        <p className="text-sm text-slate-400">Local-First Studio-Grade Voice Recording & Enhancement</p>
      </header>

      {/* Tab Navigation Menu */}
      <div className="flex bg-slate-950 p-1.5 rounded-xl border border-slate-800 mb-8 self-center gap-1">
        <button
          onClick={() => {
            setActiveTab("recording");
            setSelectedFile(null);
          }}
          className={`px-6 py-2 text-sm font-bold rounded-lg cursor-pointer transition-all duration-200 ${
            activeTab === "recording"
              ? "bg-blue-600 text-white shadow"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          🎙️ Record Voice
        </button>
        <button
          onClick={() => {
            setActiveTab("files");
            refreshFiles();
          }}
          className={`px-6 py-2 text-sm font-bold rounded-lg cursor-pointer transition-all duration-200 ${
            activeTab === "files"
              ? "bg-blue-600 text-white shadow"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          📁 Saved Recordings ({filesList.length})
        </button>
      </div>

      {error && (
        <div className="flex justify-between items-center p-3 px-4 bg-red-950/30 border border-red-500/50 rounded-lg text-red-200 mb-6 text-sm shadow-sm">
          <span>{error}</span>
          <button onClick={clearError} className="text-red-400 hover:text-red-200 cursor-pointer font-medium text-xs">Close</button>
        </div>
      )}

      {/* TAB 1: Live Voice Recording */}
      {activeTab === "recording" && (
        <section className="flex flex-col items-center bg-slate-800 p-8 rounded-2xl border border-slate-700 shadow-lg max-w-md mx-auto w-full">
          <h2 className="text-lg font-bold text-slate-200 mb-6 w-full text-center">Voice Capturing Studio</h2>

          {/* Device configuration */}
          <div className="w-full mb-8">
            <label className="block text-xs font-semibold text-slate-400 mb-2 text-left">
              Input Microphone
            </label>
            <select
              value={selectedDeviceId}
              onChange={(e) => selectDevice(e.target.value)}
              disabled={isRecording}
              className="w-full p-2.5 px-3 rounded bg-slate-900 border border-slate-700 text-slate-200 focus:outline-none focus:border-blue-500 text-sm cursor-pointer"
            >
              {devices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          {/* Active Timer Display */}
          <div className="mb-6 flex flex-col items-center">
            <div className={`text-4xl font-mono font-extrabold tracking-widest ${isRecording ? "text-red-500 animate-pulse" : "text-slate-400"}`}>
              {formatTime(recordingTime)}
            </div>
            <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500 mt-1">
              {isRecording ? "Live Duration" : "Ready to Record"}
            </div>
          </div>

          {/* Waveform Visualizer shown strictly when recording */}
          {isRecording && (
            <div className="w-full mb-8">
              <AudioVisualizer isRecording={isRecording} color="#ef4444" backgroundColor="#0f172a" />
            </div>
          )}

          {/* Circular Recording Trigger Button */}
          <button
            onClick={handleToggleRecording}
            className={`w-24 h-24 rounded-full border-4 flex items-center justify-center cursor-pointer shadow-lg active:scale-95 transition-all duration-300 ${
              isRecording
                ? "bg-red-600 hover:bg-red-500 border-red-800 animate-pulse"
                : "bg-blue-600 hover:bg-blue-500 border-blue-800"
            }`}
          >
            {isRecording ? (
              // Stop square icon
              <div className="w-8 h-8 bg-white rounded-md" />
            ) : (
              // Record red circle icon
              <div className="w-8 h-8 bg-red-500 rounded-full" />
            )}
          </button>

          {statusMessage && (
            <div className="mt-6 text-xs text-sky-400 font-semibold text-center break-all bg-slate-900/60 p-2.5 px-4 rounded border border-slate-700/50 w-full">
              {statusMessage}
            </div>
          )}
        </section>
      )}

      {/* TAB 2: Recorded Files List & Details */}
      {activeTab === "files" && (
        <section className="w-full">
          {selectedFile === null ? (
            // Sub-view 2A: List of all WAV files
            <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-lg">
              <h2 className="text-lg font-bold text-slate-200 mb-4 pb-2 border-b border-slate-700">Recorded Library</h2>
              
              {filesList.length === 0 ? (
                <div className="text-center py-10 text-slate-500 text-sm">
                  📁 No recordings found. Go to the Record tab to capture your first voice file.
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {filesList.map((file) => (
                    <div
                      key={file}
                      onClick={() => {
                        setSelectedFile(file);
                        setStatusMessage("");
                      }}
                      className="flex items-center justify-between p-3.5 bg-slate-900/50 hover:bg-slate-900 border border-slate-750 hover:border-slate-700 rounded-xl cursor-pointer transition-all duration-200 group"
                    >
                      <div className="flex items-center gap-3 overflow-hidden pr-4">
                        <span className="text-lg">🎵</span>
                        <div className="text-left overflow-hidden">
                          <div className="text-sm font-semibold text-slate-200 truncate group-hover:text-blue-400">
                            {getFileName(file)}
                          </div>
                          <div className="text-[10px] text-slate-500 truncate max-w-xs md:max-w-md mt-0.5">
                            {file}
                          </div>
                        </div>
                      </div>
                      <button className="text-slate-400 group-hover:text-blue-400 text-sm font-bold flex items-center gap-1">
                        Edit & Play <span className="text-xs">➡️</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            // Sub-view 2B: Detailed Processing Studio for Selected File
            <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-lg">
              <button
                onClick={() => {
                  setSelectedFile(null);
                  setStatusMessage("");
                }}
                className="mb-6 px-4 py-2 bg-slate-900 hover:bg-slate-950 border border-slate-700 text-slate-300 hover:text-slate-100 rounded-lg text-xs font-bold cursor-pointer transition-colors shadow flex items-center gap-1.5 active:scale-95"
              >
                ⬅️ Back to Recordings List
              </button>

              <h2 className="text-lg font-bold text-slate-100 mb-4 border-b border-slate-700 pb-2">
                Voice Detail Studio
              </h2>

              {/* High-fidelity Waveform Player & Editor */}
              <div className="mb-6 bg-slate-900/40 p-6 rounded-2xl border border-slate-700/60">
                <WaveformEditor
                  filePath={selectedFile}
                  audioUrl={audioUrl}
                  onTrim={handleTrim}
                />
              </div>

              {/* Browser Preview Mode Warning Banner */}
              {selectedFile.startsWith("[BROWSER_PREVIEW_MODE]") && (
                <div className="mb-6 p-4 bg-amber-950/20 border border-amber-500/30 rounded-lg text-amber-200 text-xs text-left leading-relaxed shadow-sm">
                  <span className="font-bold block mb-1">⚠️ Browser Preview Mode Active</span>
                  You are currently running the app in a standard web browser. Recording and audio processing are simulated for preview purposes, and **no actual files are written to your physical drive**. To record real audio and save WAV files, please install the Rust toolchain and execute <strong>npm run tauri dev</strong>.
                </div>
              )}

              {/* Voice Detail Filters */}
              <div className="p-6 bg-slate-900/40 rounded-2xl border border-slate-700/60 mb-6">
                <h3 className="text-sm font-bold text-slate-355 mb-4 text-left">Voice Detail Filters</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                  <div>
                    <div className="flex items-center gap-2.5 mb-5">
                      <input
                        type="checkbox"
                        id="noise-cancellation"
                        checked={effectsEnabled}
                        onChange={(e) => setEffectsEnabled(e.target.checked)}
                        className="cursor-pointer w-4 h-4 rounded accent-blue-500"
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
                        <span className="text-[10px] bg-slate-800 text-slate-300 font-bold px-1.5 py-0.5 rounded">{Math.round(bass * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={bass}
                        onChange={(e) => setBass(Number(e.target.value))}
                        className="w-full accent-blue-500 cursor-pointer h-1 bg-slate-950 rounded-lg appearance-none"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="mb-6">
                      <div className="flex justify-between items-center mb-1">
                        <label className="block text-xs font-semibold text-slate-400">
                          Treble Boost (Clarity)
                        </label>
                        <span className="text-[10px] bg-slate-800 text-slate-300 font-bold px-1.5 py-0.5 rounded">{Math.round(treble * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={treble}
                        onChange={(e) => setTreble(Number(e.target.value))}
                        className="w-full accent-blue-500 cursor-pointer h-1 bg-slate-950 rounded-lg appearance-none"
                      />
                    </div>

                    <button
                      onClick={handleApplyEffects}
                      className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 active:bg-purple-700 transition-colors rounded-lg text-white font-bold cursor-pointer text-sm shadow-sm"
                    >
                      Apply Voice Filters
                    </button>
                  </div>
                </div>
              </div>

              {statusMessage && (
                <div className="mt-6 text-xs text-sky-400 font-semibold text-center break-all bg-slate-900/60 p-2.5 px-4 rounded border border-slate-700/50">
                  {statusMessage}
                </div>
              )}
            </div>
          )}
        </section>
      )}
    </main>
  );
}

export default App;
