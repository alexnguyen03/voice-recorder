import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Mic, Speaker, Play, Square, Wand2, Activity, Settings2 } from "lucide-react";

interface DeviceList {
  inputs: string[];
  outputs: string[];
}

export const LiveMicStudio: React.FC = () => {
  const [devices, setDevices] = useState<DeviceList>({ inputs: [], outputs: [] });
  const [selectedInput, setSelectedInput] = useState<string>("");
  const [selectedOutput, setSelectedOutput] = useState<string>("");
  
  const [isLive, setIsLive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [noiseSuppression, setNoiseSuppression] = useState(true);
  const [micEqEnhancement, setMicEqEnhancement] = useState(true);
  const [bass, setBass] = useState(0.5);
  const [treble, setTreble] = useState(0.5);
  const [volume, setVolume] = useState(0.5);

  useEffect(() => {
    fetchDevices();
  }, []);

  useEffect(() => {
    if (isLive) {
      invoke("update_live_filters", {
        filters: {
          enable_noise_suppression: noiseSuppression,
          bass_boost: bass,
          treble_boost: treble,
          volume_boost: volume,
          mic_eq_enhancement: micEqEnhancement,
        }
      }).catch(console.error);
    }
  }, [noiseSuppression, micEqEnhancement, bass, treble, volume, isLive]);

  const fetchDevices = async () => {
    try {
      const devs: DeviceList = await invoke("get_live_audio_devices");
      setDevices(devs);
      if (devs.inputs.length > 0 && !selectedInput) setSelectedInput(devs.inputs[0]);
      // Auto-select VB-Cable if found, otherwise first output
      if (devs.outputs.length > 0 && !selectedOutput) {
        const cable = devs.outputs.find(d => d.toLowerCase().includes("cable"));
        setSelectedOutput(cable || devs.outputs[0]);
      }
    } catch (err) {
      setError(String(err));
    }
  };

  const toggleLive = async () => {
    setError(null);
    try {
      if (isLive) {
        await invoke("stop_live_mic");
        setIsLive(false);
      } else {
        await invoke("start_live_mic", {
          config: { input_device: selectedInput, output_device: selectedOutput },
          filters: {
            enable_noise_suppression: noiseSuppression,
            bass_boost: bass,
            treble_boost: treble,
            volume_boost: volume,
            mic_eq_enhancement: micEqEnhancement,
          }
        });
        setIsLive(true);
      }
    } catch (err) {
      setError(String(err));
      setIsLive(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 overflow-y-auto">
      {/* Header */}
      <div className="flex flex-col p-6 bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
        <div className="absolute -right-10 -top-10 w-40 h-40 bg-violet-500/10 rounded-full blur-3xl pointer-events-none" />
        <h1 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-2">
          <Activity className="w-6 h-6 text-violet-500" />
          Virtual Mic Studio
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium">
          Route your filtered voice to Discord, Zoom, or Meet in real-time.
        </p>
      </div>

      <div className="p-6 max-w-3xl w-full mx-auto space-y-6">
        
        {/* Device Selection */}
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-5 space-y-4">
          <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2 uppercase tracking-wide">
            <Settings2 className="w-4 h-4" /> Routing Setup
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Mic className="w-3.5 h-3.5" /> Physical Microphone
              </label>
              <select 
                value={selectedInput}
                onChange={e => setSelectedInput(e.target.value)}
                disabled={isLive}
                className="w-full text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-50"
              >
                {devices.inputs.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Speaker className="w-3.5 h-3.5" /> Virtual Cable (Output)
              </label>
              <select 
                value={selectedOutput}
                onChange={e => setSelectedOutput(e.target.value)}
                disabled={isLive}
                className="w-full text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-50"
              >
                {devices.outputs.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>
          
          {/* Status / Start Button */}
          <div className="pt-2">
            <button
              onClick={toggleLive}
              className={`w-full flex items-center justify-center gap-2 py-3 rounded-lg font-bold text-sm transition-all active:scale-[0.98] ${
                isLive 
                  ? "bg-rose-500 hover:bg-rose-600 text-white shadow-lg shadow-rose-500/20" 
                  : "bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-500/20"
              }`}
            >
              {isLive ? <Square className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
              {isLive ? "STOP STREAMING" : "START VIRTUAL MIC"}
            </button>
            {error && <p className="mt-2 text-xs font-medium text-rose-500 bg-rose-50 dark:bg-rose-500/10 p-2 rounded-md">{error}</p>}
          </div>
        </div>

        {/* Live Filters */}
        <div className={`transition-opacity duration-300 ${!isLive ? 'opacity-60 grayscale-[0.2]' : ''}`}>
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-5 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2 uppercase tracking-wide">
                <Wand2 className="w-4 h-4" /> Live Filters
              </h2>
              {isLive && (
                <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold tracking-wider animate-pulse">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div> ON AIR
                </span>
              )}
            </div>

            {/* Toggles */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors">
                <input type="checkbox" checked={noiseSuppression} onChange={e => setNoiseSuppression(e.target.checked)} className="w-4 h-4 accent-violet-500" />
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Noise Gate</span>
                  <span className="text-[10px] text-slate-400">Silences background static</span>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors">
                <input type="checkbox" checked={micEqEnhancement} onChange={e => setMicEqEnhancement(e.target.checked)} className="w-4 h-4 accent-violet-500" />
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Low Quality Mic Fix</span>
                  <span className="text-[10px] text-slate-400">Cuts 85Hz rumble & hum</span>
                </div>
              </label>
            </div>

            {/* EQ Sliders */}
            <div className="space-y-4 pt-2">
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Bass Boost</label>
                  <span className="text-[10px] font-bold text-violet-500">{bass > 0.5 ? `+${Math.round((bass - 0.5)*30)}dB` : bass < 0.5 ? `${Math.round((bass - 0.5)*30)}dB` : 'Flat'}</span>
                </div>
                <input type="range" min="0" max="1" step="0.025" value={bass} onChange={e => setBass(Number(e.target.value))} className="w-full accent-violet-500 cursor-pointer h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full appearance-none" />
              </div>
              
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Treble Boost</label>
                  <span className="text-[10px] font-bold text-violet-500">{treble > 0.5 ? `+${Math.round((treble - 0.5)*30)}dB` : treble < 0.5 ? `${Math.round((treble - 0.5)*30)}dB` : 'Flat'}</span>
                </div>
                <input type="range" min="0" max="1" step="0.025" value={treble} onChange={e => setTreble(Number(e.target.value))} className="w-full accent-violet-500 cursor-pointer h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full appearance-none" />
              </div>
              
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Volume Gain</label>
                  <span className="text-[10px] font-bold text-violet-500">{volume > 0.5 ? `${(1.0 + (volume - 0.5)*6).toFixed(1)}x` : volume < 0.5 ? `${(0.25 + (volume/0.5)*0.75).toFixed(1)}x` : '1x'}</span>
                </div>
                <input type="range" min="0" max="1" step="0.025" value={volume} onChange={e => setVolume(Number(e.target.value))} className="w-full accent-violet-500 cursor-pointer h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full appearance-none" />
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
