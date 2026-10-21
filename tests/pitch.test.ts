import { describe, expect, it } from "vitest";
import { karplusStrong } from "@/lib/audio/karplus";
import { centsBetween, midiToFrequency, parseNote } from "@/lib/music/notes";
import { PitchAnalyzer } from "@/lib/pitch/analyzer";
import { PitchTracker, median } from "@/lib/pitch/tracker";

const SAMPLE_RATE = 48000;

/** Deterministic pseudo-random noise in [-1, 1]. */
function noise(seed = 1) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return (s / 4294967296) * 2 - 1;
  };
}

interface SignalOptions {
  /** Relative amplitude of each harmonic, fundamental first. */
  harmonics?: number[];
  amplitude?: number;
  noiseLevel?: number;
}

function synth(frequency: number, seconds: number, opts: SignalOptions = {}): Float32Array {
  const { harmonics = [1], amplitude = 0.3, noiseLevel = 0 } = opts;
  const rand = noise(Math.round(frequency));
  const out = new Float32Array(Math.round(seconds * SAMPLE_RATE));
  for (let i = 0; i < out.length; i++) {
    const t = i / SAMPLE_RATE;
    let v = 0;
    harmonics.forEach((a, h) => (v += a * Math.sin(2 * Math.PI * frequency * (h + 1) * t)));
    out[i] = amplitude * v + noiseLevel * rand();
  }
  return out;
}

/** Streams a signal through the analyzer in 128-sample render quanta, like a worklet. */
function analyze(signal: Float32Array, analyzer = new PitchAnalyzer(SAMPLE_RATE)) {
  const readings: (number | null)[] = [];
  for (let i = 0; i < signal.length; i += 128) {
    for (const r of analyzer.push(signal.subarray(i, i + 128))) readings.push(r.frequency);
  }
  return readings;
}

const lastPitch = (readings: (number | null)[]) => readings.at(-1) ?? null;

/** Guitar-like spectrum: strong 2nd/3rd harmonics, sometimes louder than the fundamental. */
const GUITAR_HARMONICS = [0.6, 1, 0.7, 0.4, 0.25, 0.15];

describe("PitchAnalyzer", () => {
  const strings = ["E2", "A2", "D3", "G3", "B3", "E4"].map((n) => midiToFrequency(parseNote(n)));

  it.each(strings)("detects a pure sine at %f Hz within 1 cent", (f) => {
    const detected = lastPitch(analyze(synth(f, 0.6)));
    expect(detected).not.toBeNull();
    expect(Math.abs(centsBetween(detected!, f))).toBeLessThan(1);
  });

  it.each(strings)("finds the fundamental of a harmonic-rich %f Hz tone", (f) => {
    const detected = lastPitch(analyze(synth(f, 0.6, { harmonics: GUITAR_HARMONICS })));
    expect(detected).not.toBeNull();
    expect(Math.abs(centsBetween(detected!, f))).toBeLessThan(2);
  });

  it("measures small detunings precisely", () => {
    const target = midiToFrequency(parseNote("A2"));
    for (const cents of [-23, -6, 4, 17]) {
      const f = target * 2 ** (cents / 1200);
      const detected = lastPitch(analyze(synth(f, 0.6, { harmonics: GUITAR_HARMONICS })))!;
      expect(centsBetween(detected, target)).toBeCloseTo(cents, 0);
    }
  });

  it("handles drop tunings down to C2 and noisy input", () => {
    const c2 = midiToFrequency(parseNote("C2"));
    const detected = lastPitch(
      analyze(synth(c2, 0.8, { harmonics: GUITAR_HARMONICS, noiseLevel: 0.05 })),
    )!;
    expect(Math.abs(centsBetween(detected, c2))).toBeLessThan(3);
  });

  it("reports nothing for silence or pure noise", () => {
    expect(analyze(new Float32Array(SAMPLE_RATE / 2)).every((r) => r === null)).toBe(true);
    const n = noise(7);
    const white = Float32Array.from({ length: SAMPLE_RATE / 2 }, () => 0.3 * n());
    expect(analyze(white).filter((r) => r !== null).length).toBe(0);
  });

  it("re-locks quickly on a new note", () => {
    const analyzer = new PitchAnalyzer(SAMPLE_RATE);
    const e2 = midiToFrequency(40);
    const a2 = midiToFrequency(45);
    analyze(synth(e2, 0.5), analyzer);
    const readings = analyze(synth(a2, 0.4), analyzer);
    expect(Math.abs(centsBetween(lastPitch(readings)!, a2))).toBeLessThan(1);
  });
});

describe("karplusStrong reference tone", () => {
  it.each(["E2", "A2", "D3", "G3", "B3", "E4"])("plucks %s in tune (±2 cents)", (note) => {
    const f = midiToFrequency(parseNote(note));
    const detected = lastPitch(analyze(karplusStrong(f, SAMPLE_RATE, { seconds: 0.8 })));
    expect(detected).not.toBeNull();
    expect(Math.abs(centsBetween(detected!, f))).toBeLessThan(2);
  });
});

describe("PitchTracker", () => {
  const frame = (frequency: number, clarity = 0.97, rms = 0.1) => ({ frequency, clarity, rms });

  it("computes medians", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });

  it("waits for agreeing frames before locking (stability gate)", () => {
    const t = new PitchTracker({ lockFrames: 3 });
    expect(t.update(frame(110))).toBeNull();
    expect(t.update(frame(110.2))).toBeNull();
    expect(t.update(frame(110.1))).toBeCloseTo(110.1);
  });

  it("rejects unclear, quiet and out-of-range frames", () => {
    const t = new PitchTracker({ lockFrames: 1 });
    expect(t.update(frame(110, 0.5))).toBeNull();
    expect(t.update(frame(110, 0.97, 0.0001))).toBeNull();
    expect(t.update(frame(20))).toBeNull();
    expect(t.update(frame(110))).toBe(110);
  });

  it("filters single-frame outliers with the median", () => {
    const t = new PitchTracker({ lockFrames: 3, medianSize: 5, jumpCents: 2000 });
    [110, 110, 110, 110].forEach((f) => t.update(frame(f)));
    expect(t.update(frame(220))).toBe(110);
  });

  it("holds the last value through short dropouts, then releases", () => {
    const t = new PitchTracker({ lockFrames: 1, holdFrames: 2 });
    t.update(frame(110));
    expect(t.update(null)).toBe(110);
    expect(t.update(null)).toBe(110);
    expect(t.update(null)).toBeNull();
  });
});
