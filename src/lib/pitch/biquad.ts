/** Second-order IIR filter (RBJ audio EQ cookbook), processed sample by sample. */
export class Biquad {
  private x1 = 0;
  private x2 = 0;
  private y1 = 0;
  private y2 = 0;

  private constructor(
    private readonly b0: number,
    private readonly b1: number,
    private readonly b2: number,
    private readonly a1: number,
    private readonly a2: number,
  ) {}

  static highpass(sampleRate: number, cutoff: number, q = Math.SQRT1_2): Biquad {
    const { cos, alpha } = prewarp(sampleRate, cutoff, q);
    const a0 = 1 + alpha;
    const b0 = (1 + cos) / 2 / a0;
    return new Biquad(b0, -2 * b0, b0, (-2 * cos) / a0, (1 - alpha) / a0);
  }

  static lowpass(sampleRate: number, cutoff: number, q = Math.SQRT1_2): Biquad {
    const { cos, alpha } = prewarp(sampleRate, cutoff, q);
    const a0 = 1 + alpha;
    const b0 = (1 - cos) / 2 / a0;
    return new Biquad(b0, 2 * b0, b0, (-2 * cos) / a0, (1 - alpha) / a0);
  }

  /** Narrow band-reject, e.g. to remove 50/60 Hz mains hum picked up by desktop mics. */
  static notch(sampleRate: number, center: number, q = 8): Biquad {
    const { cos, alpha } = prewarp(sampleRate, center, q);
    const a0 = 1 + alpha;
    return new Biquad(1 / a0, (-2 * cos) / a0, 1 / a0, (-2 * cos) / a0, (1 - alpha) / a0);
  }

  process(x: number): number {
    const y =
      this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1;
    this.x1 = x;
    this.y2 = this.y1;
    this.y1 = y;
    return y;
  }
}

function prewarp(sampleRate: number, cutoff: number, q: number) {
  const w0 = (2 * Math.PI * cutoff) / sampleRate;
  return { cos: Math.cos(w0), alpha: Math.sin(w0) / (2 * q) };
}
