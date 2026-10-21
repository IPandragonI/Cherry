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

/** Samples per message to the worker (~10 ms at 48 kHz). */
const CHUNK = 512;

class PitchProcessor extends AudioWorkletProcessor {
  private worker: MessagePort | null = null;
  private chunk = new Float32Array(CHUNK);
  private filled = 0;

  constructor() {
    super();
    this.port.onmessage = (e: MessageEvent<{ port?: MessagePort }>) => {
      if (e.data.port) this.worker = e.data.port;
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
      this.chunk[this.filled++] = sample;
      if (this.filled === CHUNK) {
        this.worker.postMessage(this.chunk, [this.chunk.buffer]);
        this.chunk = new Float32Array(CHUNK);
        this.filled = 0;
      }
    }
    return true;
  }
}

registerProcessor("pitch-processor", PitchProcessor);
