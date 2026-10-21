/**
 * iOS routes Web Audio through the "ambient" channel, which the ring/silent switch mutes:
 * chords, reference tones and metronome clicks were silent on a phone in silent mode.
 * Playing through the media ("playback") channel ignores the switch, like music apps do.
 *
 * - iOS 17+: `navigator.audioSession.type = "playback"`.
 * - Older iOS: a silent <audio> element playing (started from a tap) moves the page to the
 *   media channel; it loops silently while the page is visible.
 * While the tuner records, the session must stay "play-and-record" instead.
 */

interface AudioSession {
  type: "auto" | "playback" | "transient" | "transient-solo" | "ambient" | "play-and-record";
}

const session = (): AudioSession | undefined =>
  typeof navigator !== "undefined"
    ? (navigator as Navigator & { audioSession?: AudioSession }).audioSession
    : undefined;

let recording = false;

/** iPhone/iPod, or an iPad (which reports itself as a Mac with a touch screen). */
const isAppleTouchDevice = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
let silent: HTMLAudioElement | null = null;

/** 100 ms of silence as a WAV blob URL (8 kHz, 16-bit mono). */
function silentWavUrl(): string {
  const frames = 800;
  const view = new DataView(new ArrayBuffer(44 + frames * 2));
  const text = (offset: number, s: string) =>
    [...s].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
  text(0, "RIFF");
  view.setUint32(4, 36 + frames * 2, true);
  text(8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, 8000, true);
  view.setUint32(28, 16000, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, frames * 2, true);
  return URL.createObjectURL(new Blob([view], { type: "audio/wav" }));
}

function playSilentElement() {
  if (!silent) {
    silent = new Audio(silentWavUrl());
    silent.loop = true;
    silent.setAttribute("playsinline", "");
    silent.setAttribute("x-webkit-airplay", "deny");
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState !== "visible") silent?.pause();
    });
  }
  void silent.play().catch(() => {});
}

/**
 * Call from the user gesture that starts a sound (play chord, start metronome, tap a
 * string): makes the output audible even with the silent switch on, and unlocks `ctx`.
 */
export function unlockPlayback(ctx?: AudioContext): void {
  const s = session();
  if (s) {
    if (!recording) s.type = "playback";
  } else if (isAppleTouchDevice()) {
    playSilentElement();
  }
  if (ctx) {
    // Classic Web Audio unlock: a one-sample silent buffer played inside the gesture.
    void ctx.resume();
    const source = ctx.createBufferSource();
    source.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
    source.connect(ctx.destination);
    source.start(0);
  }
}

/** The tuner's microphone is opening/closing: recording needs "play-and-record". */
export function setRecording(active: boolean): void {
  recording = active;
  const s = session();
  if (s) s.type = active ? "play-and-record" : "auto";
}
