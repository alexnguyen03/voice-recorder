import React, { useRef, useEffect } from "react";
import { listen } from "@tauri-apps/api/event";

interface AudioVisualizerProps {
  isRecording: boolean;
  isPaused?: boolean;
  color?: string;
  backgroundColor?: string;
}

interface AmplitudeSample {
  time: number; // elapsed time in seconds when this amplitude was received
  val: number;  // amplitude value (0.0 - 1.0)
}

/**
 * High-performance Live Waveform Visualizer for Recording.
 * Displays a rolling 10-second viewport. The recording head is locked in the center (50% width)
 * from the start of the recording while the waveform and timeline scroll continuously at a
 * buttery-smooth 60FPS. All timestamps are drawn directly on the canvas.
 */
export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  isRecording,
  isPaused = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);

  const numBars = 180;
  const amplitudesRef = useRef<AmplitudeSample[]>([]);
  
  // Real-time delta accumulator to freeze the timeline duration and playhead during pause
  const activeTimeRef = useRef<number>(0);
  const lastUpdateTimeRef = useRef<number>(0);
  
  const lastMockTimeRef = useRef<number>(0);
  
  const isTauri = typeof window !== "undefined" && (window as any).__TAURI_INTERNALS__ !== undefined;

  const isPausedRef = useRef<boolean>(false);
  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  // Helper: Format seconds to MM:SS
  const formatTime = (secs: number): string => {
    const s = Math.max(0, secs);
    const minutes = Math.floor(s / 60);
    const seconds = Math.floor(s % 60);
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };

  // 1. Initialize Start Time and Event Listener
  useEffect(() => {
    let unlistenFn: (() => void) | null = null;
    let active = true;

    if (isRecording) {
      activeTimeRef.current = 0;
      lastUpdateTimeRef.current = performance.now();
      lastMockTimeRef.current = performance.now();
      amplitudesRef.current = [];

      const setupListener = async () => {
        try {
          const unlisten = await listen<number>("audio-amplitude", (event) => {
            if (!active || isPausedRef.current) return;
            const amp = event.payload;
            
            // Boost the signal slightly to match standard playback waveform amplitudes
            const boosted = Math.min(0.95, amp * 1.6);
            const timeOffset = activeTimeRef.current;
            
            amplitudesRef.current.push({
              time: timeOffset,
              val: Math.max(0.03, boosted),
            });
          });
          unlistenFn = unlisten;
        } catch (err) {
          console.error("Failed to subscribe to voice amplitude event:", err);
        }
      };

      if (isTauri) {
        setupListener();
      }
    }

    return () => {
      active = false;
      if (unlistenFn) {
        unlistenFn();
      }
    };
  }, [isRecording, isTauri]);

  // 2. High-Performance 60FPS Draw Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let mockSpeechTimer = 0;
    let currentSpeechAmp = 0.04;

    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;

      // Adjust backing store size dynamically for Retina support
      const targetWidth = Math.floor(rect.width * dpr);
      const targetHeight = Math.floor(rect.height * dpr);
      if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
        canvas.width = targetWidth;
        canvas.height = targetHeight;
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Reset and scale context for crisp High-DPI graphics
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const cssWidth = rect.width;
      const cssHeight = rect.height;

      // Clear Canvas
      ctx.clearRect(0, 0, cssWidth, cssHeight);

      // Draw background gradient matching mockup
      const bgGradient = ctx.createLinearGradient(0, 0, 0, cssHeight);
      bgGradient.addColorStop(0, "#f9fafb");
      bgGradient.addColorStop(0.2, "#ffffff");
      bgGradient.addColorStop(0.8, "#ffffff");
      bgGradient.addColorStop(1, "#f3f4f6");
      ctx.fillStyle = bgGradient;
      ctx.fillRect(0, 0, cssWidth, cssHeight);

      // Browser mock preview generator (runs at ~30Hz inside the frame draw loop)
      if (isRecording && !isPausedRef.current && !isTauri) {
        const now = performance.now();
        if (now - lastMockTimeRef.current >= 33) {
          lastMockTimeRef.current = now;
          mockSpeechTimer += 1;
          if (mockSpeechTimer % 85 < 65) {
            const sineMod = Math.abs(Math.sin(mockSpeechTimer * 0.12));
            currentSpeechAmp = 0.04 + sineMod * (0.2 + Math.random() * 0.75);
          } else {
            currentSpeechAmp = currentSpeechAmp * 0.8 + 0.02 * 0.2;
          }
          const boosted = Math.min(0.95, currentSpeechAmp * 1.6);
          const timeOffset = activeTimeRef.current;
          amplitudesRef.current.push({
            time: timeOffset,
            val: Math.max(0.03, boosted),
          });
        }
      }

      // Calculate elapsed time based on active accumulator delta
      let elapsedSec = 0;
      if (isRecording) {
        const now = performance.now();
        if (!isPausedRef.current) {
          const delta = (now - lastUpdateTimeRef.current) / 1000;
          activeTimeRef.current += delta;
        }
        lastUpdateTimeRef.current = now;
        elapsedSec = activeTimeRef.current;
      }
      
      // Viewport width is fixed at 10 seconds. Playhead is always locked at 50% width (middle).
      const viewStart = elapsedSec - 5;
      const viewEnd = elapsedSec + 5;
      const progressFraction = 0.5;

      // Coordinate metrics for drawing
      const barWidth = 2;
      const spacing = 1;
      const totalBarsWidth = numBars * (barWidth + spacing) - spacing;
      const startX = (cssWidth - totalBarsWidth) / 2;

      // Draw Grid Lines (5 divisions) and text timestamps
      ctx.strokeStyle = "#e5e7eb";
      ctx.lineWidth = 1;
      ctx.fillStyle = "#9ca3af";
      ctx.font = "10px Inter, system-ui, -apple-system, sans-serif";
      ctx.textAlign = "center";

      for (let g = 0; g <= 4; g++) {
        const gx = startX + (g / 4) * totalBarsWidth;
        // Grid lines stop at y = 120 to leave space for labels
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, 120);
        ctx.stroke();

        // Draw dynamic timeline timestamp label
        const labelTime = viewStart + (g / 4) * (viewEnd - viewStart);
        ctx.fillText(formatTime(labelTime), gx, 138);
      }

      // Calculate the progress bar index
      const recordedBarsCount = Math.floor(progressFraction * numBars);
      const samples = amplitudesRef.current;

      // Draw Symmetrical Waveform Bars (Height centered in y = 60 range)
      const centerY = 60;
      const maxBarHeight = 80; // maximum vertical bar span

      for (let i = 0; i < numBars; i++) {
        const barTimeStart = viewStart + (i / numBars) * (viewEnd - viewStart);
        const barTimeEnd = viewStart + ((i + 1) / numBars) * (viewEnd - viewStart);
        
        let amp = 0.04;

        if (!isRecording) {
          amp = 0.04;
        } else if (i > recordedBarsCount) {
          // Unrecorded future region: flat grey bar
          amp = 0.04;
        } else if (i === recordedBarsCount) {
          // Active dancing bar under the record head: use latest amplitude sample
          amp = samples.length > 0 ? samples[samples.length - 1].val : 0.04;
        } else {
          // Historical recorded region: average/max amplitude in this specific time bracket
          const samplesInBracket = samples.filter(
            (s) => s.time >= barTimeStart && s.time < barTimeEnd
          );
          
          if (samplesInBracket.length > 0) {
            amp = Math.max(...samplesInBracket.map((s) => s.val));
          } else {
            // Find closest historical sample if spacing is sparse
            let closestVal = 0.03;
            let minDiff = Infinity;
            for (let j = 0; j < samples.length; j++) {
              const diff = Math.abs(samples[j].time - barTimeStart);
              if (diff < minDiff) {
                minDiff = diff;
                closestVal = samples[j].val;
              }
            }
            amp = closestVal;
          }
        }

        const barHeight = amp * maxBarHeight;
        const x = startX + i * (barWidth + spacing);
        const y = centerY - barHeight / 2;

        const isRecorded = isRecording && i <= recordedBarsCount && barTimeEnd > 0;
        ctx.fillStyle = isRecorded ? "#54b4ff" : "#e5e7eb"; // blue for recorded, grey for future/idle

        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(x, y, barWidth, barHeight, 1);
        } else {
          ctx.rect(x, y, barWidth, barHeight);
        }
        ctx.fill();
      }

      // Draw vertical Blue Recording Head at progress
      const headX = startX + progressFraction * totalBarsWidth;

      ctx.strokeStyle = "#54b4ff";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(headX, 0);
      ctx.lineTo(headX, 120);
      ctx.stroke();

      // Top cap circle
      ctx.fillStyle = "#54b4ff";
      ctx.beginPath();
      ctx.arc(headX, 3, 3, 0, Math.PI * 2);
      ctx.fill();

      // Bottom cap circle
      ctx.beginPath();
      ctx.arc(headX, 117, 3, 0, Math.PI * 2);
      ctx.fill();

      if (isRecording) {
        animationRef.current = requestAnimationFrame(draw);
      }
    };

    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isRecording, isPaused]);

  return (
    <div className="w-full flex flex-col items-center">
      <div className="w-full relative bg-white border border-gray-200/80 rounded-2xl p-6 pt-8 pb-3 shadow-sm select-none">
        <canvas
          ref={canvasRef}
          className="w-full h-[150px] block"
        />
      </div>
    </div>
  );
};
