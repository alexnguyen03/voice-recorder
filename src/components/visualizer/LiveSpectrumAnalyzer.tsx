import React, { useRef, useEffect } from "react";

interface LiveSpectrumAnalyzerProps {
  /** Whether recording is actively running */
  isRecording: boolean;
  /** Whether recording is paused — spectrum freezes but stays visible */
  isPaused?: boolean;
  /** Mirrors the recording pipeline's voice cleanup preset for the visual feed */
  voiceEnhance?: boolean;
}

/**
 * LiveSpectrumAnalyzer
 *
 * Self-contained frequency spectrum visualizer for the recording page.
 * Lifecycle:
 *   isRecording=true  → requests mic via getUserMedia, builds Web Audio graph,
 *                        starts 60fps RAF draw loop
 *   isPaused=true     → draw loop pauses (last frame stays visible)
 *   isRecording=false → tears down stream, AudioContext, and canvas loop
 *
 * Mic stream is requested independently of Tauri's recording backend so the
 * visualizer works in both Tauri and browser preview modes.
 */
export const LiveSpectrumAnalyzer: React.FC<LiveSpectrumAnalyzerProps> = ({
  isRecording,
  isPaused = false,
  voiceEnhance = true,
}) => {
  const canvasRef      = useRef<HTMLCanvasElement>(null);
  const animationRef   = useRef<number | null>(null);
  const audioCtxRef    = useRef<AudioContext | null>(null);
  const analyserRef    = useRef<AnalyserNode | null>(null);
  const streamRef      = useRef<MediaStream | null>(null);
  const isPausedRef    = useRef(false);

  // Keep isPaused accessible inside the RAF loop without re-subscribing
  useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);

  // ── Core draw function ───────────────────────────────────────────────────
  const draw = (canvas: HTMLCanvasElement, analyser: AnalyserNode, ctx2d: CanvasRenderingContext2D, sampleRate: number) => {
    const rect = canvas.getBoundingClientRect();
    const dpr  = window.devicePixelRatio || 1;

    // Resize backing store for Retina / HiDPI
    const targetW = Math.floor(rect.width  * dpr);
    const targetH = Math.floor(rect.height * dpr);
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width  = targetW;
      canvas.height = targetH;
    }

    ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);

    const cssW = rect.width;
    const cssH = rect.height;

    // ── Background ──────────────────────────────────────────────────────
    const isDark = document.documentElement.classList.contains("dark");
    ctx2d.clearRect(0, 0, cssW, cssH);
    ctx2d.fillStyle = isDark ? "#020617" : "#f9fafb";
    ctx2d.fillRect(0, 0, cssW, cssH);

    // ── Frequency data ──────────────────────────────────────────────────
    const bufLen    = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufLen);
    analyser.getByteFrequencyData(dataArray);

    // Logarithmic frequency mapping 20 Hz → 20 kHz
    const nyquist  = sampleRate / 2;
    const minFreq  = 20;
    const maxFreq  = 20000;

    const getLogX = (freq: number): number => {
      if (freq <= minFreq) return 0;
      if (freq >= maxFreq) return cssW;
      return (Math.log10(freq / minFreq) / Math.log10(maxFreq / minFreq)) * cssW;
    };

    // ── Draw bars ───────────────────────────────────────────────────────
    for (let i = 0; i < bufLen; i++) {
      const freq     = (i * nyquist) / bufLen;
      if (freq > maxFreq) break;

      const nextFreq = ((i + 1) * nyquist) / bufLen;
      const x        = getLogX(Math.max(minFreq, freq));
      const nextX    = getLogX(Math.max(minFreq, nextFreq));
      const barW     = Math.max(1, nextX - x);
      const barH     = (dataArray[i] / 255) * cssH;

      if (barH > 0 && freq >= minFreq) {
        const gradient = ctx2d.createLinearGradient(0, cssH, 0, cssH - barH);
        gradient.addColorStop(0, "rgba(124, 58, 237, 0.25)");  // violet base
        gradient.addColorStop(0.6, "rgba(99, 102, 241, 0.7)"); // indigo mid
        gradient.addColorStop(1, "rgba(56, 189, 248, 0.95)");  // sky top

        ctx2d.fillStyle = gradient;
        ctx2d.beginPath();
        if (ctx2d.roundRect) {
          ctx2d.roundRect(x, cssH - barH, barW - 0.5, barH, [2, 2, 0, 0]);
        } else {
          ctx2d.rect(x, cssH - barH, barW - 0.5, barH);
        }
        ctx2d.fill();
      }
    }

    // ── Subtle baseline ─────────────────────────────────────────────────
    ctx2d.strokeStyle = isDark ? "rgba(51, 65, 85, 0.5)" : "rgba(226, 232, 240, 0.8)";
    ctx2d.lineWidth   = 1;
    ctx2d.beginPath();
    ctx2d.moveTo(0, cssH - 0.5);
    ctx2d.lineTo(cssW, cssH - 0.5);
    ctx2d.stroke();
  };

  // ── Mic stream + AudioContext lifecycle ──────────────────────────────────
  useEffect(() => {
    if (!isRecording) return;

    let active = true;

    const bootstrap = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl:  false,
          },
          video: false,
        });
        if (!active) { stream.getTracks().forEach(t => t.stop()); return; }

        streamRef.current = stream;

        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioCtx() as AudioContext;
        audioCtxRef.current = ctx;

        const source   = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize                = 2048;
        analyser.smoothingTimeConstant  = 0.82;
        analyserRef.current = analyser;

        if (voiceEnhance) {
          const highPass = ctx.createBiquadFilter();
          highPass.type = "highpass";
          highPass.frequency.value = 85;

          const notch50 = ctx.createBiquadFilter();
          notch50.type = "notch";
          notch50.frequency.value = 50;
          notch50.Q.value = 10;

          const notch60 = ctx.createBiquadFilter();
          notch60.type = "notch";
          notch60.frequency.value = 60;
          notch60.Q.value = 10;

          const lowPass = ctx.createBiquadFilter();
          lowPass.type = "lowpass";
          lowPass.frequency.value = 9000;

          source.connect(highPass).connect(notch50).connect(notch60).connect(lowPass).connect(analyser);
        } else {
          source.connect(analyser);
        }
        // Do NOT connect to destination — we only want to analyse, not play back

        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx2d = canvas.getContext("2d");
        if (!ctx2d) return;

        const sampleRate = ctx.sampleRate;

        const loop = () => {
          if (!active) return;
          if (!isPausedRef.current) {
            draw(canvas, analyser, ctx2d, sampleRate);
          }
          animationRef.current = requestAnimationFrame(loop);
        };
        animationRef.current = requestAnimationFrame(loop);

      } catch (err) {
        console.warn("[LiveSpectrumAnalyzer] getUserMedia failed:", err);
      }
    };

    bootstrap();

    return () => {
      active = false;
      // Cancel RAF loop
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      // Stop mic tracks
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
      // Close AudioContext
      audioCtxRef.current?.close().catch(() => {});
      audioCtxRef.current = null;
      analyserRef.current = null;
    };
  }, [isRecording, voiceEnhance]);

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div
      className={`w-full transition-all duration-500 ease-out overflow-hidden ${
        isRecording ? "max-h-[80px] opacity-100" : "max-h-0 opacity-0"
      }`}
    >
      {/* Canvas + Frequency label overlay — mirrors WaveformEditor spectrum panel */}
      <div className="relative w-full h-[60px] bg-slate-50 dark:bg-slate-950">
        <canvas ref={canvasRef} className="w-full h-full block" />

        {/* Frequency axis labels */}
        <div className="absolute bottom-0 w-full h-full pointer-events-none text-[8px] text-slate-400 dark:text-slate-600 font-medium select-none">
          <span className="absolute bottom-0.5" style={{ left: "0%" }}>20Hz</span>
          <span className="absolute bottom-0.5 -translate-x-1/2" style={{ left: "23.3%" }}>100Hz</span>
          <span className="absolute bottom-0.5 -translate-x-1/2" style={{ left: "56.6%" }}>1kHz</span>
          <span className="absolute bottom-0.5 -translate-x-1/2" style={{ left: "89.9%" }}>10kHz</span>
          <span className="absolute bottom-0.5 right-0">20kHz</span>
        </div>

        {/* Paused overlay */}
        {isPaused && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/40 backdrop-blur-[1px]">
            <span className="text-[9px] font-bold tracking-widest text-slate-400 uppercase select-none">
              Paused
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
