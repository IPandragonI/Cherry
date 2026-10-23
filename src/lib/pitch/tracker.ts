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
  /** Median window length (frames): removes outliers. */
  medianSize: number;
  /** Moving average over this many successive medians: removes the remaining jitter. */
  averageSize: number;
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
  /**
   * Once the note has decayed below this fraction of its peak level, the value is frozen:
   * the quiet tail (and strings ringing along) only make it wander…
   */
  decayFreezeRatio: number;
  /** …unless the pitch moves further than this (cents): a peg being turned. */
  freezeBreakCents: number;
  /** EMA weight of the pitch-speed estimate. */
  trendAlpha: number;
  /** Steady pitch speed (cents per frame) at which the EMA becomes fully "moving". */
  movingSpeedCents: number;
  /** A pitch can only lock on within this many frames of {@link PitchTracker.arm}. */
  armFrames: number;
}

export const DEFAULT_TRACKER_OPTIONS: TrackerOptions = {
  minFrequency: 55,
  maxFrequency: 1200,
  minClarity: 0.7,
  sustainClarity: 0.55,
  minRms: 0.0001,
  medianSize: 7,
  averageSize: 3,
  lockFrames: 2,
  lockToleranceCents: 20,
  jumpCents: 35,
  confirmFrames: 3,
  holdFrames: 8,
  steadyAlpha: 0.08,
  movingAlpha: 0.7,
  movingCents: 20,
  decayFreezeRatio: 0.12,
  freezeBreakCents: 3,
  trendAlpha: 0.15,
  movingSpeedCents: 1.5,
  armFrames: Infinity,
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
  /** Recent medians, log2(Hz), for the moving average. */
  private medians: number[] = [];
  private invalidFrames = 0;
  private locked = false;
  /** Consecutive frames far from the current pitch, waiting to be confirmed as a new note. */
  private candidates: number[] = [];
  /** Smoothed pitch as log2(frequency), null until locked. */
  private smoothed: number | null = null;
  /** Smoothed signed pitch change per frame, log2 units (a peg being turned). */
  private trend = 0;
  private lastTarget: number | null = null;
  /** Following a real move while the note fades (the freeze is lifted until caught up). */
  private catchingUp = false;
  /** Loudest frame of the current note. */
  private peakRms = 0;
  /** Frames since the latest pluck. */
  private sinceAttack = Infinity;

  constructor(options: Partial<TrackerOptions> = {}) {
    this.options = { ...DEFAULT_TRACKER_OPTIONS, ...options };
  }

  /** A new pluck: the next pitch may lock on, and its level is measured afresh. */
  attack(): void {
    this.arm();
    this.peakRms = 0;
  }

  /** The level rose (maybe a quiet pluck): the next pitch may lock on. */
  arm(): void {
    this.sinceAttack = 0;
  }

  /** Returns the smoothed frequency, or null when there is no stable pitch. */
  update(raw: RawPitch | null): number | null {
    const o = this.options;
    this.sinceAttack++;
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

    const fading = this.locked && raw.rms < this.peakRms * o.decayFreezeRatio;
    this.peakRms = Math.max(this.peakRms, raw.rms);

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
      // Without a recent pluck it is background sound (a string ringing along, noise).
      if (this.sinceAttack > o.armFrames) return null;
      const recent = this.history.slice(-o.lockFrames);
      if (recent.length < o.lockFrames) return null;
      const center = median(recent);
      const spread = recent.every((f) => Math.abs(centsBetween(f, center)) <= o.lockToleranceCents);
      if (!spread) return null;
      this.locked = true;
    }

    // Median (outliers) → moving average of the medians (jitter) → adaptive EMA (display).
    this.medians.push(Math.log2(median(this.history)));
    if (this.medians.length > o.averageSize) this.medians.shift();
    const target = this.medians.reduce((a, b) => a + b, 0) / this.medians.length;
    // Signed speed of the pitch: steady in one direction while a peg is turned, while
    // random jitter goes both ways and averages out to almost nothing.
    if (this.lastTarget !== null) {
      this.trend += o.trendAlpha * (target - this.lastTarget - this.trend);
    }
    this.lastTarget = target;
    if (this.smoothed === null) {
      this.smoothed = target;
    } else if (
      fading &&
      !this.catchingUp &&
      Math.abs(target - this.smoothed) * 1200 < o.freezeBreakCents
    ) {
      // The note is dying out: keep the value it had rather than follow the wandering tail.
    } else {
      // A real move during the fade (a peg turned) is followed all the way, not only until
      // it is back within the freeze window.
      const gap = Math.abs(target - this.smoothed) * 1200;
      this.catchingUp = fading && gap >= 0.5;
      // Adaptive EMA (in the spirit of the 1€ filter): heavy smoothing for small jitter,
      // quick response when the pitch is far from the display or moving steadily (a peg
      // being turned), so the display does not lag behind the hand.
      const deviation = Math.min(
        1,
        Math.max(
          (Math.abs(target - this.smoothed) * 1200) / o.movingCents,
          (Math.abs(this.trend) * 1200) / o.movingSpeedCents,
        ),
      );
      const alpha = o.steadyAlpha + (o.movingAlpha - o.steadyAlpha) * deviation;
      this.smoothed += alpha * (target - this.smoothed);
    }
    return this.output();
  }

  /** The measurement became more precise: forget the values so far, but stay locked. */
  resettle(): void {
    this.history = [];
    this.medians = [];
    this.candidates = [];
    this.smoothed = null;
    this.trend = 0;
    this.lastTarget = null;
    this.catchingUp = false;
  }

  reset(): void {
    this.history = [];
    this.invalidFrames = 0;
    this.locked = false;
    this.smoothed = null;
    this.trend = 0;
    this.lastTarget = null;
    this.catchingUp = false;
    this.candidates = [];
    this.medians = [];
    this.peakRms = 0;
  }

  private output(): number | null {
    return this.locked && this.smoothed !== null ? 2 ** this.smoothed : null;
  }
}
