import { Biquad } from "./biquad";
import { BandedMpm, type PitchEstimate } from "./mpm";
import { PartialRefiner, type RefinedPitch } from "./partials";
import { DEFAULT_TRACKER_OPTIONS, PitchTracker, type TrackerOptions } from "./tracker";

/** Clarity credited to a pitch that most of its partials agree on. */
const CONSENSUS_CLARITY = 0.9;
/** Clarity a period estimate needs to be shown without spectral confirmation. */
const PERIOD_ONLY_CLARITY = 0.93;

export interface PitchReading {
  /** Smoothed frequency in Hz, or null when no stable pitch is heard. */
  frequency: number | null;
  rms: number;
}

export interface AnalyzerOptions {
  /** Period-detection window (newest samples). */
  windowSize: number;
  /** Spectral window for the precise measurement (≥ windowSize, power of two). */
  spectrumSize: number;
  hopSize: number;
  highpassHz: number;
  lowpassHz: number;
  /** Mains hum frequencies removed with narrow notches. */
  humHz: number[];
  /** A frame counts as sound when its level is this many times the noise floor… */
  minSignalToNoise: number;
  /** …and above this absolute RMS (−80 dBFS), so quiet desktop mics still work. */
  minRms: number;
  /** Hops ignored after a pluck (the attack is noisy and the string starts sharp): one
   *  period window. The spectral measurement waits until its longer window is clean too. */
  attackHops: number;
  /** The precise value must agree with the period estimate within this many cents. */
  maxRefineCents: number;
  /** A hop this many times louder than the previous one marks a new pluck… */
  onsetRatio: number;
  /** …if it is also this many times above the noise floor (noise itself fluctuates). */
  onsetSignalToNoise: number;
  /** A change of the period estimate larger than this (cents) is a new note too… */
  noteChangeCents: number;
  /** …when the new pitch is this clear (low-clarity jumps come from strings ringing along). */
  noteChangeClarity: number;
  tracker?: Partial<TrackerOptions>;
}

export function defaultAnalyzerOptions(sampleRate: number): AnalyzerOptions {
  // ~85 ms period windows at 48 kHz (≥ 5 periods of a low C2), and ~170 ms spectra so the
  // partials of a low E (82 Hz apart) and of strings ringing along are cleanly separated.
  const windowSize = sampleRate > 32000 ? 4096 : 2048;
  return {
    windowSize,
    spectrumSize: windowSize * 2,
    hopSize: windowSize / 4,
    highpassHz: 50,
    lowpassHz: 1000,
    humHz: [50, 60],
    minSignalToNoise: 3,
    minRms: 0.0001,
    attackHops: 4,
    onsetRatio: 3,
    onsetSignalToNoise: 8,
    noteChangeCents: 50,
    noteChangeClarity: 0.8,
    maxRefineCents: 20,
  };
}

/**
 * Streaming pitch analysis: filters incoming samples (high-pass, hum notches, low-pass),
 * gates on level relative to an adaptive noise floor, and every `hopSize` samples:
 *  1. finds the note with a band-limited McLeod Pitch Method (robust against octave
 *     errors, but its period estimate can be pulled by a few to tens of cents when other
 *     strings ring along or the fundamental is weak);
 *  2. measures the exact frequency from the note's partials in the spectrum
 *     ({@link PartialRefiner}, phase vocoder), which is what makes it read true 0 cents;
 *  3. feeds the result to a {@link PitchTracker} for stability.
 * Runs inside the AudioWorklet, and in tests on synthetic signals.
 */
export class PitchAnalyzer {
  private readonly options: AnalyzerOptions;
  private readonly detector: BandedMpm;
  private readonly refiner: PartialRefiner;
  private readonly filters: Biquad[];
  private readonly ring: Float32Array;
  /** The newest `spectrumSize` samples, oldest first. */
  private readonly frame: Float32Array;
  private writeIndex = 0;
  private filled = 0;
  private sinceLast = 0;
  /** Slowly rising, quickly falling estimate of the background level. */
  private noiseFloor = 0.0002;
  /** RMS of the most recent hop, to spot plucks. */
  private lastHopRms = 0;
  private wasAudible = false;
  /** Hops still to skip after the latest pluck. */
  private attackLeft = 0;
  /** Latest period estimate, to notice note changes without a new attack. */
  private lastCoarse: number | null = null;
  /** A different pitch seen once; it becomes a note change if the next hop confirms it. */
  private pendingCoarse: number | null = null;
  readonly tracker: PitchTracker;

  constructor(
    private readonly sampleRate: number,
    options: Partial<AnalyzerOptions> = {},
  ) {
    this.options = { ...defaultAnalyzerOptions(sampleRate), ...options };
    const { windowSize, spectrumSize, hopSize, highpassHz, lowpassHz, humHz } = this.options;
    // Only a plucked note is shown, within ~1.3 s of its pluck (at 48 kHz).
    const tracker = { ...DEFAULT_TRACKER_OPTIONS, armFrames: 60, ...this.options.tracker };
    this.detector = new BandedMpm(
      windowSize,
      sampleRate,
      tracker.minFrequency,
      tracker.maxFrequency,
    );
    this.refiner = new PartialRefiner(spectrumSize, sampleRate, hopSize);
    this.filters = [
      Biquad.highpass(sampleRate, highpassHz),
      ...humHz.map((hz) => Biquad.notch(sampleRate, hz)),
      Biquad.lowpass(sampleRate, lowpassHz),
      Biquad.lowpass(sampleRate, lowpassHz),
    ];
    this.ring = new Float32Array(spectrumSize);
    this.frame = new Float32Array(spectrumSize);
    this.tracker = new PitchTracker(tracker);
  }

  /**
   * The value shown is the spectral one. The period estimate only says which note it is:
   * it can be off by tens of cents on an acoustic guitar (body resonances, strings ringing
   * along), so when the two disagree the partials decide, and when nothing confirms the
   * pitch, nothing is shown rather than a doubtful number.
   */
  private precise(coarse: PitchEstimate): { frequency: number; clarity: number } | null {
    const cents = (a: number, b: number) => Math.abs(1200 * Math.log2(a / b));
    const confirmed = (r: RefinedPitch | null) =>
      r !== null && r.support >= 3 && r.agreement >= 0.5;
    let refined = this.refiner.refine(coarse.frequency);
    // Far from the period estimate: search again around the partials' own value, so every
    // harmonic window is centred on the real pitch.
    if (refined && cents(refined.frequency, coarse.frequency) > this.options.maxRefineCents) {
      const again = this.refiner.refine(refined.frequency);
      refined = confirmed(again) ? again : refined;
    }
    if (confirmed(refined)) {
      // Several independent partials agreeing is stronger evidence than the waveform's
      // periodicity, which strings ringing along keep low. (Two can line up by chance in a
      // mixture of other strings, so three, and most of those found, are required.)
      return {
        frequency: refined!.frequency,
        clarity: Math.max(coarse.clarity, CONSENSUS_CLARITY),
      };
    }
    if (refined && cents(refined.frequency, coarse.frequency) <= this.options.maxRefineCents) {
      return { frequency: refined.frequency, clarity: coarse.clarity };
    }
    // No spectral confirmation: only a very clean period estimate is good enough.
    return !refined && coarse.clarity >= PERIOD_ONLY_CLARITY ? coarse : null;
  }

  /** A pluck or a note change: skip the attack and restart the phase measurements. */
  private newNote() {
    this.tracker.attack();
    this.attackLeft = this.options.attackHops;
    this.lastCoarse = null;
    this.pendingCoarse = null;
    this.refiner.reset();
  }

  /** Feeds samples; returns a reading for every completed hop (usually 0 or 1). */
  push(samples: Float32Array): PitchReading[] {
    const readings: PitchReading[] = [];
    const { spectrumSize, hopSize } = this.options;
    for (let i = 0; i < samples.length; i++) {
      let x = samples[i];
      for (const f of this.filters) x = f.process(x);
      this.ring[this.writeIndex] = x;
      this.writeIndex = (this.writeIndex + 1) % spectrumSize;
      if (this.filled < spectrumSize) this.filled++;
      if (++this.sinceLast >= hopSize && this.filled === spectrumSize) {
        this.sinceLast = 0;
        readings.push(this.analyze());
      }
    }
    return readings;
  }

  private analyze(): PitchReading {
    const { windowSize, spectrumSize, minRms, minSignalToNoise } = this.options;
    this.frame.set(this.ring.subarray(this.writeIndex), 0);
    this.frame.set(this.ring.subarray(0, this.writeIndex), spectrumSize - this.writeIndex);
    // Every hop, so consecutive spectra are exactly one hop apart (phase vocoder).
    this.refiner.analyse(this.frame);
    const window = this.frame.subarray(spectrumSize - windowSize);

    let sum = 0;
    for (let i = 0; i < windowSize; i++) sum += window[i] * window[i];
    const rms = Math.sqrt(sum / windowSize);

    const audible = rms >= minRms && rms >= this.noiseFloor * minSignalToNoise;
    // Track the background: follow quiet frames quickly, creep up slowly otherwise
    // (doubling takes ~10 s), so a sustained note never becomes "the floor".
    this.noiseFloor =
      rms < this.noiseFloor
        ? this.noiseFloor * 0.7 + rms * 0.3
        : Math.min(rms, this.noiseFloor * 1.0015);
    this.noiseFloor = Math.max(this.noiseFloor, 1e-5);

    // Pluck detection on the newest hop only (the full window reacts too slowly). During
    // the attack the waveform is noisy and the string sits a few cents sharp, which made
    // the bubble jump at every pluck; those hops are skipped (the tracker holds its value).
    const { hopSize, onsetRatio, onsetSignalToNoise, noteChangeCents } = this.options;
    let hopSum = 0;
    for (let i = windowSize - hopSize; i < windowSize; i++) hopSum += window[i] ** 2;
    const hopRms = Math.sqrt(hopSum / hopSize);
    const pluck =
      audible &&
      hopRms > this.lastHopRms * onsetRatio &&
      hopRms > this.noiseFloor * onsetSignalToNoise;
    if (pluck) this.newNote();
    // Sound emerging from silence, too faint to be sure it is a pluck (quiet desktop mic),
    // may still be shown; sound that never rose (strings ringing along) may not.
    else if (audible && (!this.wasAudible || hopRms > this.lastHopRms * onsetRatio)) {
      this.tracker.arm();
    }
    this.lastHopRms = hopRms;
    this.wasAudible = audible;

    let coarse = audible && this.attackLeft === 0 ? this.detector.estimate(window) : null;
    // A different note without a new attack (hammer-on, the next string while the last
    // one rings): same treatment as a pluck, so no spectrum mixes the two notes.
    const cents = (a: number, b: number) => Math.abs(1200 * Math.log2(a / b));
    let outlier = false;
    if (
      coarse &&
      this.lastCoarse !== null &&
      cents(coarse.frequency, this.lastCoarse) > noteChangeCents
    ) {
      const confirmed =
        coarse.clarity >= this.options.noteChangeClarity &&
        this.pendingCoarse !== null &&
        cents(coarse.frequency, this.pendingCoarse) <= noteChangeCents;
      if (confirmed) {
        this.newNote();
        coarse = null;
      } else {
        // Seen once: maybe a glitch (strings ringing along). The tracker rejects it if so.
        this.pendingCoarse = coarse.frequency;
        outlier = true;
      }
    } else {
      this.pendingCoarse = null;
    }
    if (coarse && !outlier) this.lastCoarse = coarse.frequency;
    if (this.attackLeft > 0) this.attackLeft--;
    // Right after a pluck the spectrum still holds the previous note: wait for it to be
    // clean (~170 ms, like hardware tuners) rather than show a less precise period value.
    if (coarse && !this.refiner.ready) coarse = null;
    let estimate: { frequency: number; clarity: number } | null = null;
    if (coarse && outlier) {
      // Unconfirmed jump: hand it over as is, the tracker rejects lone outliers.
      estimate = coarse;
    } else if (coarse) {
      estimate = this.precise(coarse);
    }
    return {
      frequency: this.tracker.update(estimate ? { ...estimate, rms } : null),
      rms,
    };
  }
}
