/**
 * AudioWorklet processor: runs the pitch analysis off the main thread and posts one
 * {@link PitchReading} per analysis hop. Bundled to public/worklets/pitch-processor.js by
 * scripts/build-worklet.mjs.
 */
import { PitchAnalyzer } from "../pitch/analyzer";

// AudioWorkletGlobalScope members (not part of the DOM lib typings).
declare const sampleRate: number;
declare function registerProcessor(name: string, processor: unknown): void;
declare class AudioWorkletProcessor {
  readonly port: MessagePort;
}

class PitchProcessor extends AudioWorkletProcessor {
  private readonly analyzer = new PitchAnalyzer(sampleRate);

  process(inputs: Float32Array[][]): boolean {
    const channel = inputs[0]?.[0];
    if (channel) {
      for (const reading of this.analyzer.push(channel)) this.port.postMessage(reading);
    }
    return true;
  }
}

registerProcessor("pitch-processor", PitchProcessor);
