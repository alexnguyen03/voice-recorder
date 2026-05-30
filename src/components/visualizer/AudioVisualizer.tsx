import React, { useRef, useEffect } from "react";

interface AudioVisualizerProps {
  isRecording: boolean;
  color?: string;
  backgroundColor?: string;
}

/**
 * Component hiển thị dạng sóng âm thanh thời gian thực (Real-time Waveform).
 * Sử dụng HTML5 Canvas thuần để tối ưu hóa hiệu năng vẽ.
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

    // Giả lập sóng âm thanh thời gian thực khi đang ghi âm
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
        // Tạo bước sóng giả lập ngẫu nhiên nếu đang ghi âm
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
      // Trả canvas về trạng thái phẳng tĩnh
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
    <div style={{ width: "100%", height: "150px", borderRadius: "8px", overflow: "hidden" }}>
      <canvas
        ref={canvasRef}
        width={600}
        height={150}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
    </div>
  );
};
