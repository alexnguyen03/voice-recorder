use super::{AudioFilter, biquad::one_pole_alpha};

/// Attenuates explosive plosive consonants (p, b, d) caused by the lack of a pop filter.
///
/// SRP: responsible only for plosive transient reduction.
///
/// Algorithm (dynamic transient-rate detection):
///   1. Track low-freq energy (< 200 Hz) with a fast envelope follower
///   2. Track the RATE of energy rise — a plosive produces a very steep rise
///      (> 20 dB/ms equivalent) concentrated in the low band
///   3. Dynamic attenuation: proportional to burst intensity so a gentle "b"
///      gets light treatment while a hard "p" close to the mic gets full reduction
///   4. `sensitivity` adjusts the burst-rate threshold
pub struct PlosiveReducer {
    /// One-pole low-band energy (below ~200 Hz via LP subtraction)
    lp_state:    f32,
    low_env:     f32,
    prev_env:    f32, // for rate detection
    /// Broadband envelope to distinguish plosive from general loudness
    broad_env:   f32,
    /// Smooth gain applied to the low band
    gain_env:    f32,
    lp_alpha:    f32,
    env_alpha:   f32,
    broad_alpha: f32,
    gain_attack:   f32,
    gain_release:  f32,
    /// Minimum low-band level to even consider plosive detection
    level_floor: f32,
    /// Rate threshold: energy growth per sample above which we call it a plosive
    rate_threshold: f32,
}

impl PlosiveReducer {
    /// `sensitivity` ∈ [0.0, 1.0]:
    ///   0 = only big hard plosive bursts treated
    ///   1 = sensitive — treats even soft plosives
    pub fn new(sample_rate: f32, sensitivity: f32) -> Self {
        let s = sensitivity.clamp(0.0, 1.0);
        // Rate threshold (energy/sample): s=0 → 0.0008 (big bursts only),
        //                                 s=1 → 0.0002 (catches soft plosives too)
        let rate_threshold = 0.0008 - s * 0.0006;
        // Minimum level to activate detector: s=0 → 0.07, s=1 → 0.04
        let level_floor    = 0.07 - s * 0.03;

        Self {
            lp_state:      0.0,
            low_env:       0.0,
            prev_env:      0.0,
            broad_env:     0.0,
            gain_env:      1.0,
            lp_alpha:      one_pole_alpha(180.0, sample_rate),
            env_alpha:     one_pole_alpha(30.0,  sample_rate),
            broad_alpha:   one_pole_alpha(20.0,  sample_rate),
            // Attack very fast (1 ms) to catch transient, release moderate (60 ms)
            gain_attack:   one_pole_alpha(1000.0, sample_rate),
            gain_release:  one_pole_alpha(17.0,   sample_rate),
            level_floor,
            rate_threshold,
        }
    }
}

impl AudioFilter for PlosiveReducer {
    fn process_sample(&mut self, sample: f32) -> f32 {
        // Low-band proxy (below ~180 Hz)
        self.lp_state += self.lp_alpha * (sample - self.lp_state);
        let low = self.lp_state;

        // Low-band envelope
        self.low_env += self.env_alpha * (low.abs() - self.low_env);
        // Broadband envelope
        self.broad_env += self.broad_alpha * (sample.abs() - self.broad_env);

        // Rate of rise in the low band (how fast is it spiking?)
        let rate = (self.low_env - self.prev_env).max(0.0);
        self.prev_env = self.low_env;

        // Plosive: low-band energy is prominent AND rising fast AND not just loud speech
        let low_dominant = self.low_env > self.broad_env * 0.75;
        let is_plosive   = self.low_env > self.level_floor
            && rate > self.rate_threshold
            && low_dominant;

        // Dynamic amount: scale by how much the burst exceeds the floor
        let burst_ratio = (self.low_env / self.level_floor.max(1e-6)).min(3.0);
        let amount = if is_plosive {
            (0.30 + (burst_ratio - 1.0) * 0.20).min(0.70)
        } else {
            // Light always-on DC bias protection (0.12) to tame very gentle pops
            0.12
        };

        let target_gain = 1.0 - amount;
        let alpha = if target_gain < self.gain_env { self.gain_attack } else { self.gain_release };
        self.gain_env += alpha * (target_gain - self.gain_env);

        // Apply gain only to the low band; pass high band unchanged
        let high = sample - low;
        (low * self.gain_env + high).clamp(-1.0, 1.0)
    }

    fn reset(&mut self) {
        self.lp_state  = 0.0;
        self.low_env   = 0.0;
        self.prev_env  = 0.0;
        self.broad_env = 0.0;
        self.gain_env  = 1.0;
    }

    fn name(&self) -> &'static str { "plosive_reducer" }
}
