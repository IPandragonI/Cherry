import { readFileSync } from "node:fs";

/** 16-bit PCM WAV (mono, or its first channel) → samples and sample rate. */
export function readWav(path: string): { samples: Float32Array; sampleRate: number } {
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
