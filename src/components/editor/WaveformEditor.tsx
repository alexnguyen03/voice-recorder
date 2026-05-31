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
  /**
   * Active edit mode:
   * - 'trim'  = green/amber handles, dim outside selection (keep selection)
   * - 'cut'   = rose handles, dim inside selection (remove selection)
   * - null    = no handles, normal seek
   */
  editMode?: 'trim' | 'cut' | null;
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
  editMode = null,
  onPlayStateChange,
}, ref) {
  const [duration, setDuration] = useState<number>(20); // default to 20 seconds
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [waveform, setWaveform] = useState<number[]>([]);
  const [isDecoding, setIsDecoding] = useState<boolean>(false);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  // Trimming state in milliseconds
  const [startMs, setStartMs] = useState<number>(0);
  const [endMs, setEndMs] = useState<number>(20000);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const spectrumCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDraggingRef = useRef<boolean>(false);
  const draggingHandleRef = useRef<'start' | 'end' | null>(null);
  const editModeRef = useRef<'trim' | 'cut' | null>(null);

  // Web Audio API nodes — player-only graph (source → analyser → destination)
  // All EQ/DSP processing is done by the Rust engine before the file reaches this player.
  const audioCtxRef     = useRef<AudioContext | null>(null);
  const analyserNodeRef = useRef<AnalyserNode | null>(null);

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
  useEffect(() => { editModeRef.current = editMode ?? null; }, [editMode]);

  // Tear down AudioContext when the source file changes
  useEffect(() => {
    return () => {
      audioCtxRef.current?.close();
      audioCtxRef.current  = null;
      analyserNodeRef.current = null;
    };
  }, [audioUrl]);

  // Fetch audio file into a blob to bypass Tauri CORS restrictions with Web Audio API
  useEffect(() => {
    if (!audioUrl) {
      setBlobUrl(null);
      return;
    }
    
    let active = true;
    let currentUrl: string | null = null;
    
    fetch(audioUrl)
      .then(res => res.blob())
      .then(blob => {
        if (active) {
          currentUrl = URL.createObjectURL(blob);
          setBlobUrl(currentUrl);
        }
      })
      .catch(err => console.error("Failed to load audio blob:", err));
      
    return () => {
      active = false;
      if (currentUrl) URL.revokeObjectURL(currentUrl);
    };
  }, [audioUrl]);



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

    // Split canvas: waveform zone (top) + timeline zone (bottom 20px)
    const timelineH = 20;
    const waveHeight = cssHeight - timelineH;

    // Draw Grid Lines (5 divisions) — only in waveform zone
    ctx.strokeStyle = isDark ? "#1e293b" : "#e5e7eb";
    ctx.lineWidth = 1;
    for (let g = 0; g <= 4; g++) {
      const gx = startX + (g / 4) * totalBarsWidth;
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, waveHeight);
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
      
      const barHeight = amp * (waveHeight * 0.65);
      const x = startX + i * (barWidth + spacing);
      const y = (waveHeight - barHeight) / 2;

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
    ctx.lineTo(playheadX, waveHeight);
    ctx.stroke();

    // Top cap circle
    ctx.fillStyle = "#54b4ff";
    ctx.beginPath();
    ctx.arc(playheadX, 3, 3, 0, Math.PI * 2);
    ctx.fill();

    // Bottom cap circle
    ctx.beginPath();
    ctx.arc(playheadX, waveHeight - 3, 3, 0, Math.PI * 2);
    ctx.fill();

    // Draw edit-mode handles (trim or cut)
    const em = editModeRef.current;
    if (em && dur > 0) {
      const startHandleX = startX + (startMsRef.current / 1000 / dur) * totalBarsWidth;
      const endHandleX   = startX + (endMsRef.current   / 1000 / dur) * totalBarsWidth;
      const tabW = 10;
      const tabH = 18;

      if (em === 'trim') {
        // ── TRIM: dim outside the selection ─────────────────────────
        ctx.fillStyle = isDark ? 'rgba(2,6,23,0.55)' : 'rgba(0,0,0,0.18)';
        if (startHandleX > startX)
          ctx.fillRect(startX, 0, startHandleX - startX, waveHeight);
        if (endHandleX < startX + totalBarsWidth)
          ctx.fillRect(endHandleX, 0, (startX + totalBarsWidth) - endHandleX, waveHeight);

        // Start handle — emerald
        ctx.strokeStyle = '#10b981'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(startHandleX, 0); ctx.lineTo(startHandleX, waveHeight); ctx.stroke();
        ctx.fillStyle = '#10b981'; ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(startHandleX - tabW / 2, 0, tabW, tabH, 3) : ctx.rect(startHandleX - tabW / 2, 0, tabW, tabH);
        ctx.fill();

        // End handle — amber
        ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(endHandleX, 0); ctx.lineTo(endHandleX, waveHeight); ctx.stroke();
        ctx.fillStyle = '#f59e0b'; ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(endHandleX - tabW / 2, 0, tabW, tabH, 3) : ctx.rect(endHandleX - tabW / 2, 0, tabW, tabH);
        ctx.fill();

      } else {
        // ── CUT OUT: dim INSIDE the selection (rose tint = region being deleted) ──
        ctx.fillStyle = isDark ? 'rgba(244,63,94,0.22)' : 'rgba(244,63,94,0.15)';
        ctx.fillRect(startHandleX, 0, endHandleX - startHandleX, waveHeight);

        // Diagonal hatch lines over the cut region for extra clarity
        ctx.save();
        ctx.beginPath();
        ctx.rect(startHandleX, 0, endHandleX - startHandleX, waveHeight);
        ctx.clip();
        ctx.strokeStyle = isDark ? 'rgba(244,63,94,0.18)' : 'rgba(244,63,94,0.12)';
        ctx.lineWidth = 1;
        for (let hx = startHandleX - waveHeight; hx < endHandleX + waveHeight; hx += 10) {
          ctx.beginPath(); ctx.moveTo(hx, 0); ctx.lineTo(hx + waveHeight, waveHeight); ctx.stroke();
        }
        ctx.restore();

        // Both handles — rose
        const rose = '#f43f5e';
        ctx.strokeStyle = rose; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(startHandleX, 0); ctx.lineTo(startHandleX, waveHeight); ctx.stroke();
        ctx.fillStyle = rose; ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(startHandleX - tabW / 2, 0, tabW, tabH, 3) : ctx.rect(startHandleX - tabW / 2, 0, tabW, tabH);
        ctx.fill();

        ctx.strokeStyle = rose; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(endHandleX, 0); ctx.lineTo(endHandleX, waveHeight); ctx.stroke();
        ctx.fillStyle = rose; ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(endHandleX - tabW / 2, 0, tabW, tabH, 3) : ctx.rect(endHandleX - tabW / 2, 0, tabW, tabH);
        ctx.fill();
      }
    }

    // ── Timeline labels — drawn at exact bar x-positions ──────────────
    const labelY = waveHeight + 5;
    ctx.font = `10px Inter, system-ui, -apple-system, sans-serif`;
    ctx.textBaseline = 'top';
    ctx.fillStyle = isDark ? 'rgba(148,163,184,0.55)' : 'rgba(100,116,139,0.65)';
    for (let g = 0; g <= 4; g++) {
      const gx = startX + (g / 4) * totalBarsWidth;
      const label = formatTime(dur * (g / 4));
      ctx.textAlign = g === 0 ? 'left' : g === 4 ? 'right' : 'center';
      ctx.fillText(label, gx, labelY);
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
        drawSpectrum();
        animationId = requestAnimationFrame(renderLoop);
      }
    };

    if (isPlaying) {
      animationId = requestAnimationFrame(renderLoop);
    } else {
      draw();
      drawSpectrum();
    }

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [isPlaying]);

  const drawSpectrum = () => {
    const canvas = spectrumCanvasRef.current;
    const analyser = analyserNodeRef.current;
    if (!canvas || !analyser) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // We don't resize dynamically here for performance, we assume CSS handles layout and we scale it in resize listener.
    const width = canvas.width;
    const height = canvas.height;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteFrequencyData(dataArray);

    ctx.clearRect(0, 0, width, height);

    // AudioContext sample rate is usually 44100 or 48000. Nyquist is half of that.
    const nyquist = (audioCtxRef.current?.sampleRate || 44100) / 2;
    
    // Map frequencies from 20Hz to 20000Hz logarithmically onto the canvas width.
    const minFreq = 20;
    const maxFreq = 20000;
    
    const getLogX = (freq: number) => {
      if (freq <= minFreq) return 0;
      if (freq >= maxFreq) return width;
      return (Math.log10(freq / minFreq) / Math.log10(maxFreq / minFreq)) * width;
    };

    // Draw glowing frequency bars
    for (let i = 0; i < bufferLength; i++) {
      const freq = (i * nyquist) / bufferLength;
      if (freq > maxFreq) break;
      
      const nextFreq = ((i + 1) * nyquist) / bufferLength;
      
      const x = getLogX(Math.max(minFreq, freq));
      const nextX = getLogX(Math.max(minFreq, nextFreq));
      const barWidth = Math.max(1, nextX - x); // ensure at least 1px wide
      
      const barHeight = (dataArray[i] / 255) * height;
      
      if (barHeight > 0 && freq >= minFreq) {
        // Premium styling: Gradient that changes based on frequency (Bass = Purple, Treble = Blue/Cyan)
        const gradient = ctx.createLinearGradient(0, height, 0, height - barHeight);
        gradient.addColorStop(0, 'rgba(124, 58, 237, 0.2)'); // Violet base
        gradient.addColorStop(1, 'rgba(56, 189, 248, 0.9)'); // Sky blue top

        ctx.fillStyle = gradient;
        
        // Slight rounding on top of bars
        ctx.beginPath();
        ctx.roundRect(x, height - barHeight, barWidth - 0.5, barHeight, [2, 2, 0, 0]);
        ctx.fill();
      }
    }
  };

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

  /** Toggle play/pause on the audio element */
  const startAudioPlayback = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      onPlayStateChange?.(false);
    } else {
      audioRef.current.play().catch((err) => console.error('Playback error:', err));
      setIsPlaying(true);
      onPlayStateChange?.(true);
    }
  };

  const togglePlay = () => {
    if (!audioRef.current) return;

    // Bootstrap a minimal Web Audio graph on first play (requires a user gesture).
    // The graph is intentionally filter-free — all DSP is done by the Rust engine.
    // Only an AnalyserNode is inserted so the spectrum visualizer can read data.
    if (!audioCtxRef.current) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx() as AudioContext;
        audioCtxRef.current = ctx;

        const source  = ctx.createMediaElementSource(audioRef.current);
        const analyser = ctx.createAnalyser();
        analyser.fftSize               = 2048;
        analyser.smoothingTimeConstant = 0.85;
        analyserNodeRef.current = analyser;

        // Simple chain: source → analyser → speakers (zero EQ processing)
        source.connect(analyser).connect(ctx.destination);

        startAudioPlayback();
        return;
      }
    }

    // Resume suspended context (browser auto-suspend policy)
    if (audioCtxRef.current?.state === 'suspended') {
      audioCtxRef.current.resume();
    }

    startAudioPlayback();
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

    // In edit mode: check proximity to either handle first
    if (editModeRef.current && durationRef.current > 0) {
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
        key={blobUrl || "empty"}
        ref={audioRef}
        src={blobUrl || ""}
        crossOrigin="anonymous"
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleAudioEnded}
      />


      {/* 2. Symmetrical Interactive Waveform Display (High DPI Retina Canvas) */}
      <div className="w-full relative bg-white dark:bg-slate-900 rounded-sm shadow-sm select-none flex flex-col">
        {isDecoding && (
          <div className="absolute inset-0 bg-white/70 dark:bg-slate-950/75 backdrop-blur-[1px] flex items-center justify-center rounded-sm z-10">
            <div className="flex flex-col items-center gap-2">
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-[10px] text-gray-500 dark:text-slate-400 font-medium">Extracting sound waves...</span>
            </div>
          </div>
        )}

        {/* Main Waveform Canvas */}
        <canvas
          ref={canvasRef}
          className="w-full h-[150px] block border-b border-slate-100 dark:border-slate-800"
          style={{ cursor: editMode ? 'col-resize' : 'pointer' }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUpOrLeave}
          onMouseLeave={handleMouseUpOrLeave}
        />

        {/* Frequency Spectrum Analyzer Canvas */}
        <div className="relative w-full h-[60px] bg-slate-50 dark:bg-slate-950">
          <canvas
            ref={spectrumCanvasRef}
            className="w-full h-full block"
          />
          {/* Frequency labels overlay */}
          <div className="absolute bottom-0 w-full h-full pointer-events-none text-[8px] text-slate-400 dark:text-slate-600 font-medium select-none">
            <span className="absolute bottom-0.5" style={{ left: '0%' }}>20Hz</span>
            <span className="absolute bottom-0.5 -translate-x-1/2" style={{ left: '23.3%' }}>100Hz</span>
            <span className="absolute bottom-0.5 -translate-x-1/2" style={{ left: '56.6%' }}>1kHz</span>
            <span className="absolute bottom-0.5 -translate-x-1/2" style={{ left: '89.9%' }}>10kHz</span>
            <span className="absolute bottom-0.5 right-0">20kHz</span>
          </div>
        </div>
      </div>

      {/* Trim range synced to parent via onTrimRangeChange */}
    </div>
  );
});
