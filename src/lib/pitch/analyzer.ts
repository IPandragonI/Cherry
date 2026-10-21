import { PitchDetector } from "pitchy";
import { Biquad } from "./biquad";
import { PitchTracker, type TrackerOptions } from "./tracker";

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
  tracker?: Partial<TrackerOptions>;
}

export function defaultAnalyzerOptions(sampleRate: number): AnalyzerOptions {
  // ~85 ms windows at 48 kHz: ≥ 5 periods of a low C2 (65 Hz) for a reliable estimate.
  const windowSize = sampleRate > 32000 ? 4096 : 2048;
  return { windowSize, hopSize: windowSize / 4, highpassHz: 60, lowpassHz: 1000 };
}

/**
 * Streaming pitch analysis: band-pass filters incoming samples, runs the McLeod Pitch
 * Method (pitchy) on a sliding window every `hopSize` samples and feeds the result to a
 * {@link PitchTracker}. Runs inside the AudioWorklet, and in tests on synthetic signals.
 */
export class PitchAnalyzer {
  private readonly options: AnalyzerOptions;
  private readonly detector: PitchDetector<Float32Array>;
  private readonly filters: Biquad[];
  private readonly ring: Float32Array;
  private readonly window: Float32Array;
  private writeIndex = 0;
  private filled = 0;
  private sinceLast = 0;
  readonly tracker: PitchTracker;

  constructor(
    private readonly sampleRate: number,
    options: Partial<AnalyzerOptions> = {},
  ) {
    this.options = { ...defaultAnalyzerOptions(sampleRate), ...options };
    const { windowSize, highpassHz, lowpassHz } = this.options;
    this.detector = PitchDetector.forFloat32Array(windowSize);
    this.detector.minVolumeDecibels = -60;
    this.filters = [
      Biquad.highpass(sampleRate, highpassHz),
      Biquad.lowpass(sampleRate, lowpassHz),
      Biquad.lowpass(sampleRate, lowpassHz),
    ];
    this.ring = new Float32Array(windowSize);
    this.window = new Float32Array(windowSize);
    this.tracker = new PitchTracker(this.options.tracker);
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
    const { windowSize } = this.options;
    const head = windowSize - this.writeIndex;
    this.window.set(this.ring.subarray(this.writeIndex), 0);
    this.window.set(this.ring.subarray(0, this.writeIndex), head);

    let sum = 0;
    for (let i = 0; i < windowSize; i++) sum += this.window[i] * this.window[i];
    const rms = Math.sqrt(sum / windowSize);

    const [frequency, clarity] = this.detector.findPitch(this.window, this.sampleRate);
    const valid = Number.isFinite(frequency) && frequency > 0;
    return {
      frequency: this.tracker.update(valid ? { frequency, clarity, rms } : null),
      rms,
    };
  }
}
