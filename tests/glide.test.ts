import { describe, expect, it } from "vitest";
import { centsBetween, midiToFrequency, parseNote } from "@/lib/music/notes";
import { PitchAnalyzer } from "@/lib/pitch/analyzer";

const SAMPLE_RATE = 48000;
const HARMONICS = [0.6, 1, 0.7, 0.4, 0.25, 0.15];

/**
 * A string tuned with the peg while it rings: steady for `hold` s, then gliding at `rate`
 * cents per second for `glide` s, then steady again. Returns the signal and its pitch
 * (cents from `f0`) at any time.
 */
function pegTurn(f0: number, rate: number, { hold = 0.6, glide = 0.8, after = 0.6 } = {}) {
  const total = hold + glide + after;
  const cents = (t: number) => rate * Math.min(glide, Math.max(0, t - hold));
  const out = new Float32Array(Math.round(total * SAMPLE_RATE));
  const phases = HARMONICS.map(() => 0);
  for (let i = 0; i < out.length; i++) {
    const t = i / SAMPLE_RATE;
    const f = f0 * 2 ** (cents(t) / 1200);
    let v = 0;
    HARMONICS.forEach((a, h) => {
      phases[h] += (2 * Math.PI * f * (h + 1)) / SAMPLE_RATE;
      v += a * Math.sin(phases[h]);
    });
    // A string sustaining (plucked once, decaying slowly over the turn).
    out[i] = 0.3 * Math.exp(-t / 1.5) * v;
  }
  return { signal: out, cents, hold, glide };
}

/**
 * Error (cents, reading − true pitch) of every reading from the start of the turn: the
 * worst while catching up (first 150 ms), the worst once following, the worst overshoot
 * after the peg stops, and the error at the end.
 */
function follow(note: string, rate: number, extra?: (i: number) => number) {
  const f0 = midiToFrequency(parseNote(note));
  const { signal, cents, hold, glide } = pegTurn(f0, rate);
  if (extra) signal.forEach((v, i) => (signal[i] = v + extra(i)));
  const analyzer = new PitchAnalyzer(SAMPLE_RATE);
  let catchingUp = 0;
  let following = 0;
  let overshoot = 0;
  let end = Infinity;
  for (let i = 0; i < signal.length; i += 128) {
    for (const r of analyzer.push(signal.subarray(i, i + 128))) {
      const t = (i + 128) / SAMPLE_RATE;
      if (r.frequency === null || t < hold) continue;
      const error = centsBetween(r.frequency, f0) - cents(t);
      if (t < hold + 0.15) catchingUp = Math.max(catchingUp, Math.abs(error));
      else if (t < hold + glide) following = Math.max(following, Math.abs(error));
      else overshoot = Math.max(overshoot, error * Math.sign(rate));
      end = error;
    }
  }
  return { catchingUp, following, overshoot, end };
}

describe("following a peg being turned", () => {
  // Before the fast path, the reading trailed by ~270 ms: 33 cents behind at 120 cents/s.
  it.each(["E2", "A2", "D3", "G3", "B3", "E4"])("%s, turned briskly (120 cents/s)", (note) => {
    const r = follow(note, 120);
    expect(r.catchingUp).toBeLessThan(14);
    expect(r.following).toBeLessThan(4); // ~25 ms behind
    expect(r.overshoot).toBeLessThan(3);
    expect(Math.abs(r.end)).toBeLessThan(1);
  });

  it.each([40, -40])("A2, turned slowly (%i cents/s)", (rate) => {
    const r = follow("A2", rate);
    expect(r.following).toBeLessThan(2);
    expect(r.overshoot).toBeLessThan(1);
    expect(Math.abs(r.end)).toBeLessThan(1);
  });

  it("falls back on the steady reading when the input is noisy, without wandering", () => {
    let s = 3;
    const rand = () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296) * 2 - 1;
    const r = follow("A2", 120, () => 0.03 * rand());
    expect(Math.abs(r.end)).toBeLessThan(1);
    expect(r.overshoot).toBeLessThan(3);
  });
});
