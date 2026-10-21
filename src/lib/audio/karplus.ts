export interface PluckOptions {
  seconds?: number;
  /** Time for the string to decay by 60 dB. */
  t60?: number;
  /** 0 = dull, 1 = bright excitation. */
  brightness?: number;
  seed?: number;
}

/**
 * Karplus-Strong plucked string. The loop delay is tuned with a first-order all-pass
 * fractional delay so the pitch is accurate enough to tune by ear.
 */
export function karplusStrong(
  frequency: number,
  sampleRate: number,
  { seconds = 2.5, t60 = 3, brightness = 0.5, seed = 1 }: PluckOptions = {},
): Float32Array<ArrayBuffer> {
  const out = new Float32Array(Math.floor(seconds * sampleRate));
  // The loop reads `length` samples back and averages with the next (newer) sample, so its
  // delay is length − ½; the all-pass supplies the remaining fraction.
  const period = sampleRate / frequency + 0.5;
  const length = Math.max(2, Math.floor(period - 0.1));
  const frac = period - length;
  const c = (1 - frac) / (1 + frac);
  const loss = 0.001 ** (1 / (frequency * t60));

  let s = seed;
  const random = () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return (s / 4294967296) * 2 - 1;
  };
  const line = new Float32Array(length);
  let smooth = 0;
  for (let i = 0; i < length; i++) {
    smooth += (random() - smooth) * (0.15 + 0.85 * brightness);
    line[i] = smooth;
  }
  let mean = 0;
  line.forEach((v) => (mean += v / length));
  for (let i = 0; i < length; i++) line[i] -= mean;

  let index = 0;
  let apIn = 0;
  let apOut = 0;
  for (let n = 0; n < out.length; n++) {
    const current = line[index];
    const next = line[(index + 1) % length];
    const averaged = loss * 0.5 * (current + next);
    const y = c * averaged + apIn - c * apOut;
    apIn = averaged;
    apOut = y;
    line[index] = y;
    out[n] = current;
    index = (index + 1) % length;
  }

  // Soft attack and release to avoid clicks.
  const attack = Math.floor(0.004 * sampleRate);
  const release = Math.floor(0.25 * sampleRate);
  for (let i = 0; i < attack; i++) out[i] *= i / attack;
  for (let i = 0; i < release; i++) out[out.length - 1 - i] *= i / release;
  return out;
}
