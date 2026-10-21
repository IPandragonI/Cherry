import { unlockPlayback } from "./audioSession";
import { karplusStrong } from "./karplus";

let ctx: AudioContext | null = null;
const buffers = new Map<string, AudioBuffer>();

function context(): AudioContext {
  ctx ??= new AudioContext({ latencyHint: "interactive" });
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function pluckBuffer(audio: AudioContext, frequency: number): AudioBuffer {
  const key = frequency.toFixed(3);
  let buffer = buffers.get(key);
  if (!buffer) {
    const samples = karplusStrong(frequency, audio.sampleRate, { seed: Math.round(frequency) });
    buffer = audio.createBuffer(1, samples.length, audio.sampleRate);
    buffer.copyToChannel(samples, 0);
    buffers.set(key, buffer);
  }
  return buffer;
}

export const PLUCK_DURATION_MS = 2500;

/**
 * Plucks one or more strings (low to high). With `strumMs`, notes are staggered like a
 * downstroke. Call from a user gesture so the audio context may start.
 */
export function playNotes(frequencies: number[], { strumMs = 0, gain = 0.6 } = {}): void {
  const audio = context();
  unlockPlayback(audio);
  const out = audio.createGain();
  out.gain.value = gain / Math.sqrt(Math.max(1, frequencies.length));
  out.connect(audio.destination);
  const start = audio.currentTime + 0.01;
  frequencies.forEach((f, i) => {
    const source = audio.createBufferSource();
    source.buffer = pluckBuffer(audio, f);
    source.connect(out);
    source.start(start + (i * strumMs) / 1000);
  });
}
