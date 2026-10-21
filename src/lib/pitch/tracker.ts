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
  minClarity: number;
  minRms: number;
  /** Median window length (frames). */
  medianSize: number;
  /** Consecutive agreeing frames required before a pitch is reported. */
  lockFrames: number;
  /** Max spread (cents) between recent frames for them to "agree". */
  lockToleranceCents: number;
  /** A jump bigger than this (cents) is a new note: history restarts. */
  jumpCents: number;
  /** Invalid frames tolerated before the signal is declared lost. */
  holdFrames: number;
}

export const DEFAULT_TRACKER_OPTIONS: TrackerOptions = {
  minFrequency: 55,
  maxFrequency: 1200,
  minClarity: 0.9,
  minRms: 0.004,
  medianSize: 5,
  lockFrames: 3,
  lockToleranceCents: 20,
  jumpCents: 60,
  holdFrames: 8,
};

export function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Turns noisy per-frame pitch estimates into a steady reading: rejects unclear or quiet
 * frames, waits for a few agreeing frames before locking on (stability gate), smooths
 * with a running median, and holds the last value briefly through dropouts.
 */
export class PitchTracker {
  private readonly options: TrackerOptions;
  private history: number[] = [];
  private invalidFrames = 0;
  private locked = false;

  constructor(options: Partial<TrackerOptions> = {}) {
    this.options = { ...DEFAULT_TRACKER_OPTIONS, ...options };
  }

  /** Returns the smoothed frequency, or null when there is no stable pitch. */
  update(raw: RawPitch | null): number | null {
    const o = this.options;
    const valid =
      raw !== null &&
      raw.clarity >= o.minClarity &&
      raw.rms >= o.minRms &&
      raw.frequency >= o.minFrequency &&
      raw.frequency <= o.maxFrequency;

    if (!valid) {
      this.invalidFrames++;
      if (this.invalidFrames > o.holdFrames) this.reset();
      return this.locked ? median(this.history) : null;
    }
    this.invalidFrames = 0;

    if (this.history.length > 0) {
      const current = median(this.history);
      if (Math.abs(centsBetween(raw.frequency, current)) > o.jumpCents) this.reset();
    }
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
    return median(this.history);
  }

  reset(): void {
    this.history = [];
    this.invalidFrames = 0;
    this.locked = false;
  }
}
