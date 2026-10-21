import type { PitchReading } from "../pitch/analyzer";
import type { WorkerCommand, WorkerEvent } from "./pitch-worker";
import { setRecording } from "./audioSession";
import { ReadingHold } from "./readingHold";

export type MicStatus =
  | "idle"
  /** Turned off by the user (mic toggle); stays off until turned back on. */
  | "off"
  | "starting"
  | "running"
  /** Microphone granted, but the browser keeps audio paused until the user taps. */
  | "suspended"
  | "denied"
  | "nomic"
  | "insecure"
  | "unsupported"
  | "error";

/** What the browser actually gave us, for the diagnostic panel. */
export interface AudioInfo {
  /** AudioContext rate: the rate the pitch analysis runs at. */
  contextRate: number;
  /** Capture rate reported by the microphone track, when the browser exposes it. */
  trackRate: number | null;
  channels: number | null;
  device: string;
}

export interface EngineSnapshot {
  status: MicStatus;
  /** Smoothed detected frequency (Hz), null when nothing stable is heard. */
  frequency: number | null;
  /** Input level (RMS of the band-passed signal), rounded; 0 when not listening. */
  level: number;
  info: AudioInfo | null;
}

const IDLE: EngineSnapshot = { status: "idle", frequency: null, level: 0, info: null };

const WORKLET_URL = "/worklets/pitch-processor.js";
const WORKER_URL = "/worklets/pitch-worker.js";
const RESUME_TIMEOUT_MS = 400;
/** The analysis posts every ~21 ms; this much silence from it means the chain is dead. */
const STALL_MS = 1500;
const WATCHDOG_MS = 1000;
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

const pageVisible = () => document.visibilityState === "visible";

/** 16-bit PCM mono WAV. */
function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const view = new DataView(new ArrayBuffer(44 + samples.length * 2));
  const text = (offset: number, s: string) =>
    [...s].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
  text(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  text(8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, samples.length * 2, true);
  samples.forEach((v, i) => view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, v)) * 0x7fff, true));
  return new Blob([view], { type: "audio/wav" });
}

/**
 * Microphone → AudioWorklet pitch pipeline, exposed as an external store
 * (`useSyncExternalStore`).
 *
 * Lifecycle: the tuner screen calls `start()` (it *wants* to listen) and `stop()` when it
 * goes away. In between, the engine keeps the audio chain alive on its own: it releases the
 * microphone while the page is hidden and rebuilds the chain from scratch when the page is
 * shown or focused again, and a watchdog rebuilds it if the track ends (mobile
 * interruptions), the context is closed or interrupted, or the worklet stops reporting.
 * Browsers that keep audio suspended until a gesture are resumed on the next tap.
 */
class TunerEngine {
  private snapshot: EngineSnapshot = IDLE;
  private readonly listeners = new Set<() => void>();
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private worker: Worker | null = null;
  private onRecording: ((samples: Float32Array, sampleRate: number) => void) | null = null;
  private readonly hold = new ReadingHold();
  private watchdog: ReturnType<typeof setInterval> | null = null;
  private lastMessageAt = 0;
  private suppressedUntil = 0;
  private session = 0;
  private connecting = false;
  /** The tuner screen is showing and wants to listen. */
  private wanted = false;
  /** Set by the mic toggle; survives tab changes for the rest of the session. */
  private userDisabled = false;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = () => this.snapshot;

  getServerSnapshot = () => IDLE;

  private setSnapshot(next: Partial<EngineSnapshot>) {
    const merged = { ...this.snapshot, ...next };
    const s = this.snapshot;
    if (
      merged.status === s.status &&
      merged.frequency === s.frequency &&
      merged.level === s.level &&
      merged.info === s.info
    )
      return;
    this.snapshot = merged;
    this.listeners.forEach((l) => l());
  }

  /** The tuner screen wants to listen (idempotent). */
  async start(): Promise<void> {
    if (!this.wanted) {
      this.wanted = true;
      this.addLifecycleListeners();
    }
    if (this.userDisabled) return this.setSnapshot({ ...IDLE, status: "off" });
    if (!pageVisible()) return; // Connects when the page is shown.
    if (this.connecting || this.isHealthy()) return;
    await this.connect();
  }

  /** The tuner screen went away: release everything. */
  stop(): void {
    this.wanted = false;
    this.removeLifecycleListeners();
    this.teardown();
    this.setSnapshot(this.userDisabled ? { ...IDLE, status: "off" } : IDLE);
  }

  /** The user's mic toggle. Turning on from a click also satisfies autoplay policies. */
  setEnabled(enabled: boolean): void {
    this.userDisabled = !enabled;
    if (enabled) {
      if (this.ctx?.state === "suspended") void this.ctx.resume();
      void this.start();
    } else {
      this.teardown();
      this.setSnapshot({ ...IDLE, status: "off" });
    }
  }

  /** Resumes audio that the browser kept suspended; call from a user gesture. */
  resume(): void {
    if (this.ctx && this.ctx.state !== "closed") void this.ctx.resume();
    else void this.start();
  }

  /**
   * Captures the raw microphone input (what the analysis hears) for the diagnostic, so a
   * real-world problem can be replayed exactly. Resolves with a 16-bit mono WAV.
   */
  record(seconds: number): Promise<Blob> {
    const worker = this.worker;
    if (!worker || this.snapshot.status !== "running") {
      return Promise.reject(new Error("not listening"));
    }
    return new Promise((resolve) => {
      this.onRecording = (samples, sampleRate) => {
        this.onRecording = null;
        resolve(encodeWav(samples, sampleRate));
      };
      const command: WorkerCommand = { type: "record", seconds };
      worker.postMessage(command);
    });
  }

  /** Ignores the microphone for a while, e.g. while a reference tone is playing. */
  suppress(ms: number): void {
    this.suppressedUntil = performance.now() + ms;
    this.hold.reset();
    this.setSnapshot({ frequency: null });
  }

  // ── Audio chain ────────────────────────────────────────────────────────────────────

  private async connect(): Promise<void> {
    if (!window.isSecureContext) return this.setSnapshot({ status: "insecure" });
    if (!navigator.mediaDevices?.getUserMedia || typeof AudioWorkletNode === "undefined") {
      return this.setSnapshot({ status: "unsupported" });
    }

    this.teardown();
    const session = ++this.session;
    this.connecting = true;
    this.setSnapshot({ status: "starting", frequency: null, level: 0 });
    try {
      if (await permissionDenied()) {
        if (session === this.session) this.setSnapshot({ status: "denied" });
        return;
      }
      // iOS: recording needs the play-and-record audio session (reference tones still play).
      setRecording(true);
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
      if (session !== this.session) return;

      const source = ctx.createMediaStreamSource(stream);
      const node = new AudioWorkletNode(ctx, "pitch-processor", { numberOfInputs: 1 });
      // A silent path to the destination keeps the node in the rendering graph everywhere.
      const mute = ctx.createGain();
      mute.gain.value = 0;
      source.connect(node).connect(mute).connect(ctx.destination);
      // The worklet only forwards samples; the analysis runs in a worker, connected to it
      // directly so neither the audio thread nor the UI thread does the heavy lifting.
      const worker = new Worker(WORKER_URL);
      this.worker = worker;
      const channel = new MessageChannel();
      const setup: WorkerCommand = {
        type: "setup",
        port: channel.port2,
        sampleRate: ctx.sampleRate,
      };
      worker.postMessage(setup, [channel.port2]);
      node.port.postMessage({ port: channel.port1 }, [channel.port1]);
      worker.onmessage = ({ data }: MessageEvent<WorkerEvent>) => {
        if (data.type === "reading") this.onReading(data);
        else this.onRecording?.(data.samples, data.sampleRate);
      };

      const track = stream.getAudioTracks()[0];
      // Mobile OSes end the capture when the app is backgrounded or interrupted (phone
      // call, Siri…): rebuild as soon as the page is usable again. ("mute" is left alone:
      // an OS-level mute would otherwise cause a reconnect loop, and still delivers data.)
      track?.addEventListener("ended", () => this.recover(session));
      ctx.onstatechange = () => this.syncState();

      const settings = track?.getSettings();
      this.setSnapshot({
        info: {
          contextRate: ctx.sampleRate,
          trackRate: settings?.sampleRate ?? null,
          channels: settings?.channelCount ?? null,
          device: track?.label ?? "",
        },
      });

      await tryResume(ctx);
      if (session !== this.session) return;
      this.lastMessageAt = performance.now();
      this.watchdog = setInterval(() => this.checkHealth(session), WATCHDOG_MS);
      GESTURES.forEach((g) => document.addEventListener(g, this.onGesture, true));
      this.syncState();
    } catch (error) {
      if (session === this.session) {
        this.teardown();
        this.setSnapshot({ status: errorStatus(error), frequency: null, level: 0 });
      }
    } finally {
      if (session === this.session) this.connecting = false;
    }
  }

  /** Releases the microphone and the audio graph (the engine may still be wanted). */
  private teardown() {
    this.session++;
    this.connecting = false;
    if (this.watchdog) clearInterval(this.watchdog);
    this.watchdog = null;
    GESTURES.forEach((g) => document.removeEventListener(g, this.onGesture, true));
    if (this.stream) setRecording(false);
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.worker?.terminate();
    this.worker = null;
    if (this.ctx) this.ctx.onstatechange = null;
    void this.ctx?.close().catch(() => {});
    this.ctx = null;
    this.hold.reset();
  }

  private isHealthy(): boolean {
    const track = this.stream?.getAudioTracks()[0];
    return !!this.ctx && this.ctx.state !== "closed" && track?.readyState === "live";
  }

  /** Rebuild the chain if it broke while it was wanted (now, or when the page is shown). */
  private recover(session: number) {
    if (session !== this.session || !this.wanted || this.userDisabled) return;
    if (pageVisible()) void this.connect();
    else this.teardown();
  }

  private checkHealth(session: number) {
    if (session !== this.session || !pageVisible()) return;
    const state = this.ctx?.state as AudioContextState | "interrupted" | undefined;
    // A context the browser holds until a gesture is not broken: wait for the tap.
    if (state === "suspended" && navigator.userActivation?.hasBeenActive === false) return;
    if (state === "suspended" || state === "interrupted") {
      void this.ctx?.resume();
    }
    const stalled = state === "running" && performance.now() - this.lastMessageAt > STALL_MS;
    if (!this.isHealthy() || stalled) this.recover(session);
  }

  private syncState() {
    const ctx = this.ctx;
    if (!ctx || ctx.state === "closed") return;
    this.setSnapshot({ status: ctx.state === "running" ? "running" : "suspended" });
  }

  private onReading(reading: PitchReading) {
    this.lastMessageAt = performance.now();
    if (this.snapshot.status !== "running") return;
    const now = performance.now();
    const muted = now < this.suppressedUntil;
    this.setSnapshot({
      frequency: muted ? null : this.hold.update(reading.frequency, now),
      level: Math.round(reading.rms * 1000) / 1000,
    });
  }

  // ── Page lifecycle ─────────────────────────────────────────────────────────────────

  private onGesture = () => {
    if (this.ctx?.state === "suspended") void this.ctx.resume();
  };

  /** Page hidden: let the microphone go (mobile OSes revoke it anyway). */
  private onHidden = () => {
    if (pageVisible()) return;
    this.teardown();
    this.setSnapshot({ status: "idle", frequency: null, level: 0 });
  };

  /** Page shown or focused again: make sure we are actually listening. */
  private onShown = () => {
    if (!pageVisible() || !this.wanted || this.userDisabled) return;
    if (this.isHealthy()) {
      if (this.ctx?.state !== "running") void this.ctx?.resume();
      return;
    }
    if (!this.connecting) void this.connect();
  };

  private addLifecycleListeners() {
    document.addEventListener("visibilitychange", this.onHidden);
    document.addEventListener("visibilitychange", this.onShown);
    window.addEventListener("pagehide", this.onHidden);
    window.addEventListener("pageshow", this.onShown);
    window.addEventListener("focus", this.onShown);
  }

  private removeLifecycleListeners() {
    document.removeEventListener("visibilitychange", this.onHidden);
    document.removeEventListener("visibilitychange", this.onShown);
    window.removeEventListener("pagehide", this.onHidden);
    window.removeEventListener("pageshow", this.onShown);
    window.removeEventListener("focus", this.onShown);
  }
}

export const tunerEngine = new TunerEngine();
