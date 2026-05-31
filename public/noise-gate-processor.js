/**
 * NoiseGateProcessor — AudioWorklet
 *
 * Mirrors the Rust LiveDspSession noise gate algorithm:
 *   - Separate fast attack (~2ms) / slow release (~150ms) envelope
 *   - Hysteresis: open_threshold (0.025) > close_threshold (0.010)
 *   - Smooth linear knee between close and open thresholds
 *   - Hold time (~80ms) prevents chopping syllable tails
 *
 * Communicates via MessagePort:
 *   { enabled: boolean }  — toggle gate on/off at any time
 */
class NoiseGateProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._enabled = false;
    this._envelope = 0;
    this._gateOpen = false;
    this._holdCounter = 0;
    // Default to 0.65 sensitivity → open≈0.015 (catches normal speech on weak mics)
    this._openThreshold  = 0.015;
    this._closeThreshold = 0.006;

    this.port.onmessage = (e) => {
      if (typeof e.data.enabled === 'boolean') {
        this._enabled = e.data.enabled;
        if (!this._enabled) {
          this._envelope = 0;
          this._gateOpen = false;
          this._holdCounter = 0;
        }
      }
      if (typeof e.data.sensitivity === 'number') {
        // Same mapping as Rust: 0.0→open=0.040, 0.5→open=0.012, 1.0→open=0.004
        const s = Math.max(0, Math.min(1, e.data.sensitivity));
        this._openThreshold  = 0.040 * (1 - s) + 0.004 * s;
        this._closeThreshold = this._openThreshold * 0.40;
      }
    };
  }

  process(inputs, outputs) {
    const input  = inputs[0];
    const output = outputs[0];

    if (!input || input.length === 0) return true;

    const sr = sampleRate;

    // Use instance thresholds (set by constructor defaults or sensitivity message)
    const openThreshold  = this._openThreshold;
    const closeThreshold = this._closeThreshold;
    const kneeWidth      = Math.max(0.001, openThreshold - closeThreshold);

    const attackCoef  = Math.exp(-1.0 / (0.002 * sr));
    const releaseCoef = Math.exp(-1.0 / (0.150 * sr));
    const holdSamples = Math.round(0.080 * sr);

    for (let ch = 0; ch < input.length; ch++) {
      const inCh  = input[ch];
      const outCh = output[ch];

      for (let i = 0; i < inCh.length; i++) {
        const sample = inCh[i];

        if (!this._enabled) {
          outCh[i] = sample;
          continue;
        }

        const abs = Math.abs(sample);

        if (abs > this._envelope) {
          this._envelope = attackCoef * this._envelope + (1 - attackCoef) * abs;
        } else {
          this._envelope = releaseCoef * this._envelope + (1 - releaseCoef) * abs;
        }

        if (this._gateOpen) {
          if (this._envelope < closeThreshold) {
            if (this._holdCounter > 0) {
              this._holdCounter--;
            } else {
              this._gateOpen = false;
            }
          } else {
            this._holdCounter = holdSamples;
          }
        } else if (this._envelope >= openThreshold) {
          this._gateOpen = true;
          this._holdCounter = holdSamples;
        }

        let gain;
        if (this._gateOpen) {
          gain = 1.0;
        } else if (this._envelope > closeThreshold) {
          gain = Math.min(1.0, (this._envelope - closeThreshold) / kneeWidth);
        } else {
          gain = 0.0;
        }

        outCh[i] = sample * gain;
      }
    }

    return true;
  }
}

registerProcessor('noise-gate-processor', NoiseGateProcessor);
