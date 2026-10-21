/**
 * Analysis worker: receives raw samples from the AudioWorklet over a MessagePort and runs
 * the full pitch analysis off both the audio thread and the UI thread, posting one
 * {@link PitchReading} per analysis hop to the page. Bundled to
 * public/worklets/pitch-worker.js by next.config.ts.
 */
import { PitchAnalyzer, type PitchReading } from "../pitch/analyzer";

interface Setup {
  /** Port whose other end belongs to the AudioWorklet. */
  port: MessagePort;
  sampleRate: number;
}

const scope = self as unknown as {
  onmessage: ((e: MessageEvent<Setup>) => void) | null;
  postMessage: (reading: PitchReading) => void;
};

scope.onmessage = ({ data }) => {
  const analyzer = new PitchAnalyzer(data.sampleRate);
  data.port.onmessage = (e: MessageEvent<Float32Array>) => {
    for (const reading of analyzer.push(e.data)) scope.postMessage(reading);
  };
};
