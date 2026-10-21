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
  private mix = new Float32Array(128);

  process(inputs: Float32Array[][]): boolean {
    const channels = inputs[0];
    if (!channels?.length) return true;
    // Desktop sound cards and audio interfaces often deliver stereo, with the guitar on
    // only one side (e.g. input 2 = right). Summing every channel catches it wherever it is.
    let samples = channels[0];
    if (channels.length > 1) {
      if (this.mix.length !== samples.length) this.mix = new Float32Array(samples.length);
      this.mix.fill(0);
      for (const channel of channels) {
        for (let i = 0; i < channel.length; i++) this.mix[i] += channel[i];
      }
      samples = this.mix;
    }
    for (const reading of this.analyzer.push(samples)) this.port.postMessage(reading);
    return true;
  }
}

registerProcessor("pitch-processor", PitchProcessor);
