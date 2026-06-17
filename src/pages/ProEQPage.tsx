import React, { useState, useEffect, useRef, useCallback } from "react";
import "./ProEQPage.css";
import { convertFileSrc } from "@tauri-apps/api/core";
import { AudioService } from "../services/audioService";
import {
  Mic,
  Play,
  Pause,
  Square,
  Radio,
  Sliders,
  Zap,
  ZapOff,
  Music2,
  Volume2,
  Activity,
  ChevronDown,
  RotateCcw,
  Podcast,
  Star,
  Upload,
  FileAudio,
  FolderOpen,
  X,
  Download,
  CheckCircle2,
} from "lucide-react";

// ─── EQ Band definitions ─────────────────────────────────────────────────────
interface EQBand {
  id: string;
  label: string;
  freq: number;       // Hz
  gain: number;       // dB (-18 to +18)
  q: number;          // Q factor
  type: BiquadFilterType;
  color: string;
}

const DEFAULT_BANDS: EQBand[] = [
  { id: "sub",    label: "Sub",    freq: 60,   gain: 0, q: 0.7, type: "lowshelf",  color: "#f97316" },
  { id: "bass",   label: "Bass",   freq: 120,  gain: 0, q: 1.0, type: "peaking",   color: "#fb923c" },
  { id: "low",    label: "Low Mid",freq: 300,  gain: 0, q: 1.2, type: "peaking",   color: "#fbbf24" },
  { id: "mid",    label: "Mid",    freq: 1000, gain: 0, q: 1.0, type: "peaking",   color: "#a3e635" },
  { id: "high",   label: "Hi Mid", freq: 3500, gain: 0, q: 1.2, type: "peaking",   color: "#34d399" },
  { id: "air",    label: "Air",    freq: 10000,gain: 0, q: 0.7, type: "highshelf", color: "#60a5fa" },
];

// ─── Presets ──────────────────────────────────────────────────────────────────
interface Preset {
  name: string;
  icon: React.ReactNode;
  description: string;
  color: string;
  gains: number[]; // one per band
  compressor: { threshold: number; ratio: number; attack: number; release: number };
  warmth: number;   // 0-100
}

const PRESETS: Preset[] = [
  {
    name: "Flat",
    icon: <Activity className="w-4 h-4" />,
    description: "No processing — raw signal",
    color: "#64748b",
    gains: [0, 0, 0, 0, 0, 0],
    compressor: { threshold: -24, ratio: 2, attack: 0.003, release: 0.25 },
    warmth: 0,
  },
  {
    name: "Podcast",
    icon: <Podcast className="w-4 h-4" />,
    description: "Warm, clear, full voice",
    color: "#f97316",
    gains: [4, 6, -2, 2, 3, 2],
    compressor: { threshold: -18, ratio: 3.5, attack: 0.005, release: 0.2 },
    warmth: 65,
  },
  {
    name: "Radio FM",
    icon: <Radio className="w-4 h-4" />,
    description: "Broadcast-ready, punchy",
    color: "#8b5cf6",
    gains: [2, 5, -3, 4, 5, 4],
    compressor: { threshold: -14, ratio: 5, attack: 0.002, release: 0.15 },
    warmth: 55,
  },
  {
    name: "Studio Vocal",
    icon: <Mic className="w-4 h-4" />,
    description: "Smooth, present, professional",
    color: "#06b6d4",
    gains: [1, 4, -4, 3, 6, 3],
    compressor: { threshold: -20, ratio: 4, attack: 0.004, release: 0.3 },
    warmth: 50,
  },
  {
    name: "Bass Boost",
    icon: <Zap className="w-4 h-4" />,
    description: "Deep, rich, cinematic bass",
    color: "#f59e0b",
    gains: [8, 10, 2, 0, -1, -2],
    compressor: { threshold: -16, ratio: 4, attack: 0.003, release: 0.2 },
    warmth: 85,
  },
  {
    name: "Vocal Warm",
    icon: <Music2 className="w-4 h-4" />,
    description: "Intimate, silky, inviting tone",
    color: "#ec4899",
    gains: [5, 8, 3, -2, 2, 1],
    compressor: { threshold: -20, ratio: 3, attack: 0.006, release: 0.35 },
    warmth: 90,
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

// ─── WAV Encoder (32-bit IEEE float, lossless) ────────────────────────────────
function encodeWAV(buffer: AudioBuffer): Blob {
  const numCh = buffer.numberOfChannels;
  const sr = buffer.sampleRate;
  const len = buffer.length;
  const bitsPerSample = 32;           // 32-bit float
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numCh * bytesPerSample;
  const dataBytes = len * blockAlign;
  const ab = new ArrayBuffer(44 + dataBytes);
  const v = new DataView(ab);
  const write4 = (o: number, s: string) => { for (let i = 0; i < 4; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  // RIFF
  write4(0, "RIFF");
  v.setUint32(4, 36 + dataBytes, true);
  write4(8, "WAVE");
  // fmt  (IEEE float = type 3)
  write4(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 3, true);            // IEEE float
  v.setUint16(22, numCh, true);
  v.setUint32(24, sr, true);
  v.setUint32(28, sr * blockAlign, true);
  v.setUint16(32, blockAlign, true);
  v.setUint16(34, bitsPerSample, true);
  // data
  write4(36, "data");
  v.setUint32(40, dataBytes, true);
  // Interleave all channels
  const channels = Array.from({ length: numCh }, (_, c) => buffer.getChannelData(c));
  let offset = 44;
  for (let i = 0; i < len; i++) {
    for (let c = 0; c < numCh; c++) {
      v.setFloat32(offset, channels[c][i], true);
      offset += 4;
    }
  }
  return new Blob([ab], { type: "audio/wav" });
}


// ─── EQ Curve Visualizer ─────────────────────────────────────────────────────
interface EQVisualizerProps {
  bands: EQBand[];
  width?: number;
  height?: number;
}

const EQVisualizer: React.FC<EQVisualizerProps> = ({ bands, width = 600, height = 180 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    // Grid
    const gridColor = "rgba(255,255,255,0.05)";
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    // Horizontal lines at -12, -6, 0, +6, +12 dB
    const dbLines = [-12, -6, 0, 6, 12];
    dbLines.forEach((db) => {
      const y = H / 2 - (db / 18) * (H / 2 - 10);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.2)";
      ctx.font = "10px Inter, sans-serif";
      ctx.fillText(`${db > 0 ? "+" : ""}${db}dB`, 4, y - 3);
    });

    // Frequency markers
    const freqLabels = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];
    const freqToX = (f: number) => {
      const logMin = Math.log10(20);
      const logMax = Math.log10(20000);
      return ((Math.log10(f) - logMin) / (logMax - logMin)) * W;
    };
    freqLabels.forEach((f) => {
      const x = freqToX(f);
      ctx.strokeStyle = "rgba(255,255,255,0.04)";
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
      const label = f >= 1000 ? `${f / 1000}k` : `${f}`;
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      ctx.font = "9px Inter, sans-serif";
      ctx.fillText(label, x - 8, H - 4);
    });

    // EQ Curve
    const numPoints = W;
    const offlineCtx = new OfflineAudioContext(1, 1, 44100);

    // Build biquad filters
    const filters = bands.map((band) => {
      const f = offlineCtx.createBiquadFilter();
      f.type = band.type;
      f.frequency.value = band.freq;
      f.gain.value = band.gain;
      f.Q.value = band.q;
      return f;
    });

    // Calculate frequency response
    const frequencies = new Float32Array(numPoints);
    for (let i = 0; i < numPoints; i++) {
      const t = i / (numPoints - 1);
      frequencies[i] = Math.pow(10, Math.log10(20) + t * (Math.log10(20000) - Math.log10(20)));
    }

    // Accumulate gain across all filters
    const totalMag = new Float32Array(numPoints).fill(1);
    filters.forEach((f) => {
      const mag = new Float32Array(numPoints);
      const phase = new Float32Array(numPoints);
      f.getFrequencyResponse(frequencies, mag, phase);
      for (let i = 0; i < numPoints; i++) totalMag[i] *= mag[i];
    });

    // Draw filled gradient curve
    const gradient = ctx.createLinearGradient(0, 0, W, 0);
    gradient.addColorStop(0.0, "rgba(249,115,22,0.7)");
    gradient.addColorStop(0.25, "rgba(251,191,36,0.7)");
    gradient.addColorStop(0.5, "rgba(163,230,53,0.7)");
    gradient.addColorStop(0.75, "rgba(52,211,153,0.7)");
    gradient.addColorStop(1.0, "rgba(96,165,250,0.7)");

    const fillGrad = ctx.createLinearGradient(0, 0, 0, H);
    fillGrad.addColorStop(0, "rgba(139,92,246,0.25)");
    fillGrad.addColorStop(1, "rgba(139,92,246,0)");

    ctx.beginPath();
    for (let i = 0; i < numPoints; i++) {
      const dbVal = 20 * Math.log10(totalMag[i]);
      const x = i;
      const y = H / 2 - (dbVal / 18) * (H / 2 - 10);
      if (i === 0) ctx.moveTo(x, clamp(y, 5, H - 5));
      else ctx.lineTo(x, clamp(y, 5, H - 5));
    }
    // Fill below
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.closePath();
    ctx.fillStyle = fillGrad;
    ctx.fill();

    // Draw the line
    ctx.beginPath();
    for (let i = 0; i < numPoints; i++) {
      const dbVal = 20 * Math.log10(totalMag[i]);
      const x = i;
      const y = H / 2 - (dbVal / 18) * (H / 2 - 10);
      if (i === 0) ctx.moveTo(x, clamp(y, 5, H - 5));
      else ctx.lineTo(x, clamp(y, 5, H - 5));
    }
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Band dots
    bands.forEach((band) => {
      const x = freqToX(band.freq);
      const y = H / 2 - (band.gain / 18) * (H / 2 - 10);
      ctx.beginPath();
      ctx.arc(x, clamp(y, 8, H - 8), 6, 0, Math.PI * 2);
      ctx.fillStyle = band.color;
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.8)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });
  }, [bands]);

  useEffect(() => {
    draw();
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ width: "100%", height: `${height}px` }}
      className="rounded-xl"
    />
  );
};

// ─── Band Fader ───────────────────────────────────────────────────────────────
interface BandFaderProps {
  band: EQBand;
  onChange: (gain: number) => void;
}

const BandFader: React.FC<BandFaderProps> = ({ band, onChange }) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const gainToPercent = (g: number) => ((g + 18) / 36) * 100;
  const percentToGain = (p: number) => (p / 100) * 36 - 18;

  const handlePointerMove = useCallback((e: PointerEvent) => {
    if (!isDragging.current || !trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const rawY = e.clientY - rect.top;
    const pct = clamp(1 - rawY / rect.height, 0, 1) * 100;
    onChange(Math.round(percentToGain(pct) * 2) / 2); // 0.5dB steps
  }, [onChange]);

  const handlePointerUp = useCallback(() => {
    isDragging.current = false;
    document.removeEventListener("pointermove", handlePointerMove);
    document.removeEventListener("pointerup", handlePointerUp);
  }, [handlePointerMove]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    isDragging.current = true;
    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("pointerup", handlePointerUp);
    e.currentTarget.setPointerCapture(e.pointerId);
  }, [handlePointerMove, handlePointerUp]);

  const pct = gainToPercent(band.gain);
  const centerPct = gainToPercent(0); // = 50

  return (
    <div className="flex flex-col items-center gap-2 select-none">
      {/* Gain label */}
      <span
        className="text-[11px] font-bold tabular-nums"
        style={{ color: band.gain === 0 ? "#64748b" : band.color }}
      >
        {band.gain > 0 ? `+${band.gain}` : band.gain === 0 ? "0" : band.gain}
        <span className="text-[9px] font-normal opacity-70">dB</span>
      </span>

      {/* Fader track */}
      <div
        ref={trackRef}
        onPointerDown={handlePointerDown}
        className="relative w-8 cursor-ns-resize rounded-full"
        style={{ height: 140, background: "rgba(255,255,255,0.06)" }}
      >
        {/* Center line */}
        <div
          className="absolute left-0 right-0 h-px bg-white/20"
          style={{ top: `${100 - centerPct}%` }}
        />

        {/* Fill */}
        {band.gain !== 0 && (
          <div
            className="absolute left-1 right-1 rounded-full transition-all"
            style={{
              top: band.gain > 0 ? `${100 - pct}%` : `${100 - centerPct}%`,
              bottom: band.gain > 0 ? `${100 - centerPct}%` : `${pct}%`,
              background: `${band.color}60`,
            }}
          />
        )}

        {/* Thumb */}
        <div
          className="absolute left-1/2 -translate-x-1/2 w-6 h-4 rounded-md shadow-lg border border-white/20 flex items-center justify-center"
          style={{
            top: `calc(${100 - pct}% - 8px)`,
            background: band.gain === 0 ? "#334155" : band.color,
            boxShadow: `0 0 12px ${band.color}60`,
          }}
        >
          <div className="w-3 h-px bg-white/50 rounded" />
        </div>
      </div>

      {/* Freq label */}
      <div className="text-center">
        <div className="text-[10px] font-bold text-white/80">{band.label}</div>
        <div className="text-[9px] text-white/30">
          {band.freq >= 1000 ? `${band.freq / 1000}kHz` : `${band.freq}Hz`}
        </div>
      </div>

      {/* Reset dot */}
      <button
        onClick={() => onChange(0)}
        className="w-4 h-4 rounded-full bg-white/5 hover:bg-white/15 flex items-center justify-center transition-all"
        title="Reset to 0dB"
      >
        <RotateCcw className="w-2.5 h-2.5 text-white/30 hover:text-white/70 transition-colors" />
      </button>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
interface ProEQPageProps {
  initialAudioPath?: string | null;
}

export const ProEQPage: React.FC<ProEQPageProps> = ({ initialAudioPath }) => {
  const [bands, setBands] = useState<EQBand[]>(DEFAULT_BANDS);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [warmth, setWarmth] = useState(0);
  const [compEnabled, setCompEnabled] = useState(true);
  const [compThreshold, setCompThreshold] = useState(-20);
  const [compRatio, setCompRatio] = useState(3);
  const [isListening, setIsListening] = useState(false);
  const [inputLevel, setInputLevel] = useState(0);
  const [outputLevel, setOutputLevel] = useState(0);
  const [showCompressor, setShowCompressor] = useState(false);

  // ── File playback state
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackPos, setPlaybackPos] = useState(0);   // seconds elapsed
  const [isDragOver, setIsDragOver] = useState(false);
  const [fileLoadError, setFileLoadError] = useState<string | null>(null);
  const [isDecoding, setIsDecoding] = useState(false);
  const [effectEnabled, setEffectEnabled] = useState(true);    // EQ bypass toggle
  const [isExporting, setIsExporting] = useState(false);
  const [exportDone, setExportDone] = useState(false);
  const waveCanvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Web Audio refs
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const fileSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const filtersRef = useRef<BiquadFilterNode[]>([]);
  const compRef = useRef<DynamicsCompressorNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const analyserInRef = useRef<AnalyserNode | null>(null);
  const analyserOutRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  const playStartTimeRef = useRef(0);   // ctx.currentTime when play started
  const playOffsetRef = useRef(0);      // seconds offset into buffer

  // Update band gain
  const updateBand = useCallback((id: string, gain: number) => {
    setBands((prev) => prev.map((b) => (b.id === id ? { ...b, gain } : b)));
    setSelectedPreset(null);

    // Live update the Web Audio filter
    const idx = DEFAULT_BANDS.findIndex((b) => b.id === id);
    if (filtersRef.current[idx]) {
      filtersRef.current[idx].gain.setTargetAtTime(gain, audioCtxRef.current!.currentTime, 0.01);
    }
  }, []);

  // Apply preset
  const applyPreset = useCallback((preset: Preset) => {
    setSelectedPreset(preset.name);
    setWarmth(preset.warmth);
    setCompThreshold(preset.compressor.threshold);
    setCompRatio(preset.compressor.ratio);

    setBands((prev) =>
      prev.map((b, i) => ({ ...b, gain: preset.gains[i] ?? 0 }))
    );

    // Live update filters
    preset.gains.forEach((g, i) => {
      if (filtersRef.current[i]) {
        filtersRef.current[i].gain.setTargetAtTime(
          g,
          audioCtxRef.current?.currentTime ?? 0,
          0.02
        );
      }
    });

    if (compRef.current) {
      compRef.current.threshold.setTargetAtTime(
        preset.compressor.threshold,
        audioCtxRef.current?.currentTime ?? 0,
        0.02
      );
      compRef.current.ratio.setTargetAtTime(
        preset.compressor.ratio,
        audioCtxRef.current?.currentTime ?? 0,
        0.02
      );
    }
  }, []);

  // Level meter animation
  const animateMeters = useCallback(() => {
    if (!analyserInRef.current || !analyserOutRef.current) return;
    const bufIn = new Float32Array(analyserInRef.current.fftSize);
    const bufOut = new Float32Array(analyserOutRef.current.fftSize);
    analyserInRef.current.getFloatTimeDomainData(bufIn);
    analyserOutRef.current.getFloatTimeDomainData(bufOut);
    const rms = (buf: Float32Array) =>
      Math.sqrt(buf.reduce((acc, v) => acc + v * v, 0) / buf.length);
    setInputLevel(Math.min(1, rms(bufIn) * 8));
    setOutputLevel(Math.min(1, rms(bufOut) * 8));
    animFrameRef.current = requestAnimationFrame(animateMeters);
  }, []);

  // Start listening
  const startListening = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const ctx = new AudioContext({ sampleRate: 44100 });
      audioCtxRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      sourceRef.current = source;

      // Analyser in
      const analyserIn = ctx.createAnalyser();
      analyserIn.fftSize = 256;
      analyserInRef.current = analyserIn;

      // Create EQ filters chain
      const filters = bands.map((band) => {
        const f = ctx.createBiquadFilter();
        f.type = band.type;
        f.frequency.value = band.freq;
        f.gain.value = band.gain;
        f.Q.value = band.q;
        return f;
      });
      filtersRef.current = filters;

      // Compressor
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = compThreshold;
      comp.knee.value = 10;
      comp.ratio.value = compRatio;
      comp.attack.value = 0.005;
      comp.release.value = 0.25;
      compRef.current = comp;

      // Warmth gain (sub shelf simulation)
      const warmthGain = ctx.createBiquadFilter();
      warmthGain.type = "lowshelf";
      warmthGain.frequency.value = 200;
      warmthGain.gain.value = (warmth / 100) * 6;
      gainRef.current = ctx.createGain();
      gainRef.current.gain.value = 1.0;

      // Analyser out
      const analyserOut = ctx.createAnalyser();
      analyserOut.fftSize = 256;
      analyserOutRef.current = analyserOut;

      // Chain: source -> analyserIn -> filters -> comp -> warmth -> gain -> analyserOut -> dest
      source.connect(analyserIn);
      analyserIn.connect(filters[0]);
      for (let i = 0; i < filters.length - 1; i++) {
        filters[i].connect(filters[i + 1]);
      }
      filters[filters.length - 1].connect(compEnabled ? comp : warmthGain);
      if (compEnabled) comp.connect(warmthGain);
      warmthGain.connect(gainRef.current!);
      gainRef.current!.connect(analyserOut);
      // NOTE: not connecting to ctx.destination to avoid feedback

      animFrameRef.current = requestAnimationFrame(animateMeters);
      setIsListening(true);
    } catch (err) {
      console.error("Mic access error:", err);
    }
  };

  const stopListening = () => {
    cancelAnimationFrame(animFrameRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    audioCtxRef.current?.close();
    audioCtxRef.current = null;
    filtersRef.current = [];
    setInputLevel(0);
    setOutputLevel(0);
    setIsListening(false);
  };

  useEffect(() => () => stopListening(), []);

  // ── Build shared EQ chain nodes (reused for both mic and file playback)
  const buildChain = (ctx: AudioContext) => {
    const filters = bands.map((band) => {
      const f = ctx.createBiquadFilter();
      f.type = band.type;
      f.frequency.value = band.freq;
      f.gain.value = band.gain;
      f.Q.value = band.q;
      return f;
    });
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = compThreshold;
    comp.knee.value = 10;
    comp.ratio.value = compRatio;
    comp.attack.value = 0.005;
    comp.release.value = 0.25;
    const warmthFilter = ctx.createBiquadFilter();
    warmthFilter.type = "lowshelf";
    warmthFilter.frequency.value = 200;
    warmthFilter.gain.value = (warmth / 100) * 6;
    const gain = ctx.createGain();
    gain.gain.value = 1.0;
    const analyserIn = ctx.createAnalyser();
    analyserIn.fftSize = 256;
    const analyserOut = ctx.createAnalyser();
    analyserOut.fftSize = 256;
    // chain: analyserIn -> filters -> comp? -> warmth -> gain -> analyserOut
    analyserIn.connect(filters[0]);
    for (let i = 0; i < filters.length - 1; i++) filters[i].connect(filters[i + 1]);
    filters[filters.length - 1].connect(compEnabled ? comp : warmthFilter);
    if (compEnabled) comp.connect(warmthFilter);
    warmthFilter.connect(gain);
    gain.connect(analyserOut);
    return { filters, comp, warmthFilter, gain, analyserIn, analyserOut };
  };

  // ── Load audio file and decode
  const loadAudioFile = async (file: File) => {
    setFileLoadError(null);
    setIsDecoding(true);
    setAudioFile(file);
    stopFilePlayback();
    try {
      const arrayBuf = await file.arrayBuffer();
      const tmpCtx = new AudioContext();
      const decoded = await tmpCtx.decodeAudioData(arrayBuf);
      await tmpCtx.close();
      setAudioBuffer(decoded);
      drawWaveform(decoded);
    } catch {
      setFileLoadError("Cannot decode file. Please use MP3, WAV, OGG, or FLAC.");
      setAudioBuffer(null);
    } finally {
      setIsDecoding(false);
    }
  };

  // ── Draw waveform on canvas
  const drawWaveform = (buf: AudioBuffer) => {
    const canvas = waveCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    const data = buf.getChannelData(0);
    const step = Math.ceil(data.length / W);
    const grad = ctx.createLinearGradient(0, 0, W, 0);
    grad.addColorStop(0, "#f97316");
    grad.addColorStop(0.5, "#a78bfa");
    grad.addColorStop(1, "#60a5fa");
    ctx.strokeStyle = grad;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let i = 0; i < W; i++) {
      let min = 1, max = -1;
      for (let j = 0; j < step; j++) {
        const s = data[i * step + j] ?? 0;
        if (s < min) min = s;
        if (s > max) max = s;
      }
      const yLo = ((1 + min) / 2) * H;
      const yHi = ((1 + max) / 2) * H;
      ctx.moveTo(i, yLo);
      ctx.lineTo(i, yHi);
    }
    ctx.stroke();
  };

  // Redraw waveform when canvas mounts
  useEffect(() => {
    if (audioBuffer) drawWaveform(audioBuffer);
  }, [audioBuffer]);

  // ── Auto-load from initialAudioPath (from Recorded Library)
  useEffect(() => {
    if (!initialAudioPath) return;
    (async () => {
      try {
        // Convert OS path -> tauri asset URL so we can fetch it
        const url = convertFileSrc(initialAudioPath);
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const arrayBuf = await res.arrayBuffer();
        // Derive file name from path
        const parts = initialAudioPath.replace(/\\/g, "/").split("/");
        const name = parts[parts.length - 1] || "recording.wav";
        const file = new File([arrayBuf], name, { type: "audio/wav" });
        loadAudioFile(file);
      } catch (err) {
        console.error("Failed to load audio from path:", err);
      }
    })();
  }, [initialAudioPath]);

  // ── File playback
  const playFile = async () => {
    if (!audioBuffer) return;
    stopFilePlayback();
    if (isListening) stopListening();

    const ctx = new AudioContext({ sampleRate: audioBuffer.sampleRate });
    audioCtxRef.current = ctx;
    const { filters, comp, gain, analyserIn, analyserOut } = buildChain(ctx);
    filtersRef.current = filters;
    compRef.current = comp;
    gainRef.current = gain;
    analyserInRef.current = analyserIn;
    analyserOutRef.current = analyserOut;

    const src = ctx.createBufferSource();
    src.buffer = audioBuffer;
    src.connect(analyserIn);
    analyserOut.connect(ctx.destination);
    fileSourceRef.current = src;
    playStartTimeRef.current = ctx.currentTime;
    src.start(0, playOffsetRef.current);
    src.onended = () => {
      setIsPlaying(false);
      playOffsetRef.current = 0;
      setPlaybackPos(0);
    };
    setIsPlaying(true);
    animFrameRef.current = requestAnimationFrame(animateMeters);
    // Progress ticker
    const tick = () => {
      if (!audioCtxRef.current) return;
      const elapsed = playOffsetRef.current + (audioCtxRef.current.currentTime - playStartTimeRef.current);
      setPlaybackPos(Math.min(elapsed, audioBuffer.duration));
      if (elapsed < audioBuffer.duration) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  const pauseFile = () => {
    if (!audioCtxRef.current || !fileSourceRef.current) return;
    playOffsetRef.current += audioCtxRef.current.currentTime - playStartTimeRef.current;
    fileSourceRef.current.stop();
    fileSourceRef.current = null;
    cancelAnimationFrame(animFrameRef.current);
    audioCtxRef.current.close();
    audioCtxRef.current = null;
    setIsPlaying(false);
    setInputLevel(0);
    setOutputLevel(0);
  };

  const stopFilePlayback = () => {
    cancelAnimationFrame(animFrameRef.current);
    try { fileSourceRef.current?.stop(); } catch {}
    fileSourceRef.current = null;
    audioCtxRef.current?.close();
    audioCtxRef.current = null;
    filtersRef.current = [];
    playOffsetRef.current = 0;
    setIsPlaying(false);
    setPlaybackPos(0);
    setInputLevel(0);
    setOutputLevel(0);
  };

  const clearFile = () => {
    stopFilePlayback();
    setAudioFile(null);
    setAudioBuffer(null);
    setFileLoadError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  };

  // ── Drag-and-drop handlers
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) loadAudioFile(file);
  };

  // ── Effect bypass: smoothly mute/restore EQ gains in running chain
  useEffect(() => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    const t = ctx.currentTime;
    filtersRef.current.forEach((f, i) => {
      f.gain.setTargetAtTime(effectEnabled ? bands[i].gain : 0, t, 0.05);
    });
    if (compRef.current) {
      compRef.current.threshold.setTargetAtTime(effectEnabled ? compThreshold : 0, t, 0.05);
      compRef.current.ratio.setTargetAtTime(effectEnabled ? compRatio : 1, t, 0.05);
    }
  }, [effectEnabled]);

  // ── Export rendered audio with full EQ chain (OfflineAudioContext)
  const exportRendered = async () => {
    if (!audioBuffer) return;
    setIsExporting(true);
    setExportDone(false);
    try {
      const numCh = audioBuffer.numberOfChannels;
      const sr = audioBuffer.sampleRate;
      const len = audioBuffer.length;
      const offline = new OfflineAudioContext(numCh, len, sr);

      // Build EQ chain inside offline context
      const offFilters = bands.map((band) => {
        const f = offline.createBiquadFilter();
        f.type = band.type;
        f.frequency.value = band.freq;
        f.gain.value = effectEnabled ? band.gain : 0;
        f.Q.value = band.q;
        return f;
      });
      const offComp = offline.createDynamicsCompressor();
      offComp.threshold.value = effectEnabled ? compThreshold : 0;
      offComp.knee.value = 10;
      offComp.ratio.value = effectEnabled ? compRatio : 1;
      offComp.attack.value = 0.005;
      offComp.release.value = 0.25;
      const offWarmth = offline.createBiquadFilter();
      offWarmth.type = "lowshelf";
      offWarmth.frequency.value = 200;
      offWarmth.gain.value = effectEnabled ? (warmth / 100) * 6 : 0;

      // Chain: src -> filters -> comp -> warmth -> destination
      const offSrc = offline.createBufferSource();
      offSrc.buffer = audioBuffer;
      offSrc.connect(offFilters[0]);
      for (let i = 0; i < offFilters.length - 1; i++) offFilters[i].connect(offFilters[i + 1]);
      offFilters[offFilters.length - 1].connect(compEnabled ? offComp : offWarmth);
      if (compEnabled) offComp.connect(offWarmth);
      offWarmth.connect(offline.destination);
      offSrc.start(0);

      const rendered = await offline.startRendering();
      const blob = encodeWAV(rendered);
      const baseName = (audioFile?.name ?? "audio").replace(/\.[^.]+$/, "");
      const wavBytes = new Uint8Array(await blob.arrayBuffer());
      await AudioService.saveEqExport(`${baseName}_EQ_rendered.wav`, wavBytes);
      setExportDone(true);
      setTimeout(() => setExportDone(false), 3000);
    } catch (err) {
      console.error("Export error:", err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="pro-eq-root">
      {/* ── Header ── */}
      <div className="pro-eq-header">
        <div className="pro-eq-header-glow" />
        <div className="pro-eq-header-glow2" />
        <div className="pro-eq-header-content">
          <div>
            <div className="pro-eq-title-row">
              <span className="pro-eq-badge">PRO</span>
              <h1 className="pro-eq-title">Voice EQ Studio</h1>
            </div>
            <p className="pro-eq-subtitle">
              Podcast · Radio · Studio Vocal — Real-time parametric equalizer
            </p>
          </div>

          {/* Level Meters */}
          <div className="pro-eq-meters">
            <LevelMeter label="IN" level={inputLevel} color="#f97316" />
            <LevelMeter label="OUT" level={outputLevel} color="#a3e635" />
          </div>

          {/* Monitor Button */}
          <button
            onClick={isListening ? stopListening : startListening}
            className={`pro-eq-monitor-btn ${isListening ? "pro-eq-monitor-btn--active" : ""}`}
            id="eq-monitor-btn"
          >
            {isListening ? (
              <>
                <Square className="w-4 h-4 fill-current" />
                Stop Monitor
              </>
            ) : (
              <>
                <Mic className="w-4 h-4" />
                Monitor Mic
              </>
            )}
          </button>

          {/* EQ Effect Toggle */}
          <button
            onClick={() => setEffectEnabled(v => !v)}
            className={`pro-eq-effect-toggle ${effectEnabled ? "pro-eq-effect-toggle--on" : "pro-eq-effect-toggle--off"}`}
            id="eq-effect-toggle"
            title={effectEnabled ? "Bypass EQ (A/B compare)" : "Enable EQ"}
          >
            {effectEnabled
              ? <><Zap className="w-4 h-4" /> EQ ON</>
              : <><ZapOff className="w-4 h-4" /> BYPASS</>
            }
          </button>
        </div>
      </div>

      <div className="pro-eq-body">
        {/* ── File Loader ── */}
        <section className="pro-eq-section">
          <h2 className="pro-eq-section-title">
            <FolderOpen className="w-4 h-4" /> Load Audio File
          </h2>

          {/* Drop Zone */}
          {!audioFile && (
            <div
              className={`pro-eq-dropzone ${isDragOver ? "pro-eq-dropzone--over" : ""}`}
              onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              id="eq-file-dropzone"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                style={{ display: "none" }}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) loadAudioFile(f); }}
                id="eq-file-input"
              />
              <Upload className="w-8 h-8 pro-eq-dropzone-icon" />
              <div className="pro-eq-dropzone-text">
                <span>Drop audio file here or <strong>click to browse</strong></span>
                <span className="pro-eq-dropzone-hint">MP3 · WAV · OGG · FLAC · M4A</span>
              </div>
            </div>
          )}

          {/* File loaded — waveform + controls */}
          {audioFile && (
            <div className="pro-eq-file-loaded">
              {/* File info bar */}
              <div className="pro-eq-file-info">
                <FileAudio className="w-4 h-4 text-orange-400" />
                <span className="pro-eq-file-name">{audioFile.name}</span>
                {audioBuffer && (
                  <span className="pro-eq-file-dur">{formatTime(audioBuffer.duration)}</span>
                )}
                <button onClick={clearFile} className="pro-eq-file-clear" title="Remove file" id="eq-file-clear">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Waveform */}
              {isDecoding && (
                <div className="pro-eq-decoding">Decoding audio...</div>
              )}
              {fileLoadError && (
                <div className="pro-eq-file-error">{fileLoadError}</div>
              )}
              {audioBuffer && !isDecoding && (
                <div className="pro-eq-wave-wrap">
                  <canvas
                    ref={waveCanvasRef}
                    width={800}
                    height={64}
                    className="pro-eq-wave-canvas"
                  />
                  {/* playhead overlay */}
                  <div
                    className="pro-eq-playhead"
                    style={{ left: `${(playbackPos / audioBuffer.duration) * 100}%` }}
                  />
                </div>
              )}

              {/* Playback controls */}
              {audioBuffer && !isDecoding && (
                <div className="pro-eq-playback-controls">
                  <button
                    onClick={isPlaying ? pauseFile : playFile}
                    className="pro-eq-play-btn"
                    id="eq-play-btn"
                  >
                    {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
                    {isPlaying ? "Pause" : "Play"}
                  </button>

                  <button
                    onClick={stopFilePlayback}
                    className="pro-eq-stop-btn"
                    id="eq-stop-btn"
                    disabled={!isPlaying && playbackPos === 0}
                  >
                    <Square className="w-4 h-4 fill-current" />
                  </button>

                  {/* Time / Progress */}
                  <div className="pro-eq-progress-wrap">
                    <div className="pro-eq-progress-bar">
                      <div
                        className="pro-eq-progress-fill"
                        style={{ width: `${(playbackPos / audioBuffer.duration) * 100}%` }}
                      />
                    </div>
                    <span className="pro-eq-time">
                      {formatTime(playbackPos)} / {formatTime(audioBuffer.duration)}
                    </span>
                  </div>

                  {/* Load another file */}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="pro-eq-load-btn"
                    id="eq-load-another"
                  >
                    <FolderOpen className="w-3.5 h-3.5" /> Load file
                  </button>

                  {/* Export rendered WAV */}
                  <button
                    onClick={exportRendered}
                    disabled={isExporting || !audioBuffer}
                    className={`pro-eq-export-btn ${exportDone ? "pro-eq-export-btn--done" : ""}`}
                    id="eq-export-btn"
                  >
                    {isExporting ? (
                      <><span className="pro-eq-spin">⟳</span> Rendering...</>
                    ) : exportDone ? (
                      <><CheckCircle2 className="w-4 h-4" /> Saved!</>
                    ) : (
                      <><Download className="w-4 h-4" /> Export WAV</>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </section>

        {/* ── Presets ── */}
        <section className="pro-eq-section">
          <h2 className="pro-eq-section-title">
            <Star className="w-4 h-4" /> Presets
          </h2>
          <div className="pro-eq-presets">
            {PRESETS.map((p) => (
              <button
                key={p.name}
                onClick={() => applyPreset(p)}
                className={`pro-eq-preset-btn ${selectedPreset === p.name ? "pro-eq-preset-btn--active" : ""}`}
                style={
                  selectedPreset === p.name
                    ? {
                        borderColor: p.color,
                        background: `${p.color}18`,
                        boxShadow: `0 0 20px ${p.color}30`,
                      }
                    : {}
                }
                id={`preset-${p.name.toLowerCase().replace(/\s/g, "-")}`}
              >
                <span style={{ color: selectedPreset === p.name ? p.color : undefined }}>
                  {p.icon}
                </span>
                <div className="pro-eq-preset-info">
                  <span
                    className="pro-eq-preset-name"
                    style={{ color: selectedPreset === p.name ? p.color : undefined }}
                  >
                    {p.name}
                  </span>
                  <span className="pro-eq-preset-desc">{p.description}</span>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* ── EQ Visualizer ── */}
        <section className="pro-eq-section">
          <h2 className="pro-eq-section-title">
            <Activity className="w-4 h-4" /> EQ Curve
          </h2>
          <div className="pro-eq-visualizer-wrap">
            <EQVisualizer bands={bands} height={180} />
          </div>
        </section>

        {/* ── Band Faders ── */}
        <section className="pro-eq-section">
          <div className="pro-eq-faders-header">
            <h2 className="pro-eq-section-title">
              <Sliders className="w-4 h-4" /> Parametric EQ Bands
            </h2>
            <button
              onClick={() => {
                setBands(DEFAULT_BANDS.map((b) => ({ ...b, gain: 0 })));
                setSelectedPreset(null);
              }}
              className="pro-eq-reset-btn"
              id="eq-reset-all"
            >
              <RotateCcw className="w-3 h-3" /> Reset All
            </button>
          </div>
          <div className="pro-eq-faders">
            {bands.map((band) => (
              <BandFader key={band.id} band={band} onChange={(g) => updateBand(band.id, g)} />
            ))}
          </div>
        </section>

        {/* ── Warmth + Compressor ── */}
        <div className="pro-eq-bottom-grid">
          {/* Warmth */}
          <section className="pro-eq-section pro-eq-warmth-card">
            <h2 className="pro-eq-section-title">
              <Music2 className="w-4 h-4" /> Vocal Warmth
            </h2>
            <p className="pro-eq-param-desc">
              Adds low-frequency body and richness — makes voice sound fuller and more intimate.
            </p>
            <div className="pro-eq-warmth-row">
              <div className="pro-eq-warmth-icons">
                <span className="pro-eq-warmth-cold">❄</span>
                <span className="pro-eq-warmth-hot">🔥</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={warmth}
                onChange={(e) => setWarmth(Number(e.target.value))}
                className="pro-eq-warmth-slider"
                id="warmth-slider"
              />
              <span className="pro-eq-warmth-value">{warmth}%</span>
            </div>
            {/* Warmth bar visualization */}
            <div className="pro-eq-warmth-bar-track">
              <div
                className="pro-eq-warmth-bar-fill"
                style={{ width: `${warmth}%` }}
              />
            </div>
            <div className="pro-eq-warmth-labels">
              <span>Cool &amp; Crisp</span>
              <span>Neutral</span>
              <span>Rich &amp; Warm</span>
            </div>
          </section>

          {/* Compressor */}
          <section className="pro-eq-section pro-eq-comp-card">
            <button
              className="pro-eq-comp-header"
              onClick={() => setShowCompressor((v) => !v)}
              id="comp-toggle"
            >
              <h2 className="pro-eq-section-title" style={{ margin: 0 }}>
                <Volume2 className="w-4 h-4" /> Compressor
              </h2>
              <div className="pro-eq-comp-header-right">
                <div
                  className={`pro-eq-comp-toggle ${compEnabled ? "pro-eq-comp-toggle--on" : ""}`}
                  onClick={(e) => { e.stopPropagation(); setCompEnabled((v) => !v); }}
                  id="comp-enable"
                >
                  <div className="pro-eq-comp-toggle-thumb" />
                </div>
                <ChevronDown
                  className="w-4 h-4 text-white/40"
                  style={{ transform: showCompressor ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}
                />
              </div>
            </button>

            {showCompressor && (
              <div className="pro-eq-comp-body">
                <div className="pro-eq-comp-param">
                  <label>Threshold</label>
                  <div className="pro-eq-comp-slider-row">
                    <input
                      type="range"
                      min={-40}
                      max={0}
                      step={1}
                      value={compThreshold}
                      onChange={(e) => setCompThreshold(Number(e.target.value))}
                      className="pro-eq-comp-slider"
                      id="comp-threshold"
                    />
                    <span>{compThreshold}dB</span>
                  </div>
                </div>
                <div className="pro-eq-comp-param">
                  <label>Ratio</label>
                  <div className="pro-eq-comp-slider-row">
                    <input
                      type="range"
                      min={1}
                      max={20}
                      step={0.5}
                      value={compRatio}
                      onChange={(e) => setCompRatio(Number(e.target.value))}
                      className="pro-eq-comp-slider"
                      id="comp-ratio"
                    />
                    <span>{compRatio}:1</span>
                  </div>
                </div>
                <div className="pro-eq-comp-tip">
                  💡 Podcast: -18dB / 3:1 — Radio: -14dB / 5:1
                </div>
              </div>
            )}

            {!showCompressor && (
              <div className="pro-eq-comp-summary">
                <div className={`pro-eq-comp-dot ${compEnabled ? "pro-eq-comp-dot--on" : ""}`} />
                <span>
                  {compEnabled
                    ? `Active — ${compThreshold}dB threshold · ${compRatio}:1 ratio`
                    : "Disabled"}
                </span>
              </div>
            )}
          </section>
        </div>

        {/* Footer tip */}
        <div className="pro-eq-footer">
          <Zap className="w-3.5 h-3.5 text-amber-400" />
          <span>
            Tip: Click <strong>Monitor Mic</strong> to apply EQ in real-time while you speak.
            Drag faders up/down to sculpt your voice frequency response.
          </span>
        </div>
      </div>
    </div>
  );
};

// ─── Level Meter sub-component ────────────────────────────────────────────────
const LevelMeter: React.FC<{ label: string; level: number; color: string }> = ({
  label,
  level,
  color,
}) => {
  const bars = 12;
  return (
    <div className="pro-eq-meter">
      <span className="pro-eq-meter-label">{label}</span>
      <div className="pro-eq-meter-bars">
        {Array.from({ length: bars }).map((_, i) => {
          const threshold = i / bars;
          const lit = level >= threshold;
          const isClip = i >= bars - 2;
          return (
            <div
              key={i}
              className="pro-eq-meter-bar"
              style={{
                background: lit
                  ? isClip
                    ? "#ef4444"
                    : level > 0.7
                    ? "#fbbf24"
                    : color
                  : "rgba(255,255,255,0.06)",
                boxShadow: lit && !isClip ? `0 0 6px ${color}80` : undefined,
              }}
            />
          );
        })}
      </div>
    </div>
  );
};
