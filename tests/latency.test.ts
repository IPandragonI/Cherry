import { describe, expect, it } from "vitest";
import { karplusStrong } from "@/lib/audio/karplus";
import { centsBetween, midiToFrequency, parseNote } from "@/lib/music/notes";
import { PitchAnalyzer } from "@/lib/pitch/analyzer";

const SAMPLE_RATE = 48000;

/** Half a second of faint noise, then a pluck: ms from the pluck to the first reading. */
function latency(frequency: number) {
  const analyzer = new PitchAnalyzer(SAMPLE_RATE);
  let s = 7;
  const lead = Float32Array.from({ length: SAMPLE_RATE / 2 }, () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return 0.0005 * ((s / 4294967296) * 2 - 1);
  });
  const pluck = karplusStrong(frequency, SAMPLE_RATE, { seconds: 0.6 });
  const signal = new Float32Array(lead.length + pluck.length);
  signal.set(lead);
  signal.set(pluck, lead.length);
  for (let i = 0; i < signal.length; i += 128) {
    for (const r of analyzer.push(signal.subarray(i, i + 128))) {
      if (r.frequency === null) continue;
      expect(Math.abs(centsBetween(r.frequency, frequency))).toBeLessThan(2);
      return ((i + 128 - lead.length) / SAMPLE_RATE) * 1000;
    }
  }
  return null;
}

describe("detection latency", () => {
  // The long spectrum alone needs ~270 ms; the period window's own spectrum gets there sooner.
  it.each(["E2", "A2", "D3", "G3", "B3", "E4"])("shows a plucked %s within 180 ms", (note) => {
    const ms = latency(midiToFrequency(parseNote(note)));
    expect(ms).not.toBeNull();
    expect(ms!).toBeLessThan(180);
  });
});
