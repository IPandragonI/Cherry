import FFT from "fft.js";

export interface PartialEstimate {
  /** Harmonic number (1 = fundamental). */
  harmonic: number;
  /** Measured frequency of that partial, Hz. */
  frequency: number;
  magnitude: number;
  /** Peak magnitude over the local noise floor of the spectrum. */
  snr: number;
}

export interface RefinedPitch {
  frequency: number;
  /** Number of partials that agree on it. */
  support: number;
  /** Fraction of the partials found that agree (a real note's partials all line up). */
  agreement: number;
}

export interface RefinerOptions {
  /** Highest harmonic considered. Low partials are the least affected by string stiffness. */
  maxHarmonic: number;
  /** Partials above this frequency are ignored. */
  maxFrequency: number;
  /** Search window around k·f0, in cents. */
  searchCents: number;
  /** A partial must be at least this fraction of the strongest one to be used. */
  minRelativeMagnitude: number;
  /** Partials disagreeing with the consensus by more than this (cents) are dropped. */
  outlierCents: number;
}

/** How far the stiffness fit may land from the low-partial estimate. */
const MAX_STIFFNESS_CENTS = 3;

/** Width (cents) of the fall-off used to find the centre of the partials. */
const CENTER_WIDTH = 4;
/** Width (cents) of the fall-off of a partial's influence on the value. */
const OUTLIER_WIDTH = 3;

const DEFAULTS: RefinerOptions = {
  maxHarmonic: 6,
  maxFrequency: 1600,
  searchCents: 60,
  minRelativeMagnitude: 0.05,
  outlierCents: 3,
};

/**
 * Precise fundamental frequency from a coarse estimate, the way precision tuners do it:
 * each of the first harmonics is located in a Hann-windowed spectrum and its exact
 * frequency is measured from its phase advance between the current frame and one up to
 * `size` samples older (phase vocoder over a long interval: noise in the phase is divided
 * by that interval, so it stays well under a cent even for a quiet low E). The fundamental is the weighted
 * consensus of partial/harmonic-number, favouring low and strong partials; partials that
 * disagree (e.g. an open string ringing along on the same frequency) are discarded.
 *
 * Unlike time-domain period detection, other strings ringing along show up as separate
 * spectral lines and cannot drag the estimate.
 */
export class PartialRefiner {
  private readonly fft: FFT;
  private readonly hann: Float32Array;
  private readonly input: Float32Array;
  private readonly spectrum: number[];
  /** Recent spectra (bins of interest only), newest at `head`, one hop apart. */
  private readonly history: Float64Array[];
  private head = -1;
  /** Frames analysed since the last reset (a pluck); see `partialFrequency`. */
  private count = 0;
  /** Longest phase-comparison interval, in hops (one full window). */
  private readonly maxLag: number;
  private readonly maxBin: number;
  private readonly options: RefinerOptions;

  constructor(
    readonly size: number,
    private readonly sampleRate: number,
    private readonly hop: number,
    options: Partial<RefinerOptions> = {},
  ) {
    this.options = { ...DEFAULTS, ...options };
    this.fft = new FFT(size);
    this.hann = Float32Array.from(
      { length: size },
      (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / size),
    );
    this.input = new Float32Array(size);
    this.spectrum = this.fft.createComplexArray();
    this.maxLag = Math.max(1, Math.round(size / hop));
    const span = 2 ** (this.options.searchCents / 1200);
    this.maxBin = Math.min(
      size / 2 - 1,
      Math.ceil((this.options.maxFrequency * span * size) / sampleRate) + 2,
    );
    this.history = Array.from(
      { length: this.maxLag + 1 },
      () => new Float64Array(2 * (this.maxBin + 1)),
    );
  }

  /** Must be called once per hop, with the newest `size` samples, to keep phases aligned. */
  analyse(frame: Float32Array): void {
    for (let i = 0; i < this.size; i++) this.input[i] = frame[i] * this.hann[i];
    this.fft.realTransform(this.spectrum, this.input);
    this.head = (this.head + 1) % this.history.length;
    const slot = this.history[this.head];
    for (let i = 0; i < slot.length; i++) slot[i] = this.spectrum[i];
    this.count++;
  }

  /** The current spectrum lies entirely after the last reset (no previous note in it) and
   *  phases can be compared over at least half a window, for full precision. */
  get ready(): boolean {
    return this.count > this.maxLag + this.maxLag / 2;
  }

  /** Start a new note: older frames must not be compared with the new one. */
  reset(): void {
    this.count = 0;
  }

  /** Measured partials of a note whose fundamental is near `coarse` Hz. */
  partials(coarse: number): PartialEstimate[] {
    const o = this.options;
    const binHz = this.sampleRate / this.size;
    const span = 2 ** (o.searchCents / 1200);
    const found: PartialEstimate[] = [];
    for (let k = 1; k <= o.maxHarmonic; k++) {
      const target = k * coarse;
      if (target > o.maxFrequency) break;
      const lo = Math.max(1, Math.floor(target / span / binHz));
      const hi = Math.min(this.size / 2 - 2, Math.ceil((target * span) / binHz));
      let peak = -1;
      let peakMag = 0;
      for (let b = lo; b <= hi; b++) {
        const m = this.magnitude(this.spectrum, b);
        if (
          m > peakMag &&
          m >= this.magnitude(this.spectrum, b - 1) &&
          m >= this.magnitude(this.spectrum, b + 1)
        ) {
          peak = b;
          peakMag = m;
        }
      }
      if (peak < 0) continue;
      const frequency = this.partialFrequency(peak, binHz);
      if (Math.abs(1200 * Math.log2(frequency / target)) <= o.searchCents) {
        found.push({
          harmonic: k,
          frequency,
          magnitude: peakMag,
          snr: peakMag / this.noiseNear(peak),
        });
      }
    }
    const strongest = Math.max(0, ...found.map((p) => p.magnitude));
    return found.filter((p) => p.magnitude >= strongest * o.minRelativeMagnitude);
  }

  /** Precise fundamental, or null if no usable partial was found. */
  refine(coarse: number): RefinedPitch | null {
    const partials = this.partials(coarse);
    if (partials.length === 0) return null;
    // Inverse-variance weights: a partial's frequency error shrinks with its SNR, and
    // dividing by k shrinks it k times more for the fundamental. (The slight sharpness of
    // upper partials on a stiff string is corrected by `fitStiffness` below.)
    const weighted = partials.map((p) => ({
      partial: p,
      f0: p.frequency / p.harmonic,
      w: (p.snr * p.harmonic) ** 2,
    }));
    const cents = (f: number, ref: number) => 1200 * Math.log2(f / ref);
    // Robust centre: from the weighted median, a few rounds of an average whose weights
    // fade with distance. It settles on the same value whichever partial the median
    // started from, so the reading cannot flip between partial sets frame to frame.
    const start = weightedMedian(weighted);
    let center = start;
    for (let round = 0; round < 4; round++) {
      center = logMean(
        weighted.map((p) => ({ f0: p.f0, w: p.w * softness(cents(p.f0, center), CENTER_WIDTH) })),
      );
    }

    // Confidence (not the value): partials within a few cents of the weighted median — a
    // real partial value, which (unlike the soft centre) cannot drift towards a cluster of
    // stray partials from strings ringing along once the played note has faded.
    const support = weighted.filter(
      (p) => Math.abs(cents(p.f0, start)) <= this.options.outlierCents,
    ).length;
    const agreement = support / partials.length;
    if (support === 0) return { frequency: center, support: 1, agreement: 0 };

    // Soft membership: a partial's influence fades smoothly with its distance from the
    // centre (e.g. a body resonance pulling the fundamental a few cents from the other
    // partials) instead of switching on and off at a threshold, which made the reading
    // oscillate. Partials far off (another string's partial) get no say at all.
    const soft = weighted
      .map((p) => ({ ...p, s: softness(cents(p.f0, center), OUTLIER_WIDTH) }))
      .filter((p) => p.s > 0);

    // Estimate dominated by the fundamental and 2nd partial: barely touched by string
    // stiffness (upper partials of a real string run sharp), so it anchors the result.
    const low = logMean(
      soft.map((p) => ({ f0: p.f0, w: p.s * (p.partial.snr / p.partial.harmonic) ** 2 })),
    );
    // The stiffness fit uses every partial for precision and removes their sharpness. If
    // it strays from the low-partial estimate, it is amplifying noise (e.g. a body
    // resonance nudging one partial) and the low-partial estimate is used instead.
    const near = (f: number) => Math.abs(cents(f, low)) <= MAX_STIFFNESS_CENTS;
    const stiffness = fitStiffness(soft.map((p) => ({ partial: p.partial, scale: p.s })));
    if (stiffness && near(stiffness)) return { frequency: stiffness, support, agreement };
    // No usable fit: the most precise average (all partials, inverse-variance weights),
    // as long as it agrees with the anchor too.
    const precise = logMean(soft.map((p) => ({ f0: p.f0, w: p.w * p.s })));
    return { frequency: near(precise) ? precise : low, support, agreement };
  }

  /** Median magnitude of the bins around a peak (excluding the peak's main lobe). */
  private noiseNear(bin: number): number {
    const values: number[] = [];
    for (let b = bin - 12; b <= bin + 12; b++) {
      if (Math.abs(b - bin) > 3 && b > 0 && b < this.size / 2) {
        values.push(this.magnitude(this.spectrum, b));
      }
    }
    values.sort((a, b) => a - b);
    return Math.max(values[values.length >> 1] ?? 0, 1e-9);
  }

  private magnitude(spec: number[], bin: number): number {
    const re = spec[2 * bin];
    const im = spec[2 * bin + 1];
    return Math.sqrt(re * re + im * im);
  }

  /** Phase-vocoder frequency of the partial peaking at `bin`; falls back to interpolation. */
  private partialFrequency(bin: number, binHz: number): number {
    const interpolated = this.interpolate(bin) * binHz;
    // A frame belongs to the current note only once its whole window comes after the
    // last reset (pluck), i.e. `maxLag` hops later; never compare with an older one.
    const longest = Math.min(this.maxLag, this.count - this.maxLag - 1);
    if (longest < 1 || bin > this.maxBin) return interpolated;
    const now = this.history[this.head];
    const phaseNow = Math.atan2(now[2 * bin + 1], now[2 * bin]);
    const advances: PhaseAdvance[] = [];
    for (let lag = 1; lag <= longest; lag *= 2) {
      const then = this.history[(this.head - lag + this.history.length) % this.history.length];
      advances.push({ lag, phase: phaseNow - Math.atan2(then[2 * bin + 1], then[2 * bin]) });
    }
    const measured = unwrapFrequency(interpolated, advances, this.hop, this.sampleRate);
    // The phase must still land on the same spectral peak.
    return Math.abs(measured - interpolated) <= 1.5 * binHz ? measured : interpolated;
  }

  /** Peak position in bins from a parabola through the log magnitudes (Hann: ~0.05 bin). */
  private interpolate(bin: number): number {
    const a = Math.log(this.magnitude(this.spectrum, bin - 1) + 1e-12);
    const b = Math.log(this.magnitude(this.spectrum, bin) + 1e-12);
    const c = Math.log(this.magnitude(this.spectrum, bin + 1) + 1e-12);
    const d = a - 2 * b + c;
    return d < 0 ? bin + (0.5 * (a - c)) / d : bin;
  }
}

/**
 * A stiff string's partials run sharp: f_k = k·f0·√(1 + B·k²). With three or more partials,
 * (f_k/k)² = f0² + f0²·B·k² is a straight line in k², so a weighted least-squares fit gives
 * f0 and B. Returns the frequency of the fundamental partial, f0·√(1 + B) — what a hardware
 * tuner locks onto — even when the fundamental itself is too weak to measure (phone mics).
 */
function fitStiffness(partials: { partial: PartialEstimate; scale: number }[]): number | null {
  if (partials.length < 3) return null;
  const points = partials.map(({ partial: p, scale }) => ({
    x: p.harmonic * p.harmonic,
    y: (p.frequency / p.harmonic) ** 2,
    w: scale * (p.snr * p.harmonic) ** 2,
  }));
  const sw = points.reduce((s, p) => s + p.w, 0);
  const mx = points.reduce((s, p) => s + p.w * p.x, 0) / sw;
  const my = points.reduce((s, p) => s + p.w * p.y, 0) / sw;
  const sxx = points.reduce((s, p) => s + p.w * (p.x - mx) ** 2, 0);
  if (sxx <= 0) return null;
  const slope = points.reduce((s, p) => s + p.w * (p.x - mx) * (p.y - my), 0) / sxx;
  const f0Squared = my - slope * mx;
  if (!(f0Squared > 0)) return null;
  const stiffness = slope / f0Squared;
  // Real guitar strings: B is roughly 1e-5…1e-3. Anything else is noise, not physics.
  if (!(stiffness >= 0 && stiffness < 2e-3)) return null;
  return Math.sqrt(f0Squared) * Math.sqrt(1 + stiffness);
}

export interface PhaseAdvance {
  /** Interval in hops between the two frames. */
  lag: number;
  /** Phase difference of the partial's bin between them (any 2π offset). */
  phase: number;
}

/**
 * Frequency of a partial from its phase advance over increasing intervals (1, 2, 4, 8…
 * hops). A phase advance only pins the frequency down modulo sampleRate / (lag·hop) —
 * 5.9 Hz over 8 hops at 48 kHz — so unwrapping the longest one directly from a rough peak
 * estimate can land a whole cycle off when the peak is blurred (an acoustic guitar's high
 * partials), which shows up as an error of 5.9 Hz ÷ harmonic number: −20 cents on a low E.
 * Each stage is unwrapped against the previous one instead, so the rough estimate only
 * needs to be within ~±23 Hz, and the result keeps the precision of the longest interval.
 */
export function unwrapFrequency(
  estimate: number,
  advances: PhaseAdvance[],
  hop: number,
  sampleRate: number,
): number {
  let frequency = estimate;
  for (const { lag, phase } of [...advances].sort((a, b) => a.lag - b.lag)) {
    const seconds = (lag * hop) / sampleRate;
    let correction = phase - 2 * Math.PI * frequency * seconds;
    correction -= 2 * Math.PI * Math.round(correction / (2 * Math.PI));
    frequency += correction / (2 * Math.PI * seconds);
  }
  return frequency;
}

/** Weighted mean in the log domain (cents), back in Hz. */
function logMean(items: { f0: number; w: number }[]): number {
  const total = items.reduce((s, p) => s + p.w, 0);
  return 2 ** (items.reduce((s, p) => s + p.w * Math.log2(p.f0), 0) / total);
}

/**
 * Gaussian fall-off of a partial's weight with its distance (cents) from the centre;
 * exactly 0 beyond 2.5 widths, so another string's partial has no influence at all.
 */
function softness(distance: number, width: number): number {
  const z = distance / width;
  return Math.abs(z) > 2.5 ? 0 : Math.exp(-z * z);
}

function weightedMedian(items: { f0: number; w: number }[]): number {
  const sorted = [...items].sort((a, b) => a.f0 - b.f0);
  const half = sorted.reduce((s, p) => s + p.w, 0) / 2;
  let acc = 0;
  for (const p of sorted) {
    acc += p.w;
    if (acc >= half) return p.f0;
  }
  return sorted[sorted.length - 1].f0;
}
