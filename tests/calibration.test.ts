/**
 * Absolute calibration: an in-tune string must read 0 cents (no systematic offset), at
 * every common capture sample rate, on every string of a standard guitar. The signal is a
 * realistic plucked string: inharmonic partials (string stiffness) that decay at
 * different rates, with a strong 2nd harmonic.
 */
import { describe, expect, it } from "vitest";
import { centsBetween, midiToFrequency } from "@/lib/music/notes";
import { PitchAnalyzer } from "@/lib/pitch/analyzer";
import { Biquad } from "@/lib/pitch/biquad";

const STANDARD = [40, 45, 50, 55, 59, 64];
const AMPLITUDES = [0.5, 1, 0.8, 0.5, 0.35, 0.25, 0.15, 0.1];

function pluck(f0: number, sampleRate: number, { stiffness = 1e-4, lowCut = 0 } = {}) {
  const n = Math.floor(sampleRate * 1.6);
  const out = new Float32Array(n);
  const phases = AMPLITUDES.map(() => 0);
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
    let v = 0;
    AMPLITUDES.forEach((a, k) => {
      const h = k + 1;
      phases[k] += (2 * Math.PI * h * f0 * Math.sqrt(1 + stiffness * h * h)) / sampleRate;
      v += a * Math.exp(-t * (0.6 + 0.4 * h)) * Math.sin(phases[k]);
    });
    out[i] = 0.2 * v;
  }
  if (lowCut) {
    // Phone microphones roll off the low end: the fundamental of a low E is much weaker.
    const a = Biquad.highpass(sampleRate, lowCut);
    const b = Biquad.highpass(sampleRate, lowCut);
    for (let i = 0; i < n; i++) out[i] = b.process(a.process(out[i]));
  }
  return out;
}

function readings(signal: Float32Array, sampleRate: number, target: number) {
  const analyzer = new PitchAnalyzer(sampleRate);
  const cents: number[] = [];
  for (let i = 0; i < signal.length; i += 128) {
    for (const r of analyzer.push(signal.subarray(i, i + 128))) {
      if (r.frequency !== null) cents.push(centsBetween(r.frequency, target));
    }
  }
  return cents;
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

describe.each([48000, 44100, 16000])("at %i Hz", (sampleRate) => {
  it.each(STANDARD)("an in-tune string (MIDI %i) reads 0 ±0.5 cents, every frame ±1", (midi) => {
    const f0 = midiToFrequency(midi);
    const cents = readings(pluck(f0, sampleRate), sampleRate, f0);
    expect(cents.length).toBeGreaterThan(20);
    expect(Math.abs(mean(cents))).toBeLessThan(0.5);
    expect(Math.max(...cents.map(Math.abs))).toBeLessThan(1);
  });
});

describe("phone microphone (weak fundamental)", () => {
  it.each(STANDARD)("MIDI %i still reads in tune", (midi) => {
    const f0 = midiToFrequency(midi);
    const cents = readings(pluck(f0, 48000, { lowCut: 150 }), 48000, f0);
    expect(cents.length).toBeGreaterThan(20);
    expect(Math.abs(mean(cents))).toBeLessThan(0.5);
  });
});

describe("reference pitch", () => {
  it("a string tuned to A4 = 440 reads −15.7 cents when the app is set to 444", () => {
    // The size of the offset reported on device: a stray reference-pitch setting.
    expect(centsBetween(midiToFrequency(45, 440), midiToFrequency(45, 444))).toBeCloseTo(-15.67, 1);
  });
});
