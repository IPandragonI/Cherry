/**
 * An in-tune acoustic guitar must read in tune on every string. The model: stiff strings
 * whose two vibration planes (polarisations) are a hair apart and decay differently, so
 * every partial beats; a resonant wooden body (air ~100 Hz, top plate ~200/400 Hz); a pick
 * attack; a phone microphone in a room. Reported on device: −24, in tune, −18, −8, −6, in
 * tune on an in-tune guitar.
 */
import { describe, expect, it } from "vitest";
import { centsBetween, midiToFrequency } from "@/lib/music/notes";
import { PitchAnalyzer } from "@/lib/pitch/analyzer";
import { Biquad } from "@/lib/pitch/biquad";
import { perceivedPitch } from "./helpers/strings";

const SR = 48000;
const N = SR * 3;
const STIFFNESS = 1e-4;
const STRINGS: [string, number][] = [
  ["E2", 40],
  ["A2", 45],
  ["D3", 50],
  ["G3", 55],
  ["B3", 59],
  ["E4", 64],
];

function noise(seed: number) {
  let s = seed;
  return () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296) * 2 - 1;
}

/** Peaking EQ (RBJ cookbook) for the body resonances. */
function peaking(f: number, gainDb: number, q: number) {
  const A = 10 ** (gainDb / 40);
  const w = (2 * Math.PI * f) / SR;
  const alpha = Math.sin(w) / (2 * q);
  const a0 = 1 + alpha / A;
  const b = [(1 + alpha * A) / a0, (-2 * Math.cos(w)) / a0, (1 - alpha * A) / a0];
  const a = [(-2 * Math.cos(w)) / a0, (1 - alpha / A) / a0];
  let x1 = 0,
    x2 = 0,
    y1 = 0,
    y2 = 0;
  return (x: number) => {
    const y = b[0] * x + b[1] * x1 + b[2] * x2 - a[0] * y1 - a[1] * y2;
    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = y;
    return y;
  };
}

function acousticString(f0: number, seed: number) {
  const out = new Float32Array(N);
  const amps = [0.7, 1, 0.75, 0.55, 0.4, 0.3, 0.2, 0.12, 0.08, 0.05];
  amps.forEach((a, k) => {
    const h = k + 1;
    const f = h * f0 * Math.sqrt(1 + STIFFNESS * h * h);
    const split = 0.1 * h; // second polarisation, a hair sharper
    const p1 = (k * 1.7) % 6.28,
      p2 = (k * 2.9) % 6.28;
    for (let i = 0; i < N; i++) {
      const t = i / SR;
      out[i] +=
        a * Math.exp(-t * (0.7 + 0.45 * h)) * Math.sin(2 * Math.PI * f * t + p1) +
        0.45 * a * Math.exp(-t * (0.4 + 0.3 * h)) * Math.sin(2 * Math.PI * (f + split) * t + p2);
    }
  });
  // Pick attack: a short burst of noise.
  const rand = noise(seed);
  for (let i = 0; i < SR * 0.015; i++) out[i] += 0.8 * rand() * (1 - i / (SR * 0.015));
  // Wooden body, then a phone microphone in a room.
  const body = [peaking(100, 9, 4), peaking(200, 6, 3), peaking(400, 4, 2)];
  const hp1 = Biquad.highpass(SR, 160);
  const hp2 = Biquad.highpass(SR, 160);
  const room = noise(seed + 1);
  const dry = out.map((v) => hp2.process(hp1.process(body.reduce((x, f) => f(x), v))));
  const wet = Float32Array.from(dry);
  for (const [ms, g] of [
    [9, 0.45],
    [17, -0.3],
    [29, 0.25],
    [43, -0.15],
  ]) {
    const d = Math.round((ms / 1000) * SR);
    for (let i = d; i < N; i++) wet[i] += g * dry[i - d];
  }
  return wet.map((v) => 0.08 * v + 0.0015 * room());
}

describe("an in-tune acoustic guitar reads in tune on every string", () => {
  it.each(STRINGS)("%s", (_, midi) => {
    const f0 = midiToFrequency(midi);
    // What a tuner should read: the pitch heard from the stiff string.
    const target = perceivedPitch(f0, STIFFNESS);
    const signal = acousticString(f0, midi);
    const analyzer = new PitchAnalyzer(SR);
    const cents: number[] = [];
    for (let i = 0; i < signal.length; i += 128) {
      for (const r of analyzer.push(signal.subarray(i, i + 128))) {
        if (r.frequency !== null) cents.push(centsBetween(r.frequency, target));
      }
    }
    expect(cents.length).toBeGreaterThan(40);
    const mean = cents.reduce((a, b) => a + b, 0) / cents.length;
    // Within 1.5 cents on average: the low E's beating partials sit about a cent off the
    // perceived-pitch reference, far below what the display shows.
    expect(Math.abs(mean)).toBeLessThan(1.5);
    expect(Math.max(...cents.map(Math.abs))).toBeLessThan(3);
  });
});
