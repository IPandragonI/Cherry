import { Biquad } from "./biquad";
import { BandedMpm } from "./mpm";
import { DEFAULT_TRACKER_OPTIONS, PitchTracker, type TrackerOptions } from "./tracker";

export interface PitchReading {
  /** Smoothed frequency in Hz, or null when no stable pitch is heard. */
  frequency: number | null;
  rms: number;
}

export interface AnalyzerOptions {
  windowSize: number;
  hopSize: number;
  highpassHz: number;
  lowpassHz: number;
  /** Mains hum frequencies removed with narrow notches. */
  humHz: number[];
  /** A frame counts as sound when its level is this many times the noise floor… */
  minSignalToNoise: number;
  /** …and above this absolute RMS (−80 dBFS), so quiet desktop mics still work. */
  minRms: number;
  tracker?: Partial<TrackerOptions>;
}

export function defaultAnalyzerOptions(sampleRate: number): AnalyzerOptions {
  // ~85 ms windows at 48 kHz: ≥ 5 periods of a low C2 (65 Hz) for a reliable estimate.
  const windowSize = sampleRate > 32000 ? 4096 : 2048;
  return {
    windowSize,
    hopSize: windowSize / 4,
    highpassHz: 50,
    lowpassHz: 1000,
    humHz: [50, 60],
    minSignalToNoise: 3,
    minRms: 0.0001,
  };
}

/**
 * Streaming pitch analysis: filters incoming samples (high-pass, hum notches, low-pass),
 * gates on level relative to an adaptive noise floor, runs a band-limited McLeod Pitch
 * Method on a sliding window every `hopSize` samples and feeds the result to a
 * {@link PitchTracker}. Runs inside the AudioWorklet, and in tests on synthetic signals.
 */
export class PitchAnalyzer {
  private readonly options: AnalyzerOptions;
  private readonly detector: BandedMpm;
  private readonly filters: Biquad[];
  private readonly ring: Float32Array;
  private readonly window: Float32Array;
  private writeIndex = 0;
  private filled = 0;
  private sinceLast = 0;
  /** Slowly rising, quickly falling estimate of the background level. */
  private noiseFloor = 0.0002;
  readonly tracker: PitchTracker;

  constructor(
    private readonly sampleRate: number,
    options: Partial<AnalyzerOptions> = {},
  ) {
    this.options = { ...defaultAnalyzerOptions(sampleRate), ...options };
    const { windowSize, highpassHz, lowpassHz, humHz } = this.options;
    const tracker = { ...DEFAULT_TRACKER_OPTIONS, ...this.options.tracker };
    this.detector = new BandedMpm(
      windowSize,
      sampleRate,
      tracker.minFrequency,
      tracker.maxFrequency,
    );
    this.filters = [
      Biquad.highpass(sampleRate, highpassHz),
      ...humHz.map((hz) => Biquad.notch(sampleRate, hz)),
      Biquad.lowpass(sampleRate, lowpassHz),
      Biquad.lowpass(sampleRate, lowpassHz),
    ];
    this.ring = new Float32Array(windowSize);
    this.window = new Float32Array(windowSize);
    this.tracker = new PitchTracker(tracker);
  }

  /** Feeds samples; returns a reading for every completed hop (usually 0 or 1). */
  push(samples: Float32Array): PitchReading[] {
    const readings: PitchReading[] = [];
    const { windowSize, hopSize } = this.options;
    for (let i = 0; i < samples.length; i++) {
      let x = samples[i];
      for (const f of this.filters) x = f.process(x);
      this.ring[this.writeIndex] = x;
      this.writeIndex = (this.writeIndex + 1) % windowSize;
      if (this.filled < windowSize) this.filled++;
      if (++this.sinceLast >= hopSize && this.filled === windowSize) {
        this.sinceLast = 0;
        readings.push(this.analyze());
      }
    }
    return readings;
  }

  private analyze(): PitchReading {
    const { windowSize, minRms, minSignalToNoise } = this.options;
    const head = windowSize - this.writeIndex;
    this.window.set(this.ring.subarray(this.writeIndex), 0);
    this.window.set(this.ring.subarray(0, this.writeIndex), head);

    let sum = 0;
    for (let i = 0; i < windowSize; i++) sum += this.window[i] * this.window[i];
    const rms = Math.sqrt(sum / windowSize);

    const audible = rms >= minRms && rms >= this.noiseFloor * minSignalToNoise;
    // Track the background: follow quiet frames quickly, creep up slowly otherwise
    // (doubling takes ~10 s), so a sustained note never becomes "the floor".
    this.noiseFloor =
      rms < this.noiseFloor
        ? this.noiseFloor * 0.7 + rms * 0.3
        : Math.min(rms, this.noiseFloor * 1.0015);
    this.noiseFloor = Math.max(this.noiseFloor, 1e-5);

    const estimate = audible ? this.detector.estimate(this.window) : null;
    return {
      frequency: this.tracker.update(estimate ? { ...estimate, rms } : null),
      rms,
    };
  }
}
