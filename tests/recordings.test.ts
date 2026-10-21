/** Replays real recordings (see tests/recordings/README.md) through the pitch analyzer. */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { centsBetween, midiToFrequency, parseNote } from "@/lib/music/notes";
import { PitchAnalyzer } from "@/lib/pitch/analyzer";

const DIR = join(__dirname, "recordings");
const files = readdirSync(DIR).filter((f) => f.toLowerCase().endsWith(".wav"));

/** 16-bit PCM WAV (mono, or the first channel) → samples and rate. */
function readWav(path: string) {
  const buf = readFileSync(path);
  let offset = 12;
  let sampleRate = 48000;
  let channels = 1;
  while (offset < buf.length) {
    const id = buf.toString("ascii", offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    if (id === "fmt ") {
      channels = buf.readUInt16LE(offset + 10);
      sampleRate = buf.readUInt32LE(offset + 12);
    } else if (id === "data") {
      const frames = size / 2 / channels;
      const samples = new Float32Array(frames);
      for (let i = 0; i < frames; i++) {
        samples[i] = buf.readInt16LE(offset + 8 + i * 2 * channels) / 0x8000;
      }
      return { samples, sampleRate };
    }
    offset += 8 + size + (size % 2);
  }
  throw new Error(`no data chunk in ${path}`);
}

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
