import { create } from "zustand";
import { unlockPlayback } from "./audioSession";
import { outputContext } from "./output";
import { keepScreenAwake } from "./screenAwake";
import { MAX_BPM, MIN_BPM } from "@/store/settings";

/** How far ahead clicks are queued on the audio clock, and how often the queue is topped up. */
const LOOKAHEAD_S = 0.12;
/** While the page is hidden, timers may only fire once a second: queue further ahead. */
const HIDDEN_LOOKAHEAD_S = 2.5;
const TICK_MS = 25;

/**
 * Calls `tick` every `ms`. From a worker when possible: the page's own timers are slowed
 * to once a second (or less) in a background tab or with the screen off, which made the
 * clicks stop; a worker's timers keep running.
 */
function startTicker(tick: () => void, ms: number): () => void {
  try {
    const source = `let t;onmessage=e=>{clearInterval(t);if(e.data>0)t=setInterval(()=>postMessage(0),e.data)}`;
    const url = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
    const worker = new Worker(url);
    URL.revokeObjectURL(url);
    worker.onmessage = tick;
    worker.postMessage(ms);
    return () => worker.terminate();
  } catch {
    const timer = setInterval(tick, ms);
    return () => clearInterval(timer);
  }
}
const CLICK_S = 0.05;

export type MetronomeSound = "click" | "mechanical" | "beep" | "woodblock" | "rimshot" | "kick";
export const METRONOME_SOUNDS: MetronomeSound[] = [
  "click",
  "mechanical",
  "beep",
  "woodblock",
  "rimshot",
  "kick",
];

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
  /** Stops the scheduling ticker; null when stopped. */
  private stopTicker: (() => void) | null = null;
  /** Everything queued while playing goes through it, so stopping silences it at once. */
  private master: GainNode | null = null;
  private releaseScreen: (() => void) | null = null;
  private raf = 0;
  private nextTime = 0;
  private nextBeat = 0;
  private queue: { time: number; beat: number }[] = [];
  private bpm = 90;
  private beats = 4;
  private sound: MetronomeSound = "click";
  private noise: AudioBuffer | null = null;

  configure(bpm: number, beatsPerBar: number, sound: MetronomeSound) {
    this.bpm = bpm;
    this.beats = beatsPerBar;
    this.sound = sound;
    if (this.nextBeat >= beatsPerBar) this.nextBeat = 0;
  }

  /** One accented hit of a sound, e.g. when choosing it (call from a user gesture). */
  preview(sound: MetronomeSound) {
    this.ctx = outputContext();
    unlockPlayback(this.ctx);
    this.hit(sound, this.ctx.currentTime + 0.03, true);
  }

  /** Call from a user gesture (audio may only start then). */
  start() {
    if (this.stopTicker) return;
    const ctx = outputContext();
    this.ctx = ctx;
    unlockPlayback(ctx);
    this.master = ctx.createGain();
    this.master.connect(ctx.destination);
    this.nextTime = ctx.currentTime + 0.06;
    this.nextBeat = 0;
    this.queue = [];
    this.stopTicker = startTicker(() => this.schedule(), TICK_MS);
    this.schedule();
    this.store.setState({ playing: true });
    this.raf = requestAnimationFrame(this.draw);
    // Taken again whenever the browser drops it (the page was hidden, battery saver…).
    this.releaseScreen = keepScreenAwake();
  }

  stop() {
    this.stopTicker?.();
    this.stopTicker = null;
    // Clicks already queued ahead (up to seconds while hidden) must not play on.
    this.master?.disconnect();
    this.master = null;
    cancelAnimationFrame(this.raf);
    this.queue = [];
    this.store.setState({ playing: false, beat: -1 });
    this.releaseScreen?.();
    this.releaseScreen = null;
  }

  private schedule() {
    const ctx = this.ctx;
    if (!ctx) return;
    const ahead = document.visibilityState === "visible" ? LOOKAHEAD_S : HIDDEN_LOOKAHEAD_S;
    while (this.nextTime < ctx.currentTime + ahead) {
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
    // While playing, through the master bus (silenced on stop); a preview plays directly.
    const dest = this.master ?? ctx.destination;
    const out = ctx.createGain();
    out.connect(dest);
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

    if (sound === "kick") {
      // Bass drum: a sine sweeping down fast, plus a soft beater click.
      const osc = ctx.createOscillator();
      osc.frequency.setValueAtTime(accent ? 160 : 140, time);
      osc.frequency.exponentialRampToValueAtTime(45, time + 0.12);
      envelope(accent ? 1.1 : 0.85, 0.35);
      osc.connect(out);
      osc.start(time);
      osc.stop(time + 0.4);
      const beater = ctx.createBufferSource();
      const beaterGain = ctx.createGain();
      const tone = ctx.createBiquadFilter();
      beater.buffer = this.noiseBuffer();
      tone.type = "lowpass";
      tone.frequency.value = 3000;
      beaterGain.gain.setValueAtTime(0.25, time);
      beaterGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.012);
      beater.connect(tone).connect(beaterGain).connect(dest);
      beater.start(time);
      beater.stop(time + 0.02);
      return;
    }

    if (sound === "mechanical") {
      // Pendulum metronome: a dry wooden tick from the escapement; the downbeat also rings
      // the little bell, as on the classic models.
      const tick = ctx.createBufferSource();
      const body = ctx.createBiquadFilter();
      const air = ctx.createBiquadFilter();
      tick.buffer = this.noiseBuffer();
      body.type = "bandpass";
      body.frequency.value = 3400;
      body.Q.value = 6;
      air.type = "highpass";
      air.frequency.value = 1500;
      tick.connect(air).connect(body).connect(out);
      envelope(1.6, 0.018);
      tick.start(time);
      tick.stop(time + 0.04);
      if (accent) {
        for (const [frequency, level] of [
          [2350, 0.22],
          [5870, 0.06],
        ]) {
          const bell = ctx.createOscillator();
          const ring = ctx.createGain();
          bell.frequency.value = frequency;
          ring.gain.setValueAtTime(0.0001, time);
          ring.gain.exponentialRampToValueAtTime(level, time + 0.003);
          ring.gain.exponentialRampToValueAtTime(0.0001, time + 0.6);
          bell.connect(ring).connect(dest);
          bell.start(time);
          bell.stop(time + 0.65);
        }
      }
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
      body.connect(bodyGain).connect(dest);
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
