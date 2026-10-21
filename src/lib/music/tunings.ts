import { centsBetween, midiToFrequency, noteName, parseNote } from "./notes";

export interface Tuning {
  id: string;
  /** i18n key for presets; free text for custom tunings. */
  name: string;
  /** MIDI numbers, lowest (thickest) string first. Any length (6, 7, 8…). */
  strings: number[];
  custom?: boolean;
}

const preset = (id: string, notes: string): Tuning => ({
  id,
  name: `tuning.${id}`,
  strings: notes.split(" ").map(parseNote),
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
];

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

/** The string whose reference pitch is closest (in cents) to `frequency`. */
export function closestString(frequency: number, strings: number[], a4: number): StringMatch {
  let best: StringMatch = { index: 0, cents: Infinity };
  strings.forEach((midi, index) => {
    const cents = centsBetween(frequency, midiToFrequency(midi, a4));
    if (Math.abs(cents) < Math.abs(best.cents)) best = { index, cents };
  });
  return best;
}
