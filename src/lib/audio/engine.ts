import type { PitchReading } from "../pitch/analyzer";

export type MicStatus =
  "idle" | "starting" | "running" | "denied" | "nomic" | "insecure" | "unsupported" | "error";

export interface EngineSnapshot {
  status: MicStatus;
  /** Smoothed detected frequency (Hz), null when nothing stable is heard. */
  frequency: number | null;
}

const IDLE: EngineSnapshot = { status: "idle", frequency: null };

const WORKLET_URL = "/worklets/pitch-processor.js";

function errorStatus(error: unknown): MicStatus {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") return "denied";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "nomic";
  return "error";
}

/**
 * Microphone → AudioWorklet pitch pipeline, exposed as an external store
 * (`useSyncExternalStore`). Also holds a screen wake lock while listening.
 */
class TunerEngine {
  private snapshot: EngineSnapshot = IDLE;
  private readonly listeners = new Set<() => void>();
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private wakeLock: WakeLockSentinel | null = null;
  private suppressedUntil = 0;
  private session = 0;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = () => this.snapshot;

  getServerSnapshot = () => IDLE;

  private setSnapshot(next: Partial<EngineSnapshot>) {
    const merged = { ...this.snapshot, ...next };
    if (merged.status === this.snapshot.status && merged.frequency === this.snapshot.frequency)
      return;
    this.snapshot = merged;
    this.listeners.forEach((l) => l());
  }

  /** Must be called from a user gesture (iOS requires it to start audio). */
  async start(): Promise<void> {
    const { status } = this.snapshot;
    if (status === "starting" || status === "running") return;
    if (!window.isSecureContext) return this.setSnapshot({ status: "insecure" });
    if (!navigator.mediaDevices?.getUserMedia || typeof AudioWorkletNode === "undefined") {
      return this.setSnapshot({ status: "unsupported" });
    }

    const session = ++this.session;
    this.setSnapshot({ status: "starting", frequency: null });
    // Created synchronously inside the gesture so Safari allows it to run.
    const ctx = new AudioContext({ latencyHint: "interactive" });
    this.ctx = ctx;
    void ctx.resume();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
        video: false,
      });
      this.stream = stream;
      if (session !== this.session) return this.release();

      await ctx.audioWorklet.addModule(WORKLET_URL);
      const source = ctx.createMediaStreamSource(stream);
      const node = new AudioWorkletNode(ctx, "pitch-processor", {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        channelCount: 1,
      });
      // A silent path to the destination keeps the node in the rendering graph everywhere.
      const mute = ctx.createGain();
      mute.gain.value = 0;
      source.connect(node).connect(mute).connect(ctx.destination);
      node.port.onmessage = (e: MessageEvent<PitchReading>) => this.onReading(e.data);
      stream.getAudioTracks()[0]?.addEventListener("ended", () => this.stop());

      await ctx.resume();
      if (session !== this.session) return this.release();
      this.setSnapshot({ status: "running" });
      document.addEventListener("visibilitychange", this.onVisibility);
      void this.acquireWakeLock();
    } catch (error) {
      this.release();
      if (session === this.session)
        this.setSnapshot({ status: errorStatus(error), frequency: null });
    }
  }

  stop(): void {
    this.session++;
    this.release();
    this.setSnapshot(IDLE);
  }

  /** Ignores the microphone for a while, e.g. while a reference tone is playing. */
  suppress(ms: number): void {
    this.suppressedUntil = performance.now() + ms;
    this.setSnapshot({ frequency: null });
  }

  private onReading(reading: PitchReading) {
    if (this.snapshot.status !== "running") return;
    const muted = performance.now() < this.suppressedUntil;
    this.setSnapshot({ frequency: muted ? null : reading.frequency });
  }

  private onVisibility = () => {
    if (document.visibilityState !== "visible") return;
    void this.ctx?.resume();
    void this.acquireWakeLock();
  };

  private async acquireWakeLock() {
    if (!("wakeLock" in navigator) || this.wakeLock) return;
    try {
      this.wakeLock = await navigator.wakeLock.request("screen");
      this.wakeLock.addEventListener("release", () => (this.wakeLock = null));
    } catch {
      // Not granted (e.g. low battery mode): tuning still works.
    }
  }

  private release() {
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    void this.ctx?.close().catch(() => {});
    this.ctx = null;
    void this.wakeLock?.release().catch(() => {});
    this.wakeLock = null;
  }
}

export const tunerEngine = new TunerEngine();
