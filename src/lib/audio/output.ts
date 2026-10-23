/**
 * The one AudioContext everything that plays sound shares (reference tones, the in-tune
 * chime, the drone, the metronome): each context holds an output stream and keeps the
 * audio hardware awake, and browsers cap how many a page may open. The tuner's microphone
 * context stays separate, since it is closed whenever the microphone is released.
 */
let ctx: AudioContext | null = null;

/** Creates the context on first use; call from a user gesture so it may start. */
export function outputContext(): AudioContext {
  if (!ctx || ctx.state === "closed") ctx = new AudioContext({ latencyHint: "interactive" });
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}
