/** Minimum time between two in-tune chimes. */
export const CHIME_COOLDOWN_MS = 2000;
/** Silence that counts as the end of a note (the next one may chime again). */
export const NEW_NOTE_SILENCE_MS = 700;

export interface FeedbackState {
  /** Note (string) already confirmed in tune, until it ends. */
  note: string | null;
  /** When the last chime played. */
  at: number;
  /** Start of the current silence, 0 while a note is heard. */
  silentSince: number;
}

export const initialFeedback = (): FeedbackState => ({ note: null, at: -Infinity, silentSince: 0 });

/**
 * Whether to play the in-tune chime (and buzz) now. Once per note: a new chime needs
 * another string, or the sound to stop for a moment (a new pluck), and never comes sooner
 * than the cooldown — however the reading flickers around the in-tune threshold.
 * Mutates `state`.
 */
export function shouldChime(
  state: FeedbackState,
  {
    now,
    note,
    inTune,
    silent,
  }: { now: number; note: string | null; inTune: boolean; silent: boolean },
): boolean {
  if (silent) {
    state.silentSince ||= now;
    if (now - state.silentSince >= NEW_NOTE_SILENCE_MS) state.note = null;
    return false;
  }
  state.silentSince = 0;
  if (!inTune || note === null || note === state.note || now - state.at < CHIME_COOLDOWN_MS) {
    return false;
  }
  state.note = note;
  state.at = now;
  return true;
}
