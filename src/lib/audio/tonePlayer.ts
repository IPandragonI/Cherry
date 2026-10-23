import { unlockPlayback } from "./audioSession";
import { karplusStrong } from "./karplus";
import { outputContext as context } from "./output";

const buffers = new Map<string, AudioBuffer>();

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

/**
 * Soft two-tone "ding" when a string reaches in tune. C7 + G7 sit far above what the
 * tuner analyses (low-passed at 1 kHz, partials searched up to 1.6 kHz), so the microphone
 * hearing it cannot disturb the reading.
 */
export function playChime(): void {
  const audio = context();
  unlockPlayback(audio);
  const start = audio.currentTime + 0.01;
  for (const [frequency, level] of [
    [2093, 0.05],
    [3136, 0.025],
  ]) {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(level, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.6);
    osc.connect(gain).connect(audio.destination);
    osc.start(start);
    osc.stop(start + 0.65);
  }
}

let drone: { stop: () => void } | null = null;
/** Fade in and out (s): no click when the drone starts or stops. */
const DRONE_FADE_S = 0.08;

/**
 * Sustained reference note, to tune by ear against it (beats slow down and vanish as the
 * string reaches the note). A few soft harmonics make it easy to hear on a phone speaker.
 * Replaces any drone already sounding. Call from a user gesture.
 */
export function startDrone(frequency: number): void {
  stopDrone();
  const audio = context();
  unlockPlayback(audio);
  const out = audio.createGain();
  const start = audio.currentTime + 0.01;
  out.gain.setValueAtTime(0, start);
  out.gain.linearRampToValueAtTime(0.18, start + DRONE_FADE_S);
  out.connect(audio.destination);
  const oscillators = [1, 2, 3].map((harmonic, i) => {
    const osc = audio.createOscillator();
    const level = audio.createGain();
    osc.frequency.value = frequency * harmonic;
    level.gain.value = [1, 0.35, 0.15][i];
    osc.connect(level).connect(out);
    osc.start(start);
    return osc;
  });
  drone = {
    stop: () => {
      const end = audio.currentTime;
      out.gain.cancelScheduledValues(end);
      out.gain.setValueAtTime(out.gain.value, end);
      out.gain.linearRampToValueAtTime(0, end + DRONE_FADE_S);
      oscillators.forEach((osc) => osc.stop(end + DRONE_FADE_S + 0.02));
    },
  };
}

export function stopDrone(): void {
  drone?.stop();
  drone = null;
}
