import { useState, useEffect, useCallback } from "react";
import { Mic, FolderOpen, Headphones, Settings } from "lucide-react";
import { useAudioRecorder } from "./hooks/useAudioRecorder";
import { AudioService } from "./services/audioService";
import { RecordingPage } from "./pages/RecordingPage";
import { LibraryPage } from "./pages/LibraryPage";
import { VoiceDetailStudio } from "./pages/VoiceDetailStudio";
import { SettingsPage } from "./pages/SettingsPage";
import { LiveMicStudio } from "./pages/LiveMicStudio";
import "./App.css";


export type ThemeType = "light" | "dark" | "system";

function App() {
  // Tabs: 'recording' | 'files' | 'settings' | 'live'
  const [activeTab, setActiveTab] = useState<"recording" | "files" | "settings" | "live">("recording");
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [filesList, setFilesList] = useState<string[]>([]);
  const [statusMessage, setStatusMessage] = useState("");
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [voiceEnhance, setVoiceEnhance] = useState(true);

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

  const [theme, setTheme] = useState<ThemeType>(() => {
    return (localStorage.getItem("app-theme") as ThemeType) || "system";
  });

  useEffect(() => {
    const root = document.documentElement;
    const applyTheme = (currentTheme: ThemeType) => {
      if (currentTheme === "dark") {
        root.classList.add("dark");
      } else if (currentTheme === "light") {
        root.classList.remove("dark");
      } else {
        const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        if (systemPrefersDark) {
          root.classList.add("dark");
        } else {
          root.classList.remove("dark");
        }
      }
    };

    applyTheme(theme);
    localStorage.setItem("app-theme", theme);

    if (theme === "system") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const handleChange = (e: MediaQueryListEvent) => {
        if (e.matches) {
          root.classList.add("dark");
        } else {
          root.classList.remove("dark");
        }
      };
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }
  }, [theme]);



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
        refreshFiles();
      }
    } else {
      setStatusMessage("Opening mic stream...");
      await startRecording(44100, voiceEnhance);
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
      setSelectedFile(newPath);
      refreshFiles();
    } catch (err) {
      setStatusMessage(`Trim error: ${err}`);
    }
  };

  const handleCut = async (startMs: number, endMs: number) => {
    if (!selectedFile) return;
    setStatusMessage("Cutting segment...");
    try {
      const newPath = await AudioService.cutAudioSegment(selectedFile, startMs, endMs);
      setStatusMessage(`Segment removed: ${getFileName(newPath)}`);
      setSelectedFile(newPath);
      refreshFiles();
    } catch (err) {
      setStatusMessage(`Cut error: ${err}`);
    }
  };

  const handleApplyEffects = async (effects: import("./services/audioService").VoiceEffectOptions) => {
    if (!selectedFile) return;
    setStatusMessage("Exporting with filters...");
    try {
      const exportPath = await AudioService.applyVoiceEffects(selectedFile, effects);
      setStatusMessage(`Exported: ${getFileName(exportPath)}`);
      refreshFiles();
    } catch (err) {
      setStatusMessage(`Export error: ${err}`);
    }
  };


  return (
    <main className="max-w-3xl mx-auto px-6 py-10 min-h-screen text-slate-800 dark:text-slate-100 flex flex-col transition-colors duration-300">
      <header className="text-center mb-8">
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-slate-50 tracking-tight mb-2">
          Desktop Voice Recorder
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Local-First Studio-Grade Voice Recording & Enhancement
        </p>
      </header>

      {/* Tab Navigation Menu */}
      <div className="flex bg-slate-100 dark:bg-slate-950 p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 mb-8 self-center gap-1">
        <button
          onClick={() => {
            setActiveTab("recording");
            setSelectedFile(null);
          }}
          className={`px-6 py-2 text-sm font-bold rounded-lg cursor-pointer transition-all duration-200 ${
            activeTab === "recording"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
          }`}
        >
          <Mic className="w-3.5 h-3.5" /> Record
        </button>
        <button
          onClick={() => {
            setActiveTab("files");
            refreshFiles();
          }}
          className={`px-6 py-2 text-sm font-bold rounded-lg cursor-pointer transition-all duration-200 ${
            activeTab === "files"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
          }`}
        >
          <FolderOpen className="w-3.5 h-3.5" /> Saved ({filesList.length})
        </button>
        <button
          onClick={() => {
            setActiveTab("live");
          }}
          className={`px-6 py-2 text-sm font-bold rounded-lg cursor-pointer transition-all duration-200 ${
            activeTab === "live"
              ? "bg-violet-600 text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
          }`}
        >
          <Headphones className="w-3.5 h-3.5" /> Live Mic
        </button>
        <button
          onClick={() => {
            setActiveTab("settings");
          }}
          className={`px-6 py-2 text-sm font-bold rounded-lg cursor-pointer transition-all duration-200 ${
            activeTab === "settings"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
          }`}
        >
          <Settings className="w-3.5 h-3.5" /> Settings
        </button>
      </div>

      {error && (
        <div className="flex justify-between items-center p-3 px-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-500/50 rounded-lg text-red-700 dark:text-red-200 mb-6 text-sm shadow-sm">
          <span>{error}</span>
          <button
            onClick={clearError}
            className="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-250 cursor-pointer font-semibold text-xs"
          >
            Close
          </button>
        </div>
      )}

      {/* Pages Container */}
      <div className="w-full flex-grow flex flex-col justify-start">
        {activeTab === "recording" && (
          <RecordingPage
            isRecording={isRecording}
            isPaused={isPaused}
            showDiscardConfirm={showDiscardConfirm}
            setShowDiscardConfirm={setShowDiscardConfirm}
            handleToggleRecording={handleToggleRecording}
            handleDiscardRecording={handleDiscardRecording}
            executeDiscard={executeDiscard}
            resumeRecording={resumeRecording}
            pauseRecording={pauseRecording}
            statusMessage={statusMessage}
            voiceEnhance={voiceEnhance}
            setVoiceEnhance={setVoiceEnhance}
          />
        )}

        {activeTab === "settings" && (
          <SettingsPage
            devices={devices}
            selectedDeviceId={selectedDeviceId}
            selectDevice={selectDevice}
            isRecording={isRecording}
            theme={theme}
            setTheme={setTheme}
          />
        )}

        {activeTab === "live" && <LiveMicStudio />}

        {activeTab === "files" && (
          <div className="w-full">
            {selectedFile === null ? (
              <LibraryPage
                filesList={filesList}
                onSelectFile={(file) => {
                  setSelectedFile(file);
                  setStatusMessage("");
                }}
                getFileName={getFileName}
                refreshFiles={refreshFiles}
              />
            ) : (
              <VoiceDetailStudio
                selectedFile={selectedFile}
                onBack={() => {
                  setSelectedFile(null);
                  setStatusMessage("");
                }}
                onTrim={handleTrim}
                onCut={handleCut}
                onApplyEffects={handleApplyEffects}
                statusMessage={statusMessage}
              />
            )}
          </div>
        )}
      </div>
    </main>
  );
}

export default App;
