/**
 * Realistic input scenarios (synthetic, deterministic) for the regressions reported on
 * real devices: a quiet desktop mic with mains hum, and a phone hearing other open strings
 * ring along. Plucks are Karplus-Strong strings that decay naturally and are re-plucked.
 */
import { describe, expect, it } from "vitest";
import { karplusStrong } from "@/lib/audio/karplus";
import { centsBetween, midiToFrequency } from "@/lib/music/notes";
import { PitchAnalyzer } from "@/lib/pitch/analyzer";

const SR = 48000;
const SECONDS = 4;

function noise(seed: number) {
  let s = seed;
  return () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296) * 2 - 1;
}

const pluck = (midi: number, seed: number, t60 = 4) =>
  karplusStrong(midiToFrequency(midi), SR, { seconds: 2, t60, seed });

const hum = (i: number, amplitude: number) => amplitude * Math.sin((2 * Math.PI * 50 * i) / SR);

function analyze(signal: (i: number) => number, target: number) {
  const samples = Float32Array.from({ length: SR * SECONDS }, (_, i) => signal(i));
  const analyzer = new PitchAnalyzer(SR);
  const cents: number[] = [];
  let frames = 0;
  for (let i = 0; i < samples.length; i += 128) {
    for (const r of analyzer.push(samples.subarray(i, i + 128))) {
      frames++;
      if (r.frequency !== null) cents.push(centsBetween(r.frequency, target));
    }
  }
  const steps = cents.slice(1).map((c, i) => Math.abs(c - cents[i]));
  return {
    coverage: cents.length / frames,
    worst: Math.max(0, ...cents.map(Math.abs)),
    biggestStep: Math.max(0, ...steps),
  };
}

describe("desktop: quiet microphone (auto gain off)", () => {
  const a2 = pluck(45, 9);
  const rand = noise(5);

  it("hears a note at about −40 dBFS over room noise and 50 Hz hum", () => {
    const r = analyze(
      (i) => 0.012 * a2[i % a2.length] + 0.0008 * rand() + hum(i, 0.002),
      midiToFrequency(45),
    );
    expect(r.coverage).toBeGreaterThan(0.25);
    expect(r.worst).toBeLessThan(2);
  });

  it("still hears a very quiet note (about −50 dBFS)", () => {
    const r = analyze(
      (i) => 0.004 * a2[i % a2.length] + 0.0005 * rand() + hum(i, 0.001),
      midiToFrequency(45),
    );
    expect(r.coverage).toBeGreaterThan(0.1);
    expect(r.worst).toBeLessThan(2);
  });

  it("does not mistake hum and room noise for a note", () => {
    const r = analyze((i) => 0.0008 * rand() + hum(i, 0.004), midiToFrequency(45));
    expect(r.coverage).toBe(0);
  });
});

describe("phone: other open strings ringing along", () => {
  const a2 = pluck(45, 9);
  const e2 = pluck(40, 3, 6);
  const d3 = pluck(50, 4, 5);
  const rand = noise(7);

  it("stays on the played string, steady within a couple of cents", () => {
    const r = analyze(
      (i) =>
        0.4 * a2[i % a2.length] +
        0.12 * e2[i % e2.length] +
        0.08 * d3[i % d3.length] +
        0.03 * rand(),
      midiToFrequency(45),
    );
    expect(r.coverage).toBeGreaterThan(0.35);
    expect(r.worst).toBeLessThan(3); // was: no reading at all / jumps of ±20 cents
    expect(r.biggestStep).toBeLessThan(1);
  });

  it("follows a low E through its whole decay", () => {
    const rand2 = noise(11);
    const r = analyze((i) => 0.4 * e2[i % e2.length] + 0.04 * rand2(), midiToFrequency(40));
    expect(r.coverage).toBeGreaterThan(0.75);
    expect(r.worst).toBeLessThan(1);
  });
});
