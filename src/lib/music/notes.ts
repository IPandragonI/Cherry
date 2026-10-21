/** Pitch classes using the most common guitar spellings. */
export const NOTE_NAMES = [
  "C",
  "C#",
  "D",
  "Eb",
  "E",
  "F",
  "F#",
  "G",
  "Ab",
  "A",
  "Bb",
  "B",
] as const;

export type NoteName = (typeof NOTE_NAMES)[number];

const SOLFEGE = [
  "Do",
  "Do♯",
  "Ré",
  "Mi♭",
  "Mi",
  "Fa",
  "Fa♯",
  "Sol",
  "La♭",
  "La",
  "Si♭",
  "Si",
] as const;

export const DEFAULT_A4 = 440;
export const MIN_A4 = 415;
export const MAX_A4 = 466;

const A4_MIDI = 69;

export function pitchClass(midi: number): number {
  return ((Math.round(midi) % 12) + 12) % 12;
}

export function noteName(midi: number): NoteName {
  return NOTE_NAMES[pitchClass(midi)];
}

export function solfegeName(midi: number): string {
  return SOLFEGE[pitchClass(midi)];
}

/** Scientific pitch notation octave (C4 = middle C = MIDI 60). */
export function octaveOf(midi: number): number {
  return Math.floor(Math.round(midi) / 12) - 1;
}

/** Pretty display name with real accidentals, e.g. "F♯", "B♭". */
export function displayNote(name: string): string {
  return name.replace("#", "♯").replace(/(?<=[A-G])b/, "♭");
}

export function midiToFrequency(midi: number, a4 = DEFAULT_A4): number {
  return a4 * 2 ** ((midi - A4_MIDI) / 12);
}

/** Fractional MIDI number for a frequency. */
export function frequencyToMidi(frequency: number, a4 = DEFAULT_A4): number {
  return A4_MIDI + 12 * Math.log2(frequency / a4);
}

/** Signed distance in cents from `reference` to `frequency`. */
export function centsBetween(frequency: number, reference: number): number {
  return 1200 * Math.log2(frequency / reference);
}

export function clampCents(cents: number, limit = 50): number {
  return Math.max(-limit, Math.min(limit, cents));
}

export interface NearestNote {
  midi: number;
  name: NoteName;
  octave: number;
  cents: number;
}

export function nearestNote(frequency: number, a4 = DEFAULT_A4): NearestNote {
  const exact = frequencyToMidi(frequency, a4);
  const midi = Math.round(exact);
  return { midi, name: noteName(midi), octave: octaveOf(midi), cents: (exact - midi) * 100 };
}

const NOTE_PATTERN = /^([A-G])([#b♯♭]?)(-?\d)$/;
const LETTER_OFFSETS: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** Parses "E2", "F#3", "Bb4" into a MIDI number. */
export function parseNote(note: string): number {
  const match = NOTE_PATTERN.exec(note.trim());
  if (!match) throw new Error(`Invalid note: ${note}`);
  const [, letter, accidental, octave] = match;
  const shift = accidental === "#" || accidental === "♯" ? 1 : accidental ? -1 : 0;
  return (Number(octave) + 1) * 12 + LETTER_OFFSETS[letter] + shift;
}

export function formatNote(midi: number): string {
  return `${noteName(midi)}${octaveOf(midi)}`;
}

export type Notation = "letters" | "solfege";

/** A pitch's name in the chosen convention: "F♯" / "Fa♯". */
export function noteLabel(midi: number, notation: Notation): string {
  return notation === "solfege" ? solfegeName(midi) : displayNote(noteName(midi));
}
