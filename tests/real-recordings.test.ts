/**
 * Real recordings sent from devices, replayed through the analyzer.
 *
 * D3-acoustic-user.wav: an acoustic guitar's open D, recorded with the diagnostic recorder
 * on the phone that showed the reading oscillating between −8 and −12 cents. Measured in
 * the recording itself (relative to A4 = 440 Hz): fundamental −11 cents, 2nd and 3rd
 * partials about −7 cents (the body pulls the fundamental), period estimate −10 cents. The
 * oscillation came from the 2nd partial, 4.3 cents from the fundamental, dropping in and
 * out of the estimate. The tuner shows the perceived pitch, led by the 2nd to 4th
 * partials: about −8 cents.
 */
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { centsBetween, midiToFrequency } from "@/lib/music/notes";
import { PitchAnalyzer } from "@/lib/pitch/analyzer";
import { readWav } from "./helpers/wav";

function readings(file: string, midi: number) {
  const { samples, sampleRate } = readWav(join(__dirname, "fixtures", file));
  const analyzer = new PitchAnalyzer(sampleRate);
  const cents: number[] = [];
  for (let i = 0; i < samples.length; i += 128) {
    for (const r of analyzer.push(samples.subarray(i, i + 128))) {
      if (r.frequency !== null) cents.push(centsBetween(r.frequency, midiToFrequency(midi)));
    }
  }
  return cents;
}

describe("acoustic D3 (user recording)", () => {
  const cents = readings("D3-acoustic-user.wav", 50);

  it("gives a steady reading (no −8 ↔ −12 oscillation)", () => {
    expect(cents.length).toBeGreaterThan(100);
    const steps = cents.slice(1).map((c, i) => Math.abs(c - cents[i]));
    expect(Math.max(...steps)).toBeLessThan(0.5);
    expect(Math.max(...cents) - Math.min(...cents)).toBeLessThan(2);
  });

  it("reads the pitch heard, from the partials: a D about 8 cents flat at A4 = 440 Hz", () => {
    const mean = cents.reduce((a, b) => a + b, 0) / cents.length;
    expect(mean).toBeGreaterThan(-9);
    expect(mean).toBeLessThan(-6.5);
  });
});
