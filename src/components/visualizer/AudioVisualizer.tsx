import React, { useRef, useEffect } from "react";
import { listen } from "@tauri-apps/api/event";

interface AudioVisualizerProps {
  isRecording: boolean;
  color?: string;
  backgroundColor?: string;
}

/**
 * High-performance Voice-Synced Symmetrical Bar Audio Visualizer.
 * Leverages HTML5 Canvas for real-time 60FPS fluid liquid movements.
 */
export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  isRecording,
  color = "#ef4444",
  backgroundColor = "#0f172a",
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);

  // Symmetrical Bar Count
  const numBars = 60;

  // Rolling target amplitudes and current animated heights
  const amplitudesRef = useRef<number[]>(Array(numBars).fill(0.05));
  const currentHeightsRef = useRef<number[]>(Array(numBars).fill(0.05));

  const isTauri = typeof window !== "undefined" && (window as any).__TAURI_INTERNALS__ !== undefined;

  useEffect(() => {
    let unlistenFn: (() => void) | null = null;
    let active = true;

    // Listen to real-time voice amplitude events from Rust backend
    const setupListener = async () => {
      try {
        const unlisten = await listen<number>("audio-amplitude", (event) => {
          if (!active) return;
          const amp = event.payload;
          
          // Boost the signal slightly to make visual movements more pronounced
          const boosted = Math.min(1.0, amp * 1.6);
          
          amplitudesRef.current.shift();
          amplitudesRef.current.push(Math.max(0.04, boosted));
        });
        unlistenFn = unlisten;
      } catch (err) {
        console.error("Failed to subscribe to voice amplitude event:", err);
      }
    };

    if (isRecording) {
      // Clear rolling buffers
      amplitudesRef.current.fill(0.04);
      currentHeightsRef.current.fill(0.04);

      if (isTauri) {
        setupListener();
      }
    } else {
      // Slowly decay existing bars to flat baseline when recording stops
      amplitudesRef.current.fill(0.02);
    }

    return () => {
      active = false;
      if (unlistenFn) {
        unlistenFn();
      }
    };
  }, [isRecording, isTauri]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = canvas.width;
    let height = canvas.height;

    // Symmetrical bars setup
    const barWidth = 4;
    const spacing = 3;
    const totalWidth = numBars * (barWidth + spacing) - spacing;
    const startX = (width - totalWidth) / 2;

    let mockSpeechTimer = 0;
    let currentSpeechAmp = 0.04;

    const draw = () => {
      // Clear canvas
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, width, height);

      // Create a gorgeous gradient for the bars
      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, "#f43f5e"); // Rose tint at top
      gradient.addColorStop(0.5, color);   // Central theme color
      gradient.addColorStop(1, "#f43f5e"); // Rose tint at bottom

      ctx.fillStyle = gradient;

      // Mock audio amplitude generator for browser dev preview fallback
      if (!isTauri && isRecording) {
        mockSpeechTimer += 1;
        // Generate continuous speech block shapes followed by small pauses
        if (mockSpeechTimer % 80 < 60) {
          const sineMod = Math.abs(Math.sin(mockSpeechTimer * 0.12));
          currentSpeechAmp = 0.04 + sineMod * (0.2 + Math.random() * 0.7);
        } else {
          currentSpeechAmp = currentSpeechAmp * 0.8 + 0.02 * 0.2; // decay to breath
        }

        // Push new mock value periodically to simulate scroll
        if (mockSpeechTimer % 3 === 0) {
          amplitudesRef.current.shift();
          amplitudesRef.current.push(Math.max(0.04, currentSpeechAmp));
        }
      }

      // Draw all bars
      for (let i = 0; i < numBars; i++) {
        const target = amplitudesRef.current[i];
        const current = currentHeightsRef.current[i];
        
        // Fluid Linear Interpolation (Lerp) to remove step-jumps
        const next = current + (target - current) * 0.18;
        currentHeightsRef.current[i] = next;

        // Calculate heights centered around the middle axis
        const barHeight = next * (height * 0.85);
        const x = startX + i * (barWidth + spacing);
        const y = (height - barHeight) / 2;

        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(x, y, barWidth, barHeight, 2);
        } else {
          ctx.rect(x, y, barWidth, barHeight);
        }
        ctx.fill();
      }

      // Keep running the loop if recording or if there are still moving bars (decaying to flat)
      const hasMotion = currentHeightsRef.current.some(h => h > 0.03);
      if (isRecording || hasMotion) {
        animationRef.current = requestAnimationFrame(draw);
      } else {
        // Render resting baseline when completely flat
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, width, height);

        ctx.fillStyle = "#475569"; // subtle gray for idle state
        for (let i = 0; i < numBars; i++) {
          const x = startX + i * (barWidth + spacing);
          const y = (height - 4) / 2;
          ctx.beginPath();
          if (ctx.roundRect) {
            ctx.roundRect(x, y, barWidth, 4, 1);
          } else {
            ctx.rect(x, y, barWidth, 4);
          }
          ctx.fill();
        }
      }
    };

    // Always start/keep draw loop active
    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isRecording, color, backgroundColor, isTauri]);

  return (
    <div className="w-full h-[150px] rounded-2xl overflow-hidden border border-slate-700/80 shadow-2xl bg-slate-900 flex items-center justify-center p-4">
      <canvas
        ref={canvasRef}
        width={550}
        height={120}
        className="w-full h-full block"
      />
    </div>
  );
};
