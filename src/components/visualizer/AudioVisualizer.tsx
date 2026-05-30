import React, { useRef, useEffect } from "react";

interface AudioVisualizerProps {
  isRecording: boolean;
  color?: string;
  backgroundColor?: string;
}

/**
 * Real-time Audio Waveform Visualizer.
 * Leverages HTML5 Canvas for high-performance fluid rendering.
 */
export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  isRecording,
  color = "#3b82f6",
  backgroundColor = "#1e293b",
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = canvas.width;
    let height = canvas.height;

    // Simulate real-time audio wave movements when recording
    const drawMockWave = () => {
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, width, height);

      ctx.lineWidth = 2;
      ctx.strokeStyle = color;
      ctx.beginPath();

      const sliceWidth = width / 50;
      let x = 0;

      ctx.moveTo(0, height / 2);
      for (let i = 0; i < 50; i++) {
        // Generate random amplitude peaks if actively recording
        const amp = isRecording ? Math.sin(i * 0.3) * (Math.random() * (height / 3)) : 0;
        const y = height / 2 + amp;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }

        x += sliceWidth;
      }

      ctx.lineTo(width, height / 2);
      ctx.stroke();

      if (isRecording) {
        animationRef.current = requestAnimationFrame(drawMockWave);
      }
    };

    if (isRecording) {
      drawMockWave();
    } else {
      // Render static flat baseline when idle
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, width, height);
      ctx.lineWidth = 2;
      ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isRecording, color, backgroundColor]);

  return (
    <div className="w-full h-[150px] rounded-lg overflow-hidden border border-slate-700 shadow-inner">
      <canvas
        ref={canvasRef}
        width={600}
        height={150}
        className="w-full h-full block"
      />
    </div>
  );
};
