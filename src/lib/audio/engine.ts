import type { PitchReading } from "../pitch/analyzer";

export type MicStatus =
  | "idle"
  | "starting"
  | "running"
  /** Microphone granted, but the browser keeps audio paused until the user taps. */
  | "suspended"
  | "denied"
  | "nomic"
  | "insecure"
  | "unsupported"
  | "error";

export interface EngineSnapshot {
  status: MicStatus;
  /** Smoothed detected frequency (Hz), null when nothing stable is heard. */
  frequency: number | null;
  /** Input level (RMS of the band-passed signal), rounded; 0 when not listening. */
  level: number;
}

const IDLE: EngineSnapshot = { status: "idle", frequency: null, level: 0 };

const WORKLET_URL = "/worklets/pitch-processor.js";
const RESUME_TIMEOUT_MS = 400;
const GESTURES = ["pointerdown", "keydown", "touchend"] as const;

function errorStatus(error: unknown): MicStatus {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") return "denied";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "nomic";
  return "error";
}

/** True when the user has already blocked the microphone (no prompt would be shown). */
async function permissionDenied(): Promise<boolean> {
  try {
    const status = await navigator.permissions?.query({ name: "microphone" as PermissionName });
    return status?.state === "denied";
  } catch {
    return false; // Permissions API without "microphone" (older Safari/Firefox).
  }
}

/** Resolves once the context runs, or after a timeout (autoplay policy may block it). */
function tryResume(ctx: AudioContext): Promise<void> {
  return Promise.race([
    ctx.resume().catch(() => {}),
    new Promise<void>((resolve) => setTimeout(resolve, RESUME_TIMEOUT_MS)),
  ]);
}

/**
 * Microphone → AudioWorklet pitch pipeline, exposed as an external store
 * (`useSyncExternalStore`). Starts without a user gesture: the microphone is requested
 * first, and the AudioContext is created afterwards, which browsers allow while capturing.
 * If a browser still keeps audio suspended, the next tap anywhere resumes it.
 * Also holds a screen wake lock while listening.
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
    const s = this.snapshot;
    if (merged.status === s.status && merged.frequency === s.frequency && merged.level === s.level)
      return;
    this.snapshot = merged;
    this.listeners.forEach((l) => l());
  }

  async start(): Promise<void> {
    const { status } = this.snapshot;
    if (status === "starting" || status === "running" || status === "suspended") return;
    if (!window.isSecureContext) return this.setSnapshot({ status: "insecure" });
    if (!navigator.mediaDevices?.getUserMedia || typeof AudioWorkletNode === "undefined") {
      return this.setSnapshot({ status: "unsupported" });
    }

    const session = ++this.session;
    this.setSnapshot({ status: "starting", frequency: null, level: 0 });
    if (await permissionDenied()) {
      if (session === this.session) this.setSnapshot({ status: "denied" });
      return;
    }

    try {
      // No channelCount constraint: some desktop drivers reject or ignore it. The worklet
      // mixes whatever channels arrive.
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
        video: false,
      });
      if (session !== this.session) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      this.stream = stream;

      const ctx = new AudioContext({ latencyHint: "interactive" });
      this.ctx = ctx;
      await ctx.audioWorklet.addModule(WORKLET_URL);
      if (session !== this.session) return this.release();

      const source = ctx.createMediaStreamSource(stream);
      const node = new AudioWorkletNode(ctx, "pitch-processor", { numberOfInputs: 1 });
      // A silent path to the destination keeps the node in the rendering graph everywhere.
      const mute = ctx.createGain();
      mute.gain.value = 0;
      source.connect(node).connect(mute).connect(ctx.destination);
      node.port.onmessage = (e: MessageEvent<PitchReading>) => this.onReading(e.data);
      stream.getAudioTracks()[0]?.addEventListener("ended", () => this.stop());
      ctx.onstatechange = () => this.syncState();

      await tryResume(ctx);
      if (session !== this.session) return this.release();
      document.addEventListener("visibilitychange", this.onVisibility);
      GESTURES.forEach((g) => document.addEventListener(g, this.onGesture, true));
      this.syncState();
      void this.acquireWakeLock();
    } catch (error) {
      this.release();
      if (session === this.session)
        this.setSnapshot({ status: errorStatus(error), frequency: null, level: 0 });
    }
  }

  stop(): void {
    this.session++;
    this.release();
    this.setSnapshot(IDLE);
  }

  /** Resumes audio that the browser kept suspended; call from a user gesture. */
  resume(): void {
    void this.ctx?.resume();
  }

  /** Ignores the microphone for a while, e.g. while a reference tone is playing. */
  suppress(ms: number): void {
    this.suppressedUntil = performance.now() + ms;
    this.setSnapshot({ frequency: null });
  }

  private syncState() {
    const ctx = this.ctx;
    if (!ctx || ctx.state === "closed") return;
    this.setSnapshot({ status: ctx.state === "running" ? "running" : "suspended" });
  }

  private onReading(reading: PitchReading) {
    if (this.snapshot.status !== "running") return;
    const muted = performance.now() < this.suppressedUntil;
    this.setSnapshot({
      frequency: muted ? null : reading.frequency,
      level: Math.round(reading.rms * 1000) / 1000,
    });
  }

  private onGesture = () => {
    if (this.ctx?.state === "suspended") void this.ctx.resume();
  };

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
    GESTURES.forEach((g) => document.removeEventListener(g, this.onGesture, true));
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    if (this.ctx) this.ctx.onstatechange = null;
    void this.ctx?.close().catch(() => {});
    this.ctx = null;
    void this.wakeLock?.release().catch(() => {});
    this.wakeLock = null;
  }
}

export const tunerEngine = new TunerEngine();
