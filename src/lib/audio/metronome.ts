import { create } from "zustand";
import { unlockPlayback } from "./audioSession";
import { MAX_BPM, MIN_BPM } from "@/store/settings";

/** How far ahead clicks are queued on the audio clock, and how often the queue is topped up. */
const LOOKAHEAD_S = 0.12;
const TICK_MS = 25;
const CLICK_S = 0.05;

export type MetronomeSound = "click" | "beep" | "woodblock" | "rimshot";
export const METRONOME_SOUNDS: MetronomeSound[] = ["click", "beep", "woodblock", "rimshot"];

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
  private sound: MetronomeSound = "click";
  private noise: AudioBuffer | null = null;
  private wakeLock: WakeLockSentinel | null = null;

  configure(bpm: number, beatsPerBar: number, sound: MetronomeSound) {
    this.bpm = bpm;
    this.beats = beatsPerBar;
    this.sound = sound;
    if (this.nextBeat >= beatsPerBar) this.nextBeat = 0;
  }

  /** One accented hit of a sound, e.g. when choosing it (call from a user gesture). */
  preview(sound: MetronomeSound) {
    this.ctx ??= new AudioContext({ latencyHint: "interactive" });
    unlockPlayback(this.ctx);
    this.hit(sound, this.ctx.currentTime + 0.03, true);
  }

  /** Call from a user gesture (audio may only start then). */
  start() {
    if (this.timer) return;
    this.ctx ??= new AudioContext({ latencyHint: "interactive" });
    unlockPlayback(this.ctx);
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
    this.hit(this.sound, time, accent);
  }

  private hit(sound: MetronomeSound, time: number, accent: boolean) {
    const ctx = this.ctx!;
    const out = ctx.createGain();
    out.connect(ctx.destination);
    // Fast attack, exponential decay to silence.
    const envelope = (peak: number, decay: number) => {
      out.gain.setValueAtTime(0.0001, time);
      out.gain.exponentialRampToValueAtTime(peak, time + 0.002);
      out.gain.exponentialRampToValueAtTime(0.0001, time + decay);
    };

    if (sound === "click" || sound === "beep") {
      // Classic click: short sine blip. Digital beep: longer square tone, drum-machine style.
      const osc = ctx.createOscillator();
      const beep = sound === "beep";
      osc.type = beep ? "square" : "sine";
      osc.frequency.value = beep ? (accent ? 1320 : 880) : accent ? 1760 : 1180;
      envelope(beep ? (accent ? 0.32 : 0.2) : accent ? 0.9 : 0.55, beep ? 0.09 : CLICK_S);
      osc.connect(out);
      osc.start(time);
      osc.stop(time + 0.12);
      return;
    }

    // Percussion: a burst of noise through a resonant band-pass.
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer();
    const band = ctx.createBiquadFilter();
    band.type = "bandpass";
    noise.connect(band).connect(out);
    if (sound === "woodblock") {
      band.frequency.value = accent ? 1900 : 1350;
      band.Q.value = 12;
      envelope(accent ? 3.2 : 2.2, 0.07);
    } else {
      // Rimshot: bright crack over a short body tone.
      band.frequency.value = accent ? 3200 : 2600;
      band.Q.value = 1.4;
      envelope(accent ? 1.1 : 0.75, 0.06);
      const body = ctx.createOscillator();
      const bodyGain = ctx.createGain();
      body.type = "triangle";
      body.frequency.value = accent ? 420 : 330;
      bodyGain.gain.setValueAtTime(accent ? 0.6 : 0.4, time);
      bodyGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);
      body.connect(bodyGain).connect(ctx.destination);
      body.start(time);
      body.stop(time + 0.08);
    }
    noise.start(time);
    noise.stop(time + 0.1);
  }

  private noiseBuffer(): AudioBuffer {
    const ctx = this.ctx!;
    if (!this.noise || this.noise.sampleRate !== ctx.sampleRate) {
      const length = Math.floor(ctx.sampleRate * 0.1);
      this.noise = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    }
    return this.noise;
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
