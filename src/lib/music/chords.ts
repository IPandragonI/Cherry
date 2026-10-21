import data from "./chords.json";
import { qualityById } from "./chordFormulas";
import { fingerVoicing, type ChordEntry, type Voicing } from "./chordShapes";
import { displayNote, midiToFrequency } from "./notes";
import type { Fret } from "./recognize";

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
