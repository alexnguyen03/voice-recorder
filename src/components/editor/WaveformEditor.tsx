import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from "react";

/** Methods exposed to parent via ref */
export interface WaveformEditorHandle {
  togglePlay: () => void;
  skipBackward: () => void;
  skipForward: () => void;
  isPlaying: () => boolean;
}

interface WaveformEditorProps {
  filePath: string;
  audioUrl: string;
  onTrim: (startMs: number, endMs: number) => void;
  /** Fired whenever trim range changes */
  onTrimRangeChange?: (startMs: number, endMs: number) => void;
  /** When true, renders draggable trim handles on the waveform canvas */
  trimMode?: boolean;
  /** Fired when play state changes */
  onPlayStateChange?: (playing: boolean) => void;
}

/**
 * High-performance 60FPS Waveform Editor and Player.
 * Uses direct Canvas drawing in a requestAnimationFrame loop to bypass React render overhead,
 * achieving buttery-smooth 60fps playhead movements and high-DPI (Retina) responsive scaling.
 */
export const WaveformEditor = forwardRef<WaveformEditorHandle, WaveformEditorProps>(function WaveformEditorInner({
  filePath,
  audioUrl,
  onTrim: _onTrim,
  onTrimRangeChange,
  trimMode = false,
  onPlayStateChange,
}, ref) {
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
  const draggingHandleRef = useRef<'start' | 'end' | null>(null);
  const trimModeRef = useRef<boolean>(false);

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
  useEffect(() => { trimModeRef.current = trimMode; }, [trimMode]);

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
    const isDark = document.documentElement.classList.contains("dark");
    const bgGradient = ctx.createLinearGradient(0, 0, 0, cssHeight);
    if (isDark) {
      bgGradient.addColorStop(0, "#0f172a");
      bgGradient.addColorStop(0.2, "#0b0f19");
      bgGradient.addColorStop(0.8, "#0b0f19");
      bgGradient.addColorStop(1, "#020617");
    } else {
      bgGradient.addColorStop(0, "#f9fafb");
      bgGradient.addColorStop(0.2, "#ffffff");
      bgGradient.addColorStop(0.8, "#ffffff");
      bgGradient.addColorStop(1, "#f3f4f6");
    }
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, cssWidth, cssHeight);

    // Drawing metrics in CSS coordinate space
    const barWidth = 2;
    const spacing = 1;
    const count = waveformRef.current.length;
    const totalBarsWidth = count * (barWidth + spacing) - spacing;
    const startX = (cssWidth - totalBarsWidth) / 2;

    // Draw Grid Lines (5 divisions)
    ctx.strokeStyle = isDark ? "#1e293b" : "#e5e7eb";
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
        ctx.fillStyle = isWithinTrim 
          ? "#54b4ff" 
          : (isDark ? "rgba(84, 180, 255, 0.25)" : "rgba(84, 180, 255, 0.35)"); // blue
      } else {
        ctx.fillStyle = isWithinTrim 
          ? (isDark ? "#475569" : "#d0d0d0") 
          : (isDark ? "rgba(71, 85, 105, 0.25)" : "rgba(208, 208, 208, 0.35)"); // grey
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

    // Draw draggable trim handles in trim mode
    if (trimModeRef.current && dur > 0) {
      const startHandleX = startX + (startMsRef.current / 1000 / dur) * totalBarsWidth;
      const endHandleX   = startX + (endMsRef.current   / 1000 / dur) * totalBarsWidth;

      // Dim region before start handle
      ctx.fillStyle = isDark ? 'rgba(2,6,23,0.55)' : 'rgba(0,0,0,0.18)';
      if (startHandleX > startX) {
        ctx.fillRect(startX, 0, startHandleX - startX, cssHeight);
      }
      // Dim region after end handle
      if (endHandleX < startX + totalBarsWidth) {
        ctx.fillRect(endHandleX, 0, (startX + totalBarsWidth) - endHandleX, cssHeight);
      }

      const tabW = 10;
      const tabH = 18;

      // Start handle — emerald green
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(startHandleX, 0);
      ctx.lineTo(startHandleX, cssHeight);
      ctx.stroke();
      ctx.fillStyle = '#10b981';
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(startHandleX - tabW / 2, 0, tabW, tabH, 3);
      } else {
        ctx.rect(startHandleX - tabW / 2, 0, tabW, tabH);
      }
      ctx.fill();

      // End handle — amber
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(endHandleX, 0);
      ctx.lineTo(endHandleX, cssHeight);
      ctx.stroke();
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(endHandleX - tabW / 2, 0, tabW, tabH, 3);
      } else {
        ctx.rect(endHandleX - tabW / 2, 0, tabW, tabH);
      }
      ctx.fill();
    }
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
    onPlayStateChange?.(false);
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
      onPlayStateChange?.(false);
    } else {
      audioRef.current.play().catch((err) => console.error("Playback error:", err));
      setIsPlaying(true);
      onPlayStateChange?.(true);
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

  // Expose imperative handle to parent
  useImperativeHandle(ref, () => ({
    togglePlay,
    skipBackward,
    skipForward,
    isPlaying: () => isPlaying,
  }));

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

  const HANDLE_SNAP_PX = 12;

  /** Convert a clientX position to milliseconds within the audio duration */
  const resolveXToMs = (clientX: number, rect: DOMRect): number => {
    const bW = 2, sp = 1;
    const cnt = waveformRef.current.length;
    const totalW = cnt * (bW + sp) - sp;
    const sX = (rect.width - totalW) / 2;
    const relX = Math.max(0, Math.min(clientX - rect.left - sX, totalW));
    return Math.round((relX / totalW) * durationRef.current * 1000);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // In trim mode: check proximity to either handle first
    if (trimModeRef.current && durationRef.current > 0) {
      const rect = canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const bW = 2, sp = 1;
      const cnt = waveformRef.current.length;
      const totalW = cnt * (bW + sp) - sp;
      const sX = (rect.width - totalW) / 2;
      const dur = durationRef.current;
      const startHandleX = sX + (startMsRef.current / 1000 / dur) * totalW;
      const endHandleX   = sX + (endMsRef.current   / 1000 / dur) * totalW;

      if (Math.abs(clickX - startHandleX) <= HANDLE_SNAP_PX) {
        draggingHandleRef.current = 'start';
        return;
      }
      if (Math.abs(clickX - endHandleX) <= HANDLE_SNAP_PX) {
        draggingHandleRef.current = 'end';
        return;
      }
    }

    isDraggingRef.current = true;
    handleCanvasInteraction(e.clientX);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;

    // Dragging a trim handle
    if (draggingHandleRef.current && canvas) {
      const rect = canvas.getBoundingClientRect();
      const targetMs = resolveXToMs(e.clientX, rect);

      if (draggingHandleRef.current === 'start') {
        const clamped = Math.max(0, Math.min(targetMs, endMsRef.current - 100));
        setStartMs(clamped);
        startMsRef.current = clamped; // update ref immediately for smooth draw()
        onTrimRangeChange?.(clamped, endMsRef.current);
      } else {
        const maxMs = Math.round(durationRef.current * 1000);
        const clamped = Math.max(startMsRef.current + 100, Math.min(targetMs, maxMs));
        setEndMs(clamped);
        endMsRef.current = clamped;
        onTrimRangeChange?.(startMsRef.current, clamped);
      }
      draw();
      return;
    }

    if (isDraggingRef.current) {
      handleCanvasInteraction(e.clientX);
    }
  };

  const handleMouseUpOrLeave = () => {
    draggingHandleRef.current = null;
    isDraggingRef.current = false;
  };

  // Sync trim range to parent whenever startMs/endMs change
  useEffect(() => {
    onTrimRangeChange?.(startMs, endMs);
  }, [startMs, endMs]);

  return (
    <div className="w-full flex flex-col items-center">
      {/* Hidden audio tag */}
      <audio
        ref={audioRef}
        src={audioUrl}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleAudioEnded}
      />


      {/* 2. Symmetrical Interactive Waveform Display (High DPI Retina Canvas) */}
      <div className="w-full relative bg-white dark:bg-slate-900 rounded-sm p-4 pt-6 pb-3 shadow-sm select-none">
        {isDecoding && (
          <div className="absolute inset-0 bg-white/70 dark:bg-slate-950/75 backdrop-blur-[1px] flex items-center justify-center rounded-2xl z-10">
            <div className="flex flex-col items-center gap-2">
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-[10px] text-gray-500 dark:text-slate-400 font-medium">Extracting sound waves...</span>
            </div>
          </div>
        )}

        <canvas
          ref={canvasRef}
          className="w-full h-[130px] block"
          style={{ cursor: trimMode ? 'col-resize' : 'pointer' }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUpOrLeave}
          onMouseLeave={handleMouseUpOrLeave}
        />

        {/* Timestamps aligning with division lines */}
        <div className="w-full flex justify-between text-[11px] text-gray-400 dark:text-slate-500 font-light mt-4 px-1">
          <span>00:00</span>
          <span>{formatTime(duration * 0.25)}</span>
          <span>{formatTime(duration * 0.5)}</span>
          <span>{formatTime(duration * 0.75)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Trim range synced to parent via onTrimRangeChange */}
    </div>
  );
});
