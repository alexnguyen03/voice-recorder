use super::AudioFilter;

/// GateStrategy trait — Strategy Pattern for swappable gating algorithms.
///
/// OCP: new gating strategies extend this trait without modifying NoiseGate.
pub trait GateStrategy: Send + Sync {
    /// Given the current smoothed envelope, return a gain value [0.0, 1.0].
    fn compute_gain(&mut self, envelope: f32) -> f32;
    fn reset(&mut self);
}

/// Classic hysteresis gate with smooth knee.
/// Open threshold → close threshold hysteresis prevents rapid chatter.
pub struct HysteresisGate {
    open_threshold:  f32,
    close_threshold: f32,
    knee_width:      f32,
    gate_open:       bool,
    hold_counter:    i32,
    hold_samples:    i32,
}

impl HysteresisGate {
    /// `sensitivity` ∈ [0.0, 1.0]:
    ///   0.0 → open_threshold = 0.040 (only loud speech triggers gate)
    ///   0.5 → open_threshold = 0.012 (comfortable default)
    ///   1.0 → open_threshold = 0.004 (very sensitive — whispers pass through)
    pub fn new(sample_rate: f32, sensitivity: f32) -> Self {
        let s = sensitivity.clamp(0.0, 1.0);
        let open_threshold  = 0.040_f32 * (1.0 - s) + 0.004_f32 * s;
        let close_threshold = open_threshold * 0.40;
        let knee_width      = open_threshold - close_threshold;
        // Hold: keep gate open 80 ms after signal drops — avoids chopping syllable tails
        let hold_samples    = (0.080 * sample_rate) as i32;
        Self {
            open_threshold, close_threshold, knee_width,
            gate_open: false, hold_counter: 0, hold_samples,
        }
    }
}

impl GateStrategy for HysteresisGate {
    fn compute_gain(&mut self, envelope: f32) -> f32 {
        if self.gate_open {
            if envelope < self.close_threshold {
                if self.hold_counter > 0 { self.hold_counter -= 1; }
                else                     { self.gate_open = false; }
            } else {
                self.hold_counter = self.hold_samples;
            }
        } else if envelope >= self.open_threshold {
            self.gate_open    = true;
            self.hold_counter = self.hold_samples;
        }

        if self.gate_open {
            1.0
        } else if envelope > self.close_threshold {
            ((envelope - self.close_threshold) / self.knee_width.max(1e-6)).min(1.0)
        } else {
            0.0
        }
    }

    fn reset(&mut self) {
        self.gate_open    = false;
        self.hold_counter = 0;
    }
}

/// Noise gate — silences signal during quiet noise-only passages.
///
/// SRP: responsible only for gating (not EQ, not compression).
/// Pattern: Strategy — gating algorithm is injected and can be swapped.
pub struct NoiseGate {
    strategy:      Box<dyn GateStrategy>,
    envelope:      f32,
    attack_coef:   f32,
    release_coef:  f32,
}

impl NoiseGate {
    /// Create with the default HysteresisGate strategy.
    /// `sensitivity` ∈ [0.0, 1.0] — passed through to the strategy.
    pub fn new(sample_rate: f32, sensitivity: f32) -> Self {
        Self::with_strategy(
            sample_rate,
            Box::new(HysteresisGate::new(sample_rate, sensitivity)),
        )
    }

    /// Dependency-injection constructor — accepts any GateStrategy implementation.
    pub fn with_strategy(sample_rate: f32, strategy: Box<dyn GateStrategy>) -> Self {
        Self {
            strategy,
            envelope:     0.0,
            // attack ~2 ms, release ~150 ms — same as WaveformEditor AudioWorklet defaults
            attack_coef:  (-1.0_f32 / (0.002 * sample_rate)).exp(),
            release_coef: (-1.0_f32 / (0.150 * sample_rate)).exp(),
        }
    }
}

impl AudioFilter for NoiseGate {
    fn process_sample(&mut self, sample: f32) -> f32 {
        let abs = sample.abs();
        // Asymmetric envelope follower: fast attack, slow release
        if abs > self.envelope {
            self.envelope = self.attack_coef  * self.envelope + (1.0 - self.attack_coef)  * abs;
        } else {
            self.envelope = self.release_coef * self.envelope + (1.0 - self.release_coef) * abs;
        }
        sample * self.strategy.compute_gain(self.envelope)
    }

    fn reset(&mut self) {
        self.envelope = 0.0;
        self.strategy.reset();
    }

    fn name(&self) -> &'static str { "noise_gate" }
}
