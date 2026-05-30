import React, { useState, useEffect, useRef } from "react";

interface WaveformEditorProps {
  filePath: string;
  audioUrl: string;
  onTrim: (startMs: number, endMs: number) => void;
}

/**
 * High-performance 60FPS Waveform Editor and Player.
 * Uses direct Canvas drawing in a requestAnimationFrame loop to bypass React render overhead,
 * achieving buttery-smooth 60fps playhead movements and high-DPI (Retina) responsive scaling.
 */
export const WaveformEditor: React.FC<WaveformEditorProps> = ({
  filePath,
  audioUrl,
  onTrim,
}) => {
  const [duration, setDuration] = useState<number>(20); // default to 20 seconds
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [waveform, setWaveform] = useState<number[]>([]);
  const [isDecoding, setIsDecoding] = useState<boolean>(false);

  // Trimming state in milliseconds
  const [startMs, setStartMs] = useState<number>(0);
  const [endMs, setEndMs] = useState<number>(20000);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDraggingRef = useRef<boolean>(false);

  // High-density bar count (180 points for a premium professional look)
  const numBars = 180;

  // Refs for animation loop (prevents stale closures and React re-renders)
  const currentTimeRef = useRef<number>(0);
  const durationRef = useRef<number>(20);
  const waveformRef = useRef<number[]>([]);
  const startMsRef = useRef<number>(0);
  const endMsRef = useRef<number>(20000);
  const isDecodingRef = useRef<boolean>(false);

  // Sync state to refs
  useEffect(() => { waveformRef.current = waveform; }, [waveform]);
  useEffect(() => { durationRef.current = duration; }, [duration]);
  useEffect(() => { startMsRef.current = startMs; }, [startMs]);
  useEffect(() => { endMsRef.current = endMs; }, [endMs]);
  useEffect(() => { isDecodingRef.current = isDecoding; }, [isDecoding]);

  // Helper: Format seconds to MM:SS
  const formatTime = (secs: number): string => {
    const minutes = Math.floor(secs / 60);
    const seconds = Math.floor(secs % 60);
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };

  // Generate beautiful, deterministic mock waveform for browser fallbacks
  const generateMockWaveform = (seedName: string, count: number): number[] => {
    const bars: number[] = [];
    const seed = seedName.length || 10;
    
    for (let i = 0; i < count; i++) {
      let base = 0.05;
      const p = i / count;
      
      if (p < 0.12) {
        base = 0.05 + (p / 0.12) * 0.15 + Math.sin(i * 0.5) * 0.03;
      }
      else if (p >= 0.12 && p < 0.35) {
        const peak = Math.sin((p - 0.12) / 0.23 * Math.PI);
        base = 0.2 + peak * 0.55 + Math.cos(i * 1.2) * 0.08;
      }
      else if (p >= 0.35 && p < 0.42) {
        base = 0.08 + Math.sin(i * 0.8) * 0.02;
      }
      else if (p >= 0.42 && p < 0.70) {
        const peak = Math.sin((p - 0.42) / 0.28 * Math.PI);
        base = 0.25 + peak * 0.65 + Math.sin(i * 2.1) * 0.1;
      }
      else if (p >= 0.70 && p < 0.92) {
        const decay = (0.92 - p) / 0.22;
        base = 0.08 + decay * 0.5 + Math.cos(i * 0.9) * 0.06;
      }
      else {
        base = 0.05 + Math.random() * 0.02;
      }

      const variation = Math.sin(i * seed * 0.1) * 0.03;
      const finalVal = Math.max(0.02, Math.min(0.95, base + variation));
      bars.push(finalVal);
    }
    return bars;
  };

  // 1. Core Drawing Function (Double-buffered High-DPI Canvas Rendering)
  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas || waveformRef.current.length === 0) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    
    // Prevent layout/dimension reset flickering by only updating canvas attributes when different
    const targetWidth = Math.floor(rect.width * dpr);
    const targetHeight = Math.floor(rect.height * dpr);
    if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
      canvas.width = targetWidth;
      canvas.height = targetHeight;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Reset transform matrix and apply DPR scaling (for sharp crisp lines on Retina displays)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const cssWidth = rect.width;
    const cssHeight = rect.height;

    // Clear Canvas
    ctx.clearRect(0, 0, cssWidth, cssHeight);

    // Draw background gradient as in mockup
    const bgGradient = ctx.createLinearGradient(0, 0, 0, cssHeight);
    bgGradient.addColorStop(0, "#f9fafb");
    bgGradient.addColorStop(0.2, "#ffffff");
    bgGradient.addColorStop(0.8, "#ffffff");
    bgGradient.addColorStop(1, "#f3f4f6");
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, cssWidth, cssHeight);

    // Drawing metrics in CSS coordinate space
    const barWidth = 2;
    const spacing = 1;
    const count = waveformRef.current.length;
    const totalBarsWidth = count * (barWidth + spacing) - spacing;
    const startX = (cssWidth - totalBarsWidth) / 2;

    // Draw Grid Lines (5 divisions)
    ctx.strokeStyle = "#e5e7eb";
    ctx.lineWidth = 1;
    for (let g = 0; g <= 4; g++) {
      const gx = startX + (g / 4) * totalBarsWidth;
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, cssHeight);
      ctx.stroke();
    }

    const curTime = currentTimeRef.current;
    const dur = durationRef.current;
    const trimStartSec = startMsRef.current / 1000;
    const trimEndSec = endMsRef.current / 1000;

    // Draw Symmetrical Waveform Bars
    for (let i = 0; i < count; i++) {
      const barTime = (i / count) * dur;
      const amp = waveformRef.current[i] || 0.05;
      
      const barHeight = amp * (cssHeight * 0.65);
      const x = startX + i * (barWidth + spacing);
      const y = (cssHeight - barHeight) / 2;

      const isPlayed = barTime <= curTime;
      const isWithinTrim = barTime >= trimStartSec && barTime <= trimEndSec;

      if (isPlayed) {
        ctx.fillStyle = isWithinTrim ? "#54b4ff" : "rgba(84, 180, 255, 0.35)"; // blue
      } else {
        ctx.fillStyle = isWithinTrim ? "#d0d0d0" : "rgba(208, 208, 208, 0.35)"; // grey
      }

      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(x, y, barWidth, barHeight, 1);
      } else {
        ctx.rect(x, y, barWidth, barHeight);
      }
      ctx.fill();
    }

    // Draw Playhead Line (Vertical Blue Line with round caps)
    const playheadPercent = dur > 0 ? curTime / dur : 0;
    const playheadX = startX + playheadPercent * totalBarsWidth;

    ctx.strokeStyle = "#54b4ff";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(playheadX, 0);
    ctx.lineTo(playheadX, cssHeight);
    ctx.stroke();

    // Top cap circle
    ctx.fillStyle = "#54b4ff";
    ctx.beginPath();
    ctx.arc(playheadX, 3, 3, 0, Math.PI * 2);
    ctx.fill();

    // Bottom cap circle
    ctx.beginPath();
    ctx.arc(playheadX, cssHeight - 3, 3, 0, Math.PI * 2);
    ctx.fill();
  };

  // 2. Load Audio and Extract Waveform
  useEffect(() => {
    let active = true;
    if (!audioUrl) return;

    setIsPlaying(false);
    currentTimeRef.current = 0;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = audioUrl;
      audioRef.current.load();
    }

    const decodeAudio = async () => {
      setIsDecoding(true);
      
      const fallback = () => {
        if (!active) return;
        const mock = generateMockWaveform(filePath, numBars);
        setWaveform(mock);
        setIsDecoding(false);
        setDuration(20);
        setEndMs(20000);
      };

      if (audioUrl.startsWith("[BROWSER_PREVIEW_MODE]")) {
        fallback();
        return;
      }

      try {
        const response = await fetch(audioUrl);
        if (!response.ok) throw new Error("Fetch failed");
        
        const arrayBuffer = await response.arrayBuffer();
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContextClass) {
          fallback();
          return;
        }

        const audioCtx = new AudioContextClass();
        const decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        
        if (!active) return;

        const rawData = decodedBuffer.getChannelData(0);
        const sampleSize = Math.floor(rawData.length / numBars);
        const peaks: number[] = [];

        for (let i = 0; i < numBars; i++) {
          const start = i * sampleSize;
          let maxVal = 0;
          for (let j = 0; j < sampleSize; j++) {
            const val = Math.abs(rawData[start + j]);
            if (val > maxVal) maxVal = val;
          }
          peaks.push(Math.max(0.03, maxVal));
        }

        const highestPeak = Math.max(...peaks);
        const normalized = peaks.map((p) => (highestPeak > 0 ? (p / highestPeak) * 0.9 : p));

        setWaveform(normalized);
        const dur = decodedBuffer.duration;
        setDuration(dur);
        setEndMs(Math.round(dur * 1000));
        setIsDecoding(false);
        audioCtx.close();
      } catch (err) {
        console.warn("Failed to decode audio using Web Audio API. Using high-fidelity mock generator.", err);
        fallback();
      }
    };

    decodeAudio();

    return () => {
      active = false;
    };
  }, [audioUrl, filePath]);

  // 3. Ultra-Smooth 60FPS Playhead Tracker Loop
  useEffect(() => {
    let animationId: number;

    const renderLoop = () => {
      if (audioRef.current && isPlaying) {
        currentTimeRef.current = audioRef.current.currentTime;
        draw();
        animationId = requestAnimationFrame(renderLoop);
      }
    };

    if (isPlaying) {
      animationId = requestAnimationFrame(renderLoop);
    } else {
      draw();
    }

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [isPlaying]);

  // Redraw when waveform data or resize events happen
  useEffect(() => {
    draw();
    
    // Listen to window resizes to scale the responsive canvas properly
    window.addEventListener("resize", draw);
    return () => window.removeEventListener("resize", draw);
  }, [waveform, isDecoding]);

  // Audio Playback Listeners
  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      const dur = audioRef.current.duration;
      if (dur && isFinite(dur)) {
        setDuration(dur);
        setEndMs((prev) => (prev > dur * 1000 || prev === 20000 ? Math.round(dur * 1000) : prev));
      }
    }
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
    currentTimeRef.current = 0;
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
    }
    draw();
  };

  // Playback Control Actions
  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch((err) => console.error("Playback error:", err));
      setIsPlaying(true);
    }
  };

  const skipBackward = () => {
    if (!audioRef.current) return;
    const target = Math.max(0, currentTimeRef.current - 15);
    audioRef.current.currentTime = target;
    currentTimeRef.current = target;
    draw();
  };

  const skipForward = () => {
    if (!audioRef.current) return;
    const target = Math.min(durationRef.current, currentTimeRef.current + 15);
    audioRef.current.currentTime = target;
    currentTimeRef.current = target;
    draw();
  };

  // Interactive Click & Drag Seeking on Waveform Canvas
  const handleCanvasInteraction = (clientX: number) => {
    const canvas = canvasRef.current;
    if (!canvas || durationRef.current <= 0) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = clientX - rect.left;
    
    // CSS layout measurements
    const barWidth = 2;
    const spacing = 1;
    const count = waveformRef.current.length;
    const totalBarsWidth = count * (barWidth + spacing) - spacing;
    const startX = (rect.width - totalBarsWidth) / 2;

    let relativeX = clickX - startX;
    if (relativeX < 0) relativeX = 0;
    if (relativeX > totalBarsWidth) relativeX = totalBarsWidth;

    const percent = relativeX / totalBarsWidth;
    const targetTime = percent * durationRef.current;

    currentTimeRef.current = targetTime;
    draw();
    if (audioRef.current) {
      audioRef.current.currentTime = targetTime;
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = true;
    handleCanvasInteraction(e.clientX);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDraggingRef.current) {
      handleCanvasInteraction(e.clientX);
    }
  };

  const handleMouseUpOrLeave = () => {
    isDraggingRef.current = false;
  };

  // Validate start and end inputs
  const handleStartChange = (val: number) => {
    const clamped = Math.max(0, Math.min(val, endMs - 100));
    setStartMs(clamped);
  };

  const handleEndChange = (val: number) => {
    const clamped = Math.min(Math.max(val, startMs + 100), Math.round(duration * 1000));
    setEndMs(clamped);
  };

  return (
    <div className="w-full flex flex-col items-center">
      {/* Hidden audio tag */}
      <audio
        ref={audioRef}
        src={audioUrl}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleAudioEnded}
      />

      {/* 1. File Title Heading */}
      <div className="w-full text-center mb-5">
        <h3 className="text-xl font-light text-slate-350 tracking-wide select-none">
          {filePath ? filePath.split(/[/\\]/).pop() : "Sound #1"}
        </h3>
      </div>

      {/* 2. Symmetrical Interactive Waveform Display (High DPI Retina Canvas) */}
      <div className="w-full relative bg-white border border-gray-200/80 rounded-2xl p-6 pt-8 pb-3 shadow-sm select-none">
        {isDecoding && (
          <div className="absolute inset-0 bg-white/70 backdrop-blur-[1px] flex items-center justify-center rounded-2xl z-10">
            <div className="flex flex-col items-center gap-2">
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-[10px] text-gray-500 font-medium">Extracting sound waves...</span>
            </div>
          </div>
        )}

        <canvas
          ref={canvasRef}
          className="w-full h-[130px] block cursor-pointer"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUpOrLeave}
          onMouseLeave={handleMouseUpOrLeave}
        />

        {/* Timestamps aligning with division lines */}
        <div className="w-full flex justify-between text-[11px] text-gray-400 font-light mt-4 px-1">
          <span>00:00</span>
          <span>{formatTime(duration * 0.25)}</span>
          <span>{formatTime(duration * 0.5)}</span>
          <span>{formatTime(duration * 0.75)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* 3. Media Controls Bar */}
      <div className="flex items-center justify-center gap-8 mt-6">
        {/* Skip 15s backward */}
        <button
          onClick={skipBackward}
          className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-slate-200 active:scale-90 transition-all cursor-pointer bg-slate-900/40 rounded-full border border-slate-700/30"
          title="Rewind 15 seconds"
        >
          <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
            <path d="M12.5 3C17.15 3 21 6.85 21 11.5c0 4.65-3.85 8.5-8.5 8.5-4.14 0-7.61-2.99-8.37-6.95H6.2C6.9 15.89 9.44 18 12.5 18c3.58 0 6.5-2.92 6.5-6.5S16.08 5 12.5 5c-2.04 0-3.86 1-5 2.54V5H5v6h6V9H8.55c.98-1.78 2.87-3 4.95-3z"/>
            <text x="12.5" y="15" fontSize="6.5" fontWeight="bold" textAnchor="middle" fill="currentColor">15</text>
          </svg>
        </button>

        {/* Play/Pause Center Indicator */}
        <button
          onClick={togglePlay}
          className="w-10 h-10 flex items-center justify-center text-slate-300 hover:text-white active:scale-90 transition-all cursor-pointer"
        >
          {isPlaying ? (
            <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
            </svg>
          ) : (
            <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z"/>
            </svg>
          )}
        </button>

        {/* Skip 15s forward */}
        <button
          onClick={skipForward}
          className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-slate-200 active:scale-90 transition-all cursor-pointer bg-slate-900/40 rounded-full border border-slate-700/30"
          title="Skip 15 seconds"
        >
          <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
            <path d="M11.5 3C6.85 3 3 6.85 3 11.5c0 4.65 3.85 8.5 8.5 8.5 4.14 0 7.61-2.99 8.37-6.95h-2.06c-.7 2.84-3.24 4.95-6.31 4.95-3.58 0-6.5-2.92-6.5-6.5S7.92 5 11.5 5c2.04 0 3.86 1 5 2.54V5h2.5v6H13V9h2.45c-.98-1.78-2.87-3-4.95-3z"/>
            <text x="11.5" y="15" fontSize="6.5" fontWeight="bold" textAnchor="middle" fill="currentColor">15</text>
          </svg>
        </button>
      </div>

      {/* 4. Large Blue Pill Button */}
      <button
        onClick={togglePlay}
        className="bg-[#54b4ff] hover:bg-[#469eef] text-white w-64 h-14 rounded-full flex items-center justify-center active:scale-95 transition-all shadow-md mt-6 cursor-pointer"
        title={isPlaying ? "Pause playback" : "Start playback"}
      >
        {isPlaying ? (
          <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
          </svg>
        ) : (
          <svg className="w-6 h-6 fill-current pl-1" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>

      {/* 5. Precise Editing Form (Start / End Input for Trim) */}
      <div className="w-full grid grid-cols-2 gap-4 mt-8 pt-6 border-t border-slate-700/40">
        <div>
          <label className="block text-xs text-slate-400 mb-1.5 font-semibold text-left">Start point (ms)</label>
          <input
            type="number"
            min="0"
            max={endMs - 100}
            value={startMs}
            onChange={(e) => handleStartChange(Number(e.target.value))}
            className="w-full p-2.5 rounded-lg bg-slate-900 border border-slate-700/80 text-white focus:outline-none focus:border-blue-500 text-sm shadow-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1.5 font-semibold text-left">End point (ms)</label>
          <input
            type="number"
            min={startMs + 100}
            max={Math.round(duration * 1000)}
            value={endMs}
            onChange={(e) => handleEndChange(Number(e.target.value))}
            className="w-full p-2.5 rounded-lg bg-slate-900 border border-slate-700/80 text-white focus:outline-none focus:border-blue-500 text-sm shadow-sm"
          />
        </div>
      </div>

      {/* 6. Action Button for Trim */}
      <button
        onClick={() => onTrim(startMs, endMs)}
        className="w-full mt-5 py-3 px-4 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 transition-colors rounded-xl text-white font-bold cursor-pointer text-sm shadow-md"
      >
        Trim Selected Area
      </button>
    </div>
  );
};
