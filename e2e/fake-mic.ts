import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

/** Generated before the run (see global-setup.ts); Chromium loops it as the microphone. */
export const FAKE_MIC_WAV = "test-results/fake-mic-a2-right.wav";

/** A2 played +9 cents sharp. */
export const FAKE_MIC_FREQUENCY = 110 * 2 ** (9 / 1200);

/**
 * Writes a 16-bit stereo WAV of a guitar-like tone on the RIGHT channel only, the way an
 * audio interface delivers a guitar plugged into input 2. Desktop regression for #1.
 */
export function writeFakeMicWav(path = FAKE_MIC_WAV, seconds = 2) {
  const rate = 48000;
  const frames = rate * seconds;
  const harmonics = [0.6, 1, 0.7, 0.4, 0.25, 0.15];
  const buf = Buffer.alloc(44 + frames * 4);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + frames * 4, 4);
  buf.write("WAVEfmt ", 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(2, 22); // stereo
  buf.writeUInt32LE(rate, 24);
  buf.writeUInt32LE(rate * 4, 28);
  buf.writeUInt16LE(4, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(frames * 4, 40);
  for (let i = 0; i < frames; i++) {
    let v = 0;
    harmonics.forEach(
      (a, h) => (v += a * Math.sin((2 * Math.PI * FAKE_MIC_FREQUENCY * (h + 1) * i) / rate)),
    );
    buf.writeInt16LE(0, 44 + i * 4);
    buf.writeInt16LE(Math.round(0.15 * v * 32767), 46 + i * 4);
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, buf);
}
