import { Autocorrelator } from "pitchy";

export interface PitchEstimate {
  frequency: number;
  /** NSDF peak height, 0–1: how periodic the window is at that frequency. */
  clarity: number;
}

/**
 * McLeod Pitch Method restricted to a frequency band. Plain MPM (as in pitchy) searches
 * every lag, so when several strings ring together it can report their common period,
 * e.g. 27.5 Hz for A2 + E2, far below any guitar note. Searching only lags inside
 * [minFrequency, maxFrequency] keeps it on the string actually being played.
 */
export class BandedMpm {
  private readonly autocorrelator: Autocorrelator<Float32Array>;
  private readonly nsdf: Float32Array;
  private readonly minLag: number;
  private readonly maxLag: number;

  constructor(
    private readonly windowSize: number,
    private readonly sampleRate: number,
    minFrequency: number,
    maxFrequency: number,
    /** MPM "k": pick the first peak at least this fraction of the highest one. */
    private readonly peakThreshold = 0.8,
  ) {
    this.autocorrelator = Autocorrelator.forFloat32Array(windowSize);
    this.nsdf = new Float32Array(windowSize);
    this.minLag = Math.max(2, Math.floor(sampleRate / maxFrequency) - 1);
    this.maxLag = Math.min(windowSize - 2, Math.ceil(sampleRate / minFrequency) + 1);
  }

  estimate(input: Float32Array): PitchEstimate | null {
    const nsdf = this.nsdf;
    this.autocorrelator.autocorrelate(input, nsdf);
    // Normalised square difference: 2·r'(τ) / m'(τ), with m' updated incrementally.
    let m = 2 * nsdf[0];
    if (!(m > 0)) return null;
    const last = this.maxLag + 1;
    for (let i = 0; i <= last; i++) {
      nsdf[i] = m > 0 ? (2 * nsdf[i]) / m : 0;
      m -= input[i] ** 2 + input[this.windowSize - i - 1] ** 2;
    }

    // Key maxima: highest point between each upward and downward zero crossing.
    const peaks: number[] = [];
    let inLobe = false;
    let peak = -1;
    for (let i = 1; i <= last; i++) {
      if (nsdf[i - 1] <= 0 && nsdf[i] > 0) {
        inLobe = true;
        peak = i;
      } else if (inLobe && nsdf[i - 1] > 0 && nsdf[i] <= 0) {
        inLobe = false;
        if (peak >= this.minLag && peak <= this.maxLag) peaks.push(peak);
      } else if (inLobe && nsdf[i] > nsdf[peak]) {
        peak = i;
      }
    }
    if (inLobe && peak >= this.minLag && peak <= this.maxLag) peaks.push(peak);
    if (peaks.length === 0) return null;

    let highest = -Infinity;
    for (const p of peaks) highest = Math.max(highest, nsdf[p]);
    const chosen = peaks.find((p) => nsdf[p] >= this.peakThreshold * highest) ?? peaks[0];

    // Parabolic interpolation around the chosen peak for sub-sample precision.
    const y0 = nsdf[chosen - 1];
    const y1 = nsdf[chosen];
    const y2 = nsdf[chosen + 1];
    const a = (y0 + y2) / 2 - y1;
    const b = (y2 - y0) / 2;
    const shift = a < 0 ? -b / (2 * a) : 0;
    const lag = chosen + shift;
    const clarity = Math.min(1, a < 0 ? y1 - (b * b) / (4 * a) : y1);
    return lag > 0 ? { frequency: this.sampleRate / lag, clarity } : null;
  }
}
