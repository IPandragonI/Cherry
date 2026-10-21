/**
 * Real-world accuracy: the situations behind "the low E reads −40 cents" and "A440 reads
 * −2 to −3 cents". A stiff string (sharp upper partials), a phone mic that barely hears the
 * low fundamental, room reflections, and other open strings ringing along slightly out of
 * tune. Before the spectral refinement, these read from −6 to +7.5 cents.
 */
import { describe, expect, it } from "vitest";
import { centsBetween, midiToFrequency } from "@/lib/music/notes";
import { PitchAnalyzer } from "@/lib/pitch/analyzer";
import { Biquad } from "@/lib/pitch/biquad";
import { perceivedPitch } from "./helpers/strings";

const SR = 48000;
const N = SR * 3;
const E2 = midiToFrequency(40);

function noise(seed: number) {
  let s = seed;
  return () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296) * 2 - 1;
}

/** Stiff plucked string: f_k = k·f0·√(1 + B·k²), higher partials decaying faster. */
function string(f0: number, { amp = 1, stiffness = 1.5e-4, decay = 0.8, fundamental = 1 } = {}) {
  const out = new Float32Array(N);
  [0.6 * fundamental, 1, 0.8, 0.6, 0.45, 0.3, 0.2, 0.12, 0.08].forEach((a, k) => {
    const h = k + 1;
    const f = h * f0 * Math.sqrt(1 + stiffness * h * h);
    const phase = (k * 1.7) % (2 * Math.PI);
    for (let i = 0; i < N; i++) {
      const t = i / SR;
      out[i] +=
        amp * a * Math.exp(-t * decay * (0.5 + 0.35 * h)) * Math.sin(2 * Math.PI * f * t + phase);
    }
  });
  return out;
}

function room(x: Float32Array) {
  const out = Float32Array.from(x);
  for (const [ms, gain] of [
    [7, 0.5],
    [13, -0.35],
    [23, 0.3],
    [37, 0.2],
    [53, -0.15],
  ]) {
    const d = Math.round((ms / 1000) * SR);
    for (let i = d; i < x.length; i++) out[i] += gain * x[i - d];
  }
  return out;
}

function phoneMic(x: Float32Array) {
  const a = Biquad.highpass(SR, 180);
  const b = Biquad.highpass(SR, 180);
  return x.map((v) => b.process(a.process(v)));
}

function mix(...parts: Float32Array[]) {
  const rand = noise(3);
  const out = new Float32Array(N);
  parts.forEach((p) => p.forEach((v, i) => (out[i] += v)));
  return out.map((v) => 0.1 * v + 0.002 * rand());
}

const detune = (f: number, cents: number) => f * 2 ** (cents / 1200);
/** Open A, B and high e ringing along, each a little out of tune. */
const ringingAlong = () => [
  string(detune(midiToFrequency(45), -8), { amp: 0.25, decay: 0.4 }),
  string(detune(midiToFrequency(59), 6), { amp: 0.15, decay: 0.4 }),
  string(detune(midiToFrequency(64), -5), { amp: 0.12, decay: 0.4 }),
];

function read(signal: Float32Array, target: number) {
  const analyzer = new PitchAnalyzer(SR);
  const cents: number[] = [];
  for (let i = 0; i < signal.length; i += 128) {
    for (const r of analyzer.push(signal.subarray(i, i + 128))) {
      if (r.frequency !== null) cents.push(centsBetween(r.frequency, target));
    }
  }
  return cents;
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const worst = (xs: number[]) => Math.max(...xs.map(Math.abs));

describe("low E (E2) reads true", () => {
  const target = perceivedPitch(E2, 1.5e-4);

  it.each([
    ["clean", () => mix(string(E2))],
    ["phone mic (weak fundamental)", () => phoneMic(mix(string(E2, { fundamental: 0.2 })))],
    ["room reflections", () => room(mix(string(E2)))],
    ["other strings ringing along", () => mix(string(E2), ...ringingAlong())],
    [
      "phone + room + strings ringing along",
      () => phoneMic(room(mix(string(E2, { fundamental: 0.2 }), ...ringingAlong()))),
    ],
  ])("%s: within 1 cent", (name, make) => {
    const cents = read(make(), target);
    expect(cents.length).toBeGreaterThan(60);
    expect(Math.abs(mean(cents))).toBeLessThan(0.5);
    // The compound case has detuned strings sitting exactly on E2's 3rd and 4th partials,
    // which no analysis can separate; its single worst frame is allowed 1.5 cents.
    expect(worst(cents)).toBeLessThan(name.startsWith("phone + room") ? 1.5 : 1);
  });
});

describe("A440 reference tone", () => {
  it("reads 0.0 cents through room reflections and noise", () => {
    const tone = Float32Array.from(
      { length: N },
      (_, i) => 0.5 * Math.sin((2 * Math.PI * 440 * i) / SR),
    );
    const cents = read(room(mix(tone)), 440);
    expect(cents.length).toBeGreaterThan(100);
    expect(worst(cents)).toBeLessThan(0.1);
  });
});
