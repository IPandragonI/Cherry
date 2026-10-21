import data from "./chords.json";
import { qualityById } from "./chordFormulas";
import { fingerVoicing, type ChordEntry, type Voicing } from "./chordShapes";
import { NOTE_NAMES, displayNote, midiToFrequency } from "./notes";
import { notesFromFrets, recognizeChord, type Fret } from "./recognize";

export const CHORDS = data as ChordEntry[];

export function findChord(root: string, quality: string): ChordEntry | undefined {
  return CHORDS.find((c) => c.root === root && c.quality === quality);
}

export function chordById(id: string): ChordEntry | undefined {
  return CHORDS.find((c) => c.id === id);
}

export function chordName(chord: Pick<ChordEntry, "root" | "quality">): string {
  return `${displayNote(chord.root)}${qualityById(chord.quality).symbol}`;
}

/** Pretty-prints recognizer names ("F#m7" → "F♯m7", "D/F#" → "D/F♯"). */
export function prettyChordName(name: string): string {
  return name.replace(/([A-G])#/g, "$1♯").replace(/([A-G])b(?![a-z])/g, "$1♭");
}

/** Frequencies of the sounded strings, low to high, for strumming. */
export function voicingFrequencies(frets: Fret[], strings: number[], a4: number): number[] {
  return frets.flatMap((f, i) => (f === null ? [] : [midiToFrequency(strings[i] + f, a4)]));
}

/** Diagram data for any fingering, even one that needs more than four fingers. */
export function diagramFor(frets: Fret[]): Voicing {
  const voicing = fingerVoicing(frets);
  if (voicing) return voicing;
  const fretted = frets.filter((f): f is number => f !== null && f > 0);
  const max = Math.max(0, ...fretted);
  return {
    frets,
    fingers: frets.map(() => null),
    baseFret: max <= 5 ? 1 : Math.min(...fretted),
  };
}

/** "x32010"-style summary, used in accessible labels. */
export function fretsLabel(frets: Fret[]): string {
  return frets.map((f) => (f === null ? "x" : String(f))).join(" ");
}

const INTERVAL_NAMES = ["1", "♭2", "2", "♭3", "3", "4", "♭5", "5", "♯5", "6", "♭7", "7"];

/** Interval spellings for a chord formula, e.g. m7 → ["1", "♭3", "5", "♭7"]. */
export function formulaLabels(qualityId: string): string[] {
  const { intervals } = qualityById(qualityId);
  const extended = /9|11|13/.test(qualityId);
  return intervals.map((iv) => {
    if (iv === 2 && extended) return "9";
    if (iv === 5 && qualityId.includes("11")) return "11";
    if (iv === 9 && qualityId === "dim7") return "♭♭7";
    if (iv === 9 && qualityId.includes("13")) return "13";
    return INTERVAL_NAMES[iv];
  });
}

/** Note names of a chord from its formula, e.g. A m7 → ["A", "C", "E", "G"]. */
export function chordNotes(chord: Pick<ChordEntry, "root" | "quality">): string[] {
  const root = NOTE_NAMES.indexOf(chord.root as (typeof NOTE_NAMES)[number]);
  return qualityById(chord.quality).intervals.map((iv) =>
    displayNote(NOTE_NAMES[(root + iv) % 12]),
  );
}

/** Other names the same fingering answers to (e.g. Am7 → C6/A). */
export function alternativeNames(frets: Fret[], strings: number[], exclude: string): string[] {
  const names = recognizeChord(notesFromFrets(frets, strings)).map((m) => prettyChordName(m.name));
  return [...new Set(names)].filter((n) => n !== exclude).slice(0, 3);
}
