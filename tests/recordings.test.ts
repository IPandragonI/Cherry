/** Replays real recordings (see tests/recordings/README.md) through the pitch analyzer. */
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { centsBetween, midiToFrequency, parseNote } from "@/lib/music/notes";
import { PitchAnalyzer } from "@/lib/pitch/analyzer";
import { readWav } from "./helpers/wav";

const DIR = join(__dirname, "recordings");
const files = readdirSync(DIR).filter((f) => f.toLowerCase().endsWith(".wav"));

describe.skipIf(files.length === 0)("real recordings read in tune", () => {
  it.each(files)("%s", (file) => {
    const note = file.replace(/\.wav$/i, "").split(/[-_ ]/)[0];
    const target = midiToFrequency(parseNote(note));
    const { samples, sampleRate } = readWav(join(DIR, file));
    const analyzer = new PitchAnalyzer(sampleRate);
    const cents: number[] = [];
    for (let i = 0; i < samples.length; i += 128) {
      for (const r of analyzer.push(samples.subarray(i, i + 128))) {
        if (r.frequency !== null) cents.push(centsBetween(r.frequency, target));
      }
    }
    expect(cents.length, "no stable reading").toBeGreaterThan(10);
    const mean = cents.reduce((a, b) => a + b, 0) / cents.length;
    expect(Math.abs(mean)).toBeLessThan(2);
  });
});
