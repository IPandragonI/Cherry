/**
 * Analysis worker: receives raw samples from the AudioWorklet over a MessagePort and runs
 * the full pitch analysis off both the audio thread and the UI thread, posting one
 * {@link PitchReading} per analysis hop to the page. It can also capture the raw input
 * for the audio diagnostic's recorder. Bundled to public/worklets/pitch-worker.js by
 * next.config.ts.
 */
import { PitchAnalyzer, type PitchReading } from "../pitch/analyzer";

/** Messages from the page. */
export type WorkerCommand =
  { type: "setup"; port: MessagePort; sampleRate: number } | { type: "record"; seconds: number };

/** Messages to the page. */
export type WorkerEvent =
  | ({ type: "reading" } & PitchReading)
  | { type: "recording"; samples: Float32Array; sampleRate: number };

const scope = self as unknown as {
  onmessage: ((e: MessageEvent<WorkerCommand>) => void) | null;
  postMessage: (event: WorkerEvent, transfer?: Transferable[]) => void;
};

let sampleRate = 48000;
let recording: { buffer: Float32Array; filled: number } | null = null;

function capture(chunk: Float32Array) {
  if (!recording) return;
  const room = recording.buffer.length - recording.filled;
  recording.buffer.set(chunk.subarray(0, room), recording.filled);
  recording.filled += Math.min(room, chunk.length);
  if (recording.filled === recording.buffer.length) {
    const samples = recording.buffer;
    recording = null;
    scope.postMessage({ type: "recording", samples, sampleRate }, [samples.buffer]);
  }
}

scope.onmessage = ({ data }) => {
  if (data.type === "record") {
    recording = { buffer: new Float32Array(Math.round(data.seconds * sampleRate)), filled: 0 };
    return;
  }
  sampleRate = data.sampleRate;
  const analyzer = new PitchAnalyzer(sampleRate);
  data.port.onmessage = (e: MessageEvent<Float32Array>) => {
    capture(e.data);
    for (const reading of analyzer.push(e.data)) scope.postMessage({ type: "reading", ...reading });
  };
};
