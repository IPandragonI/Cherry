import {
  centsBetween,
  midiToFrequency,
  noteLabel,
  noteName,
  parseNote,
  type Notation,
} from "./notes";

export type Instrument = "guitar" | "bass" | "ukulele";
export const INSTRUMENTS: Instrument[] = ["guitar", "bass", "ukulele"];

export interface Tuning {
  id: string;
  /** i18n key for presets; free text for custom tunings. */
  name: string;
  /** MIDI numbers, lowest (thickest) string first. Any length (4, 6, 7, 8…). */
  strings: number[];
  /** Guitar when absent. */
  instrument?: Instrument;
  /**
   * Per-string deviation from equal temperament, in cents ("sweetened" tunings, e.g. a
   * slightly flat B string so open chords sound purer). All 0 when absent.
   */
  offsets?: number[];
  custom?: boolean;
}

/** Largest per-string offset accepted, either way (cents). */
export const MAX_OFFSET_CENTS = 50;

const preset = (id: string, notes: string, instrument: Instrument = "guitar"): Tuning => ({
  id,
  name: `tuning.${id}`,
  strings: notes.split(" ").map(parseNote),
  instrument,
});

export const PRESET_TUNINGS: Tuning[] = [
  preset("standard", "E2 A2 D3 G3 B3 E4"),
  preset("dropD", "D2 A2 D3 G3 B3 E4"),
  preset("doubleDropD", "D2 A2 D3 G3 B3 D4"),
  preset("dadgad", "D2 A2 D3 G3 A3 D4"),
  preset("openG", "D2 G2 D3 G3 B3 D4"),
  preset("openD", "D2 A2 D3 F#3 A3 D4"),
  preset("openE", "E2 B2 E3 G#3 B3 E4"),
  preset("openA", "E2 A2 E3 A3 C#4 E4"),
  preset("openC", "C2 G2 C3 G3 C4 E4"),
  preset("halfStepDown", "Eb2 Ab2 Db3 Gb3 Bb3 Eb4"),
  preset("fullStepDown", "D2 G2 C3 F3 A3 D4"),
  preset("sevenString", "B1 E2 A2 D3 G3 B3 E4"),
  preset("eightString", "F#1 B1 E2 A2 D3 G3 B3 E4"),
  preset("bass4", "E1 A1 D2 G2", "bass"),
  preset("bass5", "B0 E1 A1 D2 G2", "bass"),
  preset("bassDropD", "D1 A1 D2 G2", "bass"),
  preset("ukulele", "G4 C4 E4 A4", "ukulele"),
  preset("ukuleleLowG", "G3 C4 E4 A4", "ukulele"),
  preset("baritoneUkulele", "D3 G3 B3 E4", "ukulele"),
];

/** Reference frequency of each string, offsets included. */
export function stringFrequencies(tuning: Tuning, a4: number): number[] {
  return tuning.strings.map(
    (midi, i) => midiToFrequency(midi, a4) * 2 ** ((tuning.offsets?.[i] ?? 0) / 1200),
  );
}

export const DEFAULT_TUNING = PRESET_TUNINGS[0];

export function findTuning(id: string, custom: Tuning[]): Tuning {
  return (
    PRESET_TUNINGS.find((t) => t.id === id) ?? custom.find((t) => t.id === id) ?? DEFAULT_TUNING
  );
}

/**
 * Short labels for each string, e.g. ["E","A","D","G","B","e"]: the highest string is
 * lower-cased when it repeats the lowest string's letter, as guitarists write it.
 */
export function stringLabels(strings: number[]): string[] {
  const names = strings.map((m) => noteName(m) as string);
  const last = names.length - 1;
  if (last > 0 && names[last] === names[0]) names[last] = names[last].toLowerCase();
  return names;
}

export interface StringMatch {
  index: number;
  cents: number;
}

/** The string whose reference pitch (offsets included) is closest in cents to `frequency`. */
export function closestString(
  frequency: number,
  strings: number[],
  a4: number,
  offsets?: number[],
): StringMatch {
  let best: StringMatch = { index: 0, cents: Infinity };
  strings.forEach((midi, index) => {
    const target = midiToFrequency(midi, a4) * 2 ** ((offsets?.[index] ?? 0) / 1200);
    const cents = centsBetween(frequency, target);
    if (Math.abs(cents) < Math.abs(best.cents)) best = { index, cents };
  });
  return best;
}

/** String labels in a notation; the highest string is lower-cased when it repeats the lowest. */
export function stringLabelsIn(strings: number[], notation: Notation): string[] {
  const names = strings.map((m) => noteLabel(m, notation));
  const last = names.length - 1;
  if (last > 0 && names[last] === names[0]) {
    names[last] = names[last].charAt(0).toLowerCase() + names[last].slice(1);
  }
  return names;
}
