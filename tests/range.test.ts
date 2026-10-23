import { describe, expect, it } from "vitest";
import { karplusStrong } from "@/lib/audio/karplus";
import { centsBetween, midiToFrequency, parseNote } from "@/lib/music/notes";
import { PitchAnalyzer } from "@/lib/pitch/analyzer";
import { DEFAULT_RANGE, rangeFor } from "@/lib/pitch/range";

const SAMPLE_RATE = 48000;

function lastReading(frequency: number, range = DEFAULT_RANGE) {
  const analyzer = new PitchAnalyzer(SAMPLE_RATE, {
    highpassHz: range.highpassHz,
    tracker: { minFrequency: range.minFrequency, maxFrequency: range.maxFrequency },
  });
  const signal = karplusStrong(frequency, SAMPLE_RATE, { seconds: 1.5, t60: 4 });
  let last: number | null = null;
  for (let i = 0; i < signal.length; i += 128) {
    for (const r of analyzer.push(signal.subarray(i, i + 128))) last = r.frequency ?? last;
  }
  return last;
}

describe("analysis range", () => {
  it("keeps the guitar band for guitar tunings", () => {
    const standard = ["E2", "A2", "D3", "G3", "B3", "E4"].map((n) => midiToFrequency(parseNote(n)));
    expect(rangeFor(standard)).toEqual(DEFAULT_RANGE);
  });

  it("widens downwards for a bass, with the high-pass under its lowest note", () => {
    const range = rangeFor([midiToFrequency(parseNote("B0")), midiToFrequency(parseNote("G2"))]);
    expect(range.minFrequency).toBeLessThan(30.87);
    expect(range.highpassHz).toBeLessThan(25);
  });

  it.each(["B0", "E1", "A1", "D2", "G2"])("reads a bass %s within 2 cents", (note) => {
    const f = midiToFrequency(parseNote(note));
    const range = rangeFor([midiToFrequency(parseNote("B0")), midiToFrequency(parseNote("G2"))]);
    const detected = lastReading(f, range);
    expect(detected).not.toBeNull();
    expect(Math.abs(centsBetween(detected!, f))).toBeLessThan(2);
  });
});
