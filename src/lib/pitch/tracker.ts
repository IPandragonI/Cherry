import { centsBetween } from "../music/notes";

export interface RawPitch {
  frequency: number;
  /** MPM clarity, 0–1. */
  clarity: number;
  /** RMS level of the analysed window. */
  rms: number;
}

export interface TrackerOptions {
  minFrequency: number;
  maxFrequency: number;
  /** Clarity needed to lock onto a note. */
  minClarity: number;
  /** Lower clarity accepted once locked, so the decaying tail of a note keeps reading. */
  sustainClarity: number;
  minRms: number;
  /** Median window length (frames). */
  medianSize: number;
  /** Consecutive agreeing frames required before a pitch is reported. */
  lockFrames: number;
  /** Max spread (cents) between recent frames for them to "agree". */
  lockToleranceCents: number;
  /** A frame further than this (cents) from the current pitch is an outlier… */
  jumpCents: number;
  /** …unless this many consecutive outliers agree with each other: then it's a new note. */
  confirmFrames: number;
  /** Invalid frames tolerated before the signal is declared lost. */
  holdFrames: number;
  /** EMA weight of a new frame while the pitch is steady (heavier smoothing). */
  steadyAlpha: number;
  /** EMA weight once the pitch is clearly moving (e.g. turning a peg), to avoid lag. */
  movingAlpha: number;
  /** Deviation (cents) from the smoothed value at which the EMA becomes fully "moving". */
  movingCents: number;
}

export const DEFAULT_TRACKER_OPTIONS: TrackerOptions = {
  minFrequency: 55,
  maxFrequency: 1200,
  minClarity: 0.7,
  sustainClarity: 0.55,
  minRms: 0.0001,
  medianSize: 7,
  lockFrames: 3,
  lockToleranceCents: 20,
  jumpCents: 35,
  confirmFrames: 3,
  holdFrames: 8,
  steadyAlpha: 0.08,
  movingAlpha: 0.5,
  movingCents: 20,
};

export function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Turns noisy per-frame pitch estimates into a steady reading: rejects unclear or quiet
 * frames, waits for a few agreeing frames before locking on (stability gate), ignores
 * isolated outliers (a big jump only counts once several frames confirm it), smooths with
 * a running median and an adaptive exponential moving average in the log (cents) domain,
 * and holds the last value briefly through dropouts.
 */
export class PitchTracker {
  private readonly options: TrackerOptions;
  private history: number[] = [];
  private invalidFrames = 0;
  private locked = false;
  /** Consecutive frames far from the current pitch, waiting to be confirmed as a new note. */
  private candidates: number[] = [];
  /** Smoothed pitch as log2(frequency), null until locked. */
  private smoothed: number | null = null;

  constructor(options: Partial<TrackerOptions> = {}) {
    this.options = { ...DEFAULT_TRACKER_OPTIONS, ...options };
  }

  /** Returns the smoothed frequency, or null when there is no stable pitch. */
  update(raw: RawPitch | null): number | null {
    const o = this.options;
    const valid =
      raw !== null &&
      raw.clarity >= (this.locked ? o.sustainClarity : o.minClarity) &&
      raw.rms >= o.minRms &&
      raw.frequency >= o.minFrequency &&
      raw.frequency <= o.maxFrequency;

    if (!valid) {
      this.invalidFrames++;
      if (this.invalidFrames > o.holdFrames) this.reset();
      return this.output();
    }
    this.invalidFrames = 0;

    if (this.history.length > 0) {
      const current = median(this.history);
      if (Math.abs(centsBetween(raw.frequency, current)) > o.jumpCents) {
        const candidates = [...this.candidates, raw.frequency];
        const center = median(candidates);
        const agree = candidates.every(
          (f) => Math.abs(centsBetween(f, center)) <= o.lockToleranceCents,
        );
        this.candidates = agree ? candidates : [raw.frequency];
        if (this.candidates.length < o.confirmFrames) return this.output();
        // Confirmed: a new note (or a big retune). Restart from the agreeing frames.
        const confirmed = this.candidates;
        this.reset();
        this.history = confirmed;
        this.locked = true;
        this.smoothed = Math.log2(median(confirmed));
        return this.output();
      }
    }
    this.candidates = [];
    this.history.push(raw.frequency);
    if (this.history.length > o.medianSize) this.history.shift();

    if (!this.locked) {
      const recent = this.history.slice(-o.lockFrames);
      if (recent.length < o.lockFrames) return null;
      const center = median(recent);
      const spread = recent.every((f) => Math.abs(centsBetween(f, center)) <= o.lockToleranceCents);
      if (!spread) return null;
      this.locked = true;
    }

    const target = Math.log2(median(this.history));
    if (this.smoothed === null) {
      this.smoothed = target;
    } else {
      // Adaptive EMA (in the spirit of the 1€ filter): heavy smoothing for small jitter,
      // quicker response when the string is actually being retuned.
      const deviation = Math.min(1, (Math.abs(target - this.smoothed) * 1200) / o.movingCents);
      const alpha = o.steadyAlpha + (o.movingAlpha - o.steadyAlpha) * deviation;
      this.smoothed += alpha * (target - this.smoothed);
    }
    return this.output();
  }

  reset(): void {
    this.history = [];
    this.invalidFrames = 0;
    this.locked = false;
    this.smoothed = null;
    this.candidates = [];
  }

  private output(): number | null {
    return this.locked && this.smoothed !== null ? 2 ** this.smoothed : null;
  }
}
