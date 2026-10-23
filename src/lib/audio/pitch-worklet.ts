/**
 * AudioWorklet processor: the only code on the real-time audio thread, so it does as
 * little as possible. It mixes the input channels down and forwards the samples, in
 * chunks, straight to the analysis worker (pitch-worker.ts) over a MessagePort handed to
 * it by the engine. The spectral analysis takes milliseconds per hop, more than a
 * 128-sample render quantum (2.7 ms) allows on a phone. Bundled to
 * public/worklets/pitch-processor.js by next.config.ts.
 */

// AudioWorkletGlobalScope members (not part of the DOM lib typings).
declare function registerProcessor(name: string, processor: unknown): void;
declare class AudioWorkletProcessor {
  readonly port: MessagePort;
}

/** Samples per message to the worker (~5 ms at 48 kHz: the analysis gets them sooner). */
const CHUNK = 256;
/** Spare chunks: the worker sends each one back once read, so the audio thread never
 *  allocates (no garbage-collection pause where a glitch would be heard). */
const POOL = 16;

class PitchProcessor extends AudioWorkletProcessor {
  private worker: MessagePort | null = null;
  private readonly pool: Float32Array[] = Array.from(
    { length: POOL },
    () => new Float32Array(CHUNK),
  );
  private chunk: Float32Array | null = null;
  private filled = 0;

  constructor() {
    super();
    this.port.onmessage = (e: MessageEvent<{ port?: MessagePort }>) => {
      const port = e.data.port;
      if (!port) return;
      this.worker = port;
      port.onmessage = (back: MessageEvent<Float32Array>) => {
        if (back.data.length === CHUNK && this.pool.length < POOL) this.pool.push(back.data);
      };
    };
  }

  process(inputs: Float32Array[][]): boolean {
    const channels = inputs[0];
    if (!channels?.length || !this.worker) return true;
    const length = channels[0].length;
    for (let i = 0; i < length; i++) {
      // Desktop sound cards and audio interfaces often deliver stereo, with the guitar on
      // only one side (e.g. input 2 = right). Summing every channel catches it wherever it is.
      let sample = 0;
      for (const channel of channels) sample += channel[i];
      // Pool empty (the worker is behind): allocate rather than drop samples.
      this.chunk ??= this.pool.pop() ?? new Float32Array(CHUNK);
      this.chunk[this.filled++] = sample;
      if (this.filled === CHUNK) {
        this.worker.postMessage(this.chunk, [this.chunk.buffer]);
        this.chunk = null;
        this.filled = 0;
      }
    }
    return true;
  }
}

registerProcessor("pitch-processor", PitchProcessor);
