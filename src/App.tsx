import { useState, useEffect, useCallback } from "react";
import { useAudioRecorder } from "./hooks/useAudioRecorder";
import { AudioVisualizer } from "./components/visualizer/AudioVisualizer";
import { WaveformEditor } from "./components/editor/WaveformEditor";
import { AudioService } from "./services/audioService";
import { convertFileSrc } from "@tauri-apps/api/core";
import "./App.css";

function App() {
  // Tabs: 'recording' | 'files'
  const [activeTab, setActiveTab] = useState<"recording" | "files" | "settings">("recording");
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [filesList, setFilesList] = useState<string[]>([]);

  const {
    isRecording,
    isPaused,
    devices,
    selectedDeviceId,
    error,
    selectDevice,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    discardRecording,
    clearError,
  } = useAudioRecorder();

  const [effectsEnabled, setEffectsEnabled] = useState(false);
  const [bass, setBass] = useState(0.5);
  const [treble, setTreble] = useState(0.5);
  const [statusMessage, setStatusMessage] = useState("");
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

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


  // Scan and refresh recordings from documents directory
  const refreshFiles = useCallback(async () => {
    try {
      const list = await AudioService.listRecordedFiles();
      setFilesList(list);
    } catch (err) {
      console.error("Failed to refresh recordings:", err);
    }
  }, []);


  // Load files list on mount
  useEffect(() => {
    refreshFiles();
  }, [refreshFiles]);

  const handleToggleRecording = async () => {
    setShowDiscardConfirm(false);
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

  const handleDiscardRecording = async () => {
    setShowDiscardConfirm(true);
    if (isRecording && !isPaused) {
      try {
        await pauseRecording();
      } catch (err) {
        console.error("Failed to pause recording on discard confirmation:", err);
      }
    }
  };

  const executeDiscard = async () => {
    setStatusMessage("Discarding active recording...");
    try {
      await discardRecording();
      setStatusMessage("Recording discarded.");
    } catch (err) {
      setStatusMessage(`Discard error: ${err}`);
    } finally {
      setShowDiscardConfirm(false);
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
          🎙️ Record
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
        <button
          onClick={() => {
            setActiveTab("settings");
          }}
          className={`px-6 py-2 text-sm font-bold rounded-lg cursor-pointer transition-all duration-200 ${
            activeTab === "settings"
              ? "bg-blue-600 text-white shadow"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          ⚙️ Settings
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
        <section className="flex flex-col items-center bg-slate-800 p-8 rounded-2xl border border-slate-700 shadow-lg max-w-lg mx-auto w-full">
          {/* Waveform Visualizer shown always */}
          <div className="w-full mb-8">
            <AudioVisualizer isRecording={isRecording} isPaused={isPaused} />
          </div>

          {isRecording || isPaused ? (
            <div className="flex items-center justify-center h-20 w-full transition-all duration-500">
              <div className={`flex items-center justify-center transition-all duration-500 ${showDiscardConfirm ? 'gap-0' : 'gap-6'}`}>
                {/* Discard Action Selector */}
                <div
                  className={`h-18 rounded-full border flex items-center overflow-hidden transition-all duration-500 ease-out ${
                    showDiscardConfirm
                      ? "w-64 border-rose-500/50 bg-slate-900/90 p-2 px-3.5"
                      : "w-18 border-rose-950 bg-rose-900 hover:bg-rose-800 p-0"
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
                        className="w-12 h-12 rounded-full border border-slate-700 bg-slate-800 hover:bg-slate-700 flex items-center justify-center cursor-pointer shadow active:scale-95 transition-all duration-200 text-slate-300 flex-shrink-0"
                        title="Keep recording"
                      >
                        <svg className="w-5 h-5 fill-none stroke-current" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>

                      {/* Discard Title text inside the pill */}
                      <span className="text-xs font-bold text-rose-400 uppercase tracking-widest text-center select-none px-2 whitespace-nowrap">
                        Discard?
                      </span>

                      {/* Discard / Confirm Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          executeDiscard();
                        }}
                        className="w-12 h-12 rounded-full border border-rose-800 bg-rose-600 hover:bg-rose-500 flex items-center justify-center cursor-pointer shadow active:scale-95 transition-all duration-200 text-white flex-shrink-0"
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
                    showDiscardConfirm ? "w-0 opacity-0 pointer-events-none" : "w-18 opacity-100"
                  }`}
                >
                  <button
                    onClick={isPaused ? resumeRecording : pauseRecording}
                    className={`w-18 h-18 rounded-full border-4 flex items-center justify-center cursor-pointer shadow-lg active:scale-95 transition-all duration-300 ${
                      isPaused
                        ? "bg-emerald-600 hover:bg-emerald-500 border-emerald-800"
                        : "bg-amber-600 hover:bg-amber-500 border-amber-800"
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
                    showDiscardConfirm ? "w-0 opacity-0 pointer-events-none" : "w-18 opacity-100"
                  }`}
                >
                  <button
                    onClick={handleToggleRecording}
                    className="w-18 h-18 rounded-full border-4 border-red-800 bg-red-600 hover:bg-red-500 flex items-center justify-center cursor-pointer shadow-lg active:scale-95 transition-all duration-300"
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
              className="w-24 h-24 rounded-full border-4 border-blue-800 bg-blue-600 hover:bg-blue-500 flex items-center justify-center cursor-pointer shadow-lg active:scale-95 transition-all duration-300"
              title="Start recording"
            >
              {/* Record red circle icon */}
              <div className="w-8 h-8 bg-red-500 rounded-full" />
            </button>
          )}

          {statusMessage && statusMessage.toLowerCase().includes("error") && (
            <div className="mt-6 text-xs text-red-400 font-semibold text-center break-all bg-red-950/20 p-2.5 px-4 rounded border border-red-500/35 w-full">
              {statusMessage}
            </div>
          )}
        </section>
      )}

      {/* TAB 3: Settings */}
      {activeTab === "settings" && (
        <section className="flex flex-col bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-lg max-w-md mx-auto w-full">
          <h2 className="text-lg font-bold text-slate-100 mb-6 pb-2 border-b border-slate-700 text-left">
            Recording Settings
          </h2>
          
          {/* Device configuration */}
          <div className="w-full mb-6 text-left">
            <label className="block text-xs font-semibold text-slate-400 mb-2">
              Input Microphone Device
            </label>
            <select
              value={selectedDeviceId}
              onChange={(e) => selectDevice(e.target.value)}
              disabled={isRecording}
              className="w-full p-3 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 focus:outline-none focus:border-blue-500 text-sm cursor-pointer shadow-sm"
            >
              {devices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            {isRecording && (
              <p className="text-[10px] text-amber-400 mt-2">
                ⚠️ Microphone cannot be changed while recording is active.
              </p>
            )}
          </div>

          <div className="text-left bg-slate-900/40 p-4 rounded-xl border border-slate-700/40">
            <h4 className="text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">Audio Properties</h4>
            <ul className="text-xs text-slate-400 space-y-1.5">
              <li>• Format: <span className="text-slate-300 font-semibold">WAV (PCM)</span></li>
              <li>• Sample Rate: <span className="text-slate-300 font-semibold">44,100 Hz</span></li>
              <li>• Channels: <span className="text-slate-300 font-semibold">Mono (1 channel)</span></li>
              <li>• Bit Depth: <span className="text-slate-300 font-semibold">16-bit</span></li>
            </ul>
          </div>
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

              {statusMessage && statusMessage.toLowerCase().includes("error") && (
                <div className="mt-6 text-xs text-red-400 font-semibold text-center break-all bg-red-950/20 p-2.5 px-4 rounded border border-red-500/35">
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
