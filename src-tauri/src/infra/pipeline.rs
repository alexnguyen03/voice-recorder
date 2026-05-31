use crate::infra::filters::{
    AudioFilter, BypassFilter,
    WindSuppressor, BreathSuppressor, PlosiveReducer,
    NoiseGate, MicEqFilter,
    BassShelfFilter, TrebleShelfFilter, MidCutFilter,
    SpectralDeHiss, FinalLimiter,
};

/// Full DSP processing pipeline as a Chain of Responsibility.
///
/// Pattern: Chain of Responsibility
///   Each filter in the chain processes the buffer independently.
///   DspPipeline knows nothing about concrete filter types — only AudioFilter.
///
/// SOLID:
///   O – open for extension: new filters added via DspPipelineBuilder without changing DspPipeline
///   D – depends on AudioFilter abstraction, not concrete implementations
pub struct DspPipeline {
    chain:    Vec<Box<dyn AudioFilter>>,
    channels: u16,
}

impl DspPipeline {
    /// Run all filter stages in sequence.
    /// Handles interleaved multi-channel audio correctly.
    pub fn process(&mut self, input: &[f32]) -> Vec<f32> {
        let mut buf = input.to_vec();
        for filter in &mut self.chain {
            buf = filter.process_interleaved(&buf, self.channels);
        }
        buf
    }

    /// Reset all filter states (useful between separate file sessions).
    pub fn reset_all(&mut self) {
        for filter in &mut self.chain { filter.reset(); }
    }
}

// ── Configuration struct ──────────────────────────────────────────────────────

/// All parameters needed to build a DspPipeline.
/// Flat struct — mirrors both the Tauri command signature and the TS VoiceEffectOptions.
#[derive(Debug, Clone)]
pub struct PipelineConfig {
    pub sample_rate:       f32,
    pub channels:          u16,
    // Noise & Wind
    pub wind_suppression:  bool,
    pub wind_intensity:    f32,
    pub noise_suppression: bool,
    pub noise_gate_sensitivity: f32,
    pub de_hiss_enabled:   bool,
    // Breath & Plosive
    pub reduce_breath:     bool,
    pub breath_sensitivity: f32,
    pub reduce_plosive:    bool,
    pub plosive_sensitivity: f32,
    // Mic EQ
    pub mic_eq_enhancement: bool,
    // EQ & Tone
    pub bass_boost:        f32,
    pub treble_boost:      f32,
    pub mid_cut_freq:      f32,
    pub mid_cut_q:         f32,
    pub mid_cut_gain_db:   f32,
    // Volume
    pub volume_boost:      f32,
}

impl Default for PipelineConfig {
    fn default() -> Self {
        Self {
            sample_rate:          44100.0,
            channels:             1,
            wind_suppression:     false,
            wind_intensity:       0.5,
            noise_suppression:    false,
            noise_gate_sensitivity: 0.5,
            de_hiss_enabled:      false,
            reduce_breath:        false,
            breath_sensitivity:   0.5,
            reduce_plosive:       false,
            plosive_sensitivity:  0.5,
            mic_eq_enhancement:   false,
            bass_boost:           0.5,
            treble_boost:         0.5,
            mid_cut_freq:         1500.0,
            mid_cut_q:            2.0,
            mid_cut_gain_db:      0.0,
            volume_boost:         0.5,
        }
    }
}

// ── Builder ───────────────────────────────────────────────────────────────────

/// Constructs a DspPipeline from a PipelineConfig.
///
/// Pattern: Builder
///   Fluent API for composing the filter chain.
///   Disabled stages are replaced with BypassFilter (Null Object) so the
///   chain length is constant and no branching occurs during processing.
///
/// SOLID:
///   O – new filter stages added as a new `with_xxx` method; nothing else changes
///   S – builder's only job is chain construction, not processing
pub struct DspPipelineBuilder {
    chain:    Vec<Box<dyn AudioFilter>>,
    config:   PipelineConfig,
}

impl DspPipelineBuilder {
    pub fn new(config: PipelineConfig) -> Self {
        Self { chain: Vec::new(), config }
    }

    // ── Stage 1: Wind Suppressor ──────────────────────────────────────────────
    pub fn with_wind_suppressor(mut self) -> Self {
        let f: Box<dyn AudioFilter> = if self.config.wind_suppression {
            Box::new(WindSuppressor::new(self.config.sample_rate, self.config.wind_intensity))
        } else {
            Box::new(BypassFilter)
        };
        self.chain.push(f);
        self
    }

    // ── Stage 2: Plosive Reducer ──────────────────────────────────────────────
    pub fn with_plosive_reducer(mut self) -> Self {
        let f: Box<dyn AudioFilter> = if self.config.reduce_plosive {
            Box::new(PlosiveReducer::new(self.config.sample_rate, self.config.plosive_sensitivity))
        } else {
            Box::new(BypassFilter)
        };
        self.chain.push(f);
        self
    }

    // ── Stage 3: Breath Suppressor ────────────────────────────────────────────
    pub fn with_breath_suppressor(mut self) -> Self {
        let f: Box<dyn AudioFilter> = if self.config.reduce_breath {
            Box::new(BreathSuppressor::new(self.config.sample_rate, self.config.breath_sensitivity))
        } else {
            Box::new(BypassFilter)
        };
        self.chain.push(f);
        self
    }

    // ── Stage 4: Mic EQ ───────────────────────────────────────────────────────
    pub fn with_mic_eq(mut self) -> Self {
        let f: Box<dyn AudioFilter> = if self.config.mic_eq_enhancement {
            Box::new(MicEqFilter::new(self.config.sample_rate))
        } else {
            Box::new(BypassFilter)
        };
        self.chain.push(f);
        self
    }

    // ── Stage 5: Noise Gate ───────────────────────────────────────────────────
    pub fn with_noise_gate(mut self) -> Self {
        let f: Box<dyn AudioFilter> = if self.config.noise_suppression {
            Box::new(NoiseGate::new(self.config.sample_rate, self.config.noise_gate_sensitivity))
        } else {
            Box::new(BypassFilter)
        };
        self.chain.push(f);
        self
    }

    // ── Stage 6: Bass Shelf ───────────────────────────────────────────────────
    pub fn with_bass_shelf(mut self) -> Self {
        self.chain.push(Box::new(BassShelfFilter::new(self.config.sample_rate, self.config.bass_boost)));
        self
    }

    // ── Stage 7: Treble Shelf ─────────────────────────────────────────────────
    pub fn with_treble_shelf(mut self) -> Self {
        self.chain.push(Box::new(TrebleShelfFilter::new(self.config.sample_rate, self.config.treble_boost)));
        self
    }

    // ── Stage 8: Mid Peaking Cut ──────────────────────────────────────────────
    pub fn with_mid_cut(mut self) -> Self {
        let f: Box<dyn AudioFilter> = if self.config.mid_cut_gain_db < 0.0 {
            Box::new(MidCutFilter::new(
                self.config.sample_rate,
                self.config.mid_cut_freq,
                self.config.mid_cut_q,
                self.config.mid_cut_gain_db,
            ))
        } else {
            Box::new(BypassFilter)
        };
        self.chain.push(f);
        self
    }

    // ── Stage 9: Spectral De-hiss ─────────────────────────────────────────────
    pub fn with_de_hiss(mut self) -> Self {
        let f: Box<dyn AudioFilter> = if self.config.de_hiss_enabled {
            Box::new(SpectralDeHiss::new(self.config.sample_rate))
        } else {
            Box::new(BypassFilter)
        };
        self.chain.push(f);
        self
    }

    // ── Stage 10: Final Limiter ───────────────────────────────────────────────
    pub fn with_final_limiter(mut self) -> Self {
        self.chain.push(Box::new(FinalLimiter::new(self.config.volume_boost)));
        self
    }

    /// Build the complete standard voice pipeline (all 10 stages, fixed order).
    pub fn build_standard(self) -> DspPipeline {
        let channels = self.config.channels;
        let pipeline = self
            .with_wind_suppressor()
            .with_plosive_reducer()
            .with_breath_suppressor()
            .with_mic_eq()
            .with_noise_gate()
            .with_bass_shelf()
            .with_treble_shelf()
            .with_mid_cut()
            .with_de_hiss()
            .with_final_limiter();
        DspPipeline { chain: pipeline.chain, channels }
    }

    /// Finalise the chain as built (for custom ordering / testing).
    pub fn build(self) -> DspPipeline {
        let channels = self.config.channels;
        DspPipeline { chain: self.chain, channels }
    }
}
