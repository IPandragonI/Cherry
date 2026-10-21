import { create } from "zustand";
import { MAX_BPM, MIN_BPM } from "@/store/settings";

/** How far ahead clicks are queued on the audio clock, and how often the queue is topped up. */
const LOOKAHEAD_S = 0.12;
const TICK_MS = 25;
const CLICK_S = 0.05;

/**
 * Tempo from tap times (ms): median interval of the recent taps, ignoring anything
 * before a pause of over 2 s. Returns null until there are two usable taps.
 */
export function tapTempo(taps: number[]): number | null {
  const recent: number[] = [];
  for (let i = taps.length - 1; i >= 0; i--) {
    if (recent.length && recent[0] - taps[i] > 2000) break;
    recent.unshift(taps[i]);
    if (recent.length === 8) break;
  }
  if (recent.length < 2) return null;
  const intervals = recent
    .slice(1)
    .map((t, i) => t - recent[i])
    .sort((a, b) => a - b);
  const median = intervals[intervals.length >> 1];
  return Math.round(Math.min(MAX_BPM, Math.max(MIN_BPM, 60000 / median)));
}

/** Traditional tempo marking for a BPM (shown under the number). */
export function tempoMarking(bpm: number): string {
  if (bpm < 60) return "Largo";
  if (bpm < 76) return "Adagio";
  if (bpm < 108) return "Andante";
  if (bpm < 120) return "Moderato";
  if (bpm < 168) return "Allegro";
  return "Presto";
}

interface MetronomeState {
  playing: boolean;
  /** Beat currently sounding (0 = downbeat), -1 when stopped. */
  beat: number;
}

/**
 * Metronome on the Web Audio clock: a short timer keeps queueing clicks slightly ahead
 * with sample-accurate start times, so the beat stays steady even when the page is busy.
 * The visual beat follows the audio clock too (rAF compares it with the queued beats).
 */
class Metronome {
  readonly store = create<MetronomeState>()(() => ({ playing: false, beat: -1 }));
  private ctx: AudioContext | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private raf = 0;
  private nextTime = 0;
  private nextBeat = 0;
  private queue: { time: number; beat: number }[] = [];
  private bpm = 90;
  private beats = 4;
  private wakeLock: WakeLockSentinel | null = null;

  configure(bpm: number, beatsPerBar: number) {
    this.bpm = bpm;
    this.beats = beatsPerBar;
    if (this.nextBeat >= beatsPerBar) this.nextBeat = 0;
  }

  /** Call from a user gesture (audio may only start then). */
  start() {
    if (this.timer) return;
    this.ctx ??= new AudioContext({ latencyHint: "interactive" });
    void this.ctx.resume();
    this.nextTime = this.ctx.currentTime + 0.06;
    this.nextBeat = 0;
    this.queue = [];
    this.timer = setInterval(() => this.schedule(), TICK_MS);
    this.schedule();
    this.store.setState({ playing: true });
    this.raf = requestAnimationFrame(this.draw);
    void navigator.wakeLock
      ?.request("screen")
      .then((lock) => (this.wakeLock = lock))
      .catch(() => {});
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    cancelAnimationFrame(this.raf);
    this.queue = [];
    this.store.setState({ playing: false, beat: -1 });
    void this.wakeLock?.release().catch(() => {});
    this.wakeLock = null;
  }

  private schedule() {
    const ctx = this.ctx;
    if (!ctx) return;
    while (this.nextTime < ctx.currentTime + LOOKAHEAD_S) {
      this.click(this.nextTime, this.nextBeat === 0);
      this.queue.push({ time: this.nextTime, beat: this.nextBeat });
      this.nextTime += 60 / this.bpm;
      this.nextBeat = (this.nextBeat + 1) % this.beats;
    }
  }

  private click(time: number, accent: boolean) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = accent ? 1760 : 1180;
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(accent ? 0.9 : 0.55, time + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + CLICK_S);
    osc.connect(gain).connect(ctx.destination);
    osc.start(time);
    osc.stop(time + CLICK_S + 0.01);
  }

  private draw = () => {
    const now = this.ctx?.currentTime ?? 0;
    let beat = -1;
    while (this.queue.length && this.queue[0].time <= now) beat = this.queue.shift()!.beat;
    if (beat >= 0) this.store.setState({ beat });
    this.raf = requestAnimationFrame(this.draw);
  };
}

export const metronome = new Metronome();
