import { CHORD_QUALITIES, type ChordQuality } from "./chordFormulas";
import { NOTE_NAMES, pitchClass } from "./notes";

export interface ChordMatch {
  /** Full display name, e.g. "Am7", "C/E". */
  name: string;
  root: number;
  bass: number;
  quality: ChordQuality;
  /** Lower is better. */
  score: number;
}

export type Fret = number | null;

/** MIDI notes sounded by a fingering (`null` = muted string, 0 = open). */
export function notesFromFrets(frets: Fret[], strings: number[]): number[] {
  return frets.flatMap((fret, i) => (fret === null ? [] : [strings[i] + fret]));
}

function chordName(root: number, quality: ChordQuality, bass: number): string {
  const base = `${NOTE_NAMES[root]}${quality.symbol}`;
  return bass === root ? base : `${base}/${NOTE_NAMES[bass]}`;
}

/**
 * Identifies chords from sounded MIDI notes. Every pitch class present is tried as a root
 * and matched against the interval formulas; a formula matches when the voicing contains
 * all of its required tones and nothing else. Results are ranked, best first.
 */
export function recognizeChord(midiNotes: number[]): ChordMatch[] {
  if (midiNotes.length === 0) return [];
  const bass = pitchClass(Math.min(...midiNotes));
  const classes = [...new Set(midiNotes.map(pitchClass))];
  if (classes.length < 2) return [];

  const matches: ChordMatch[] = [];
  for (const root of classes) {
    const present = new Set(classes.map((pc) => (pc - root + 12) % 12));
    for (const quality of CHORD_QUALITIES) {
      const formula = new Set(quality.intervals);
      if ([...present].some((iv) => !formula.has(iv))) continue;
      const missing = quality.intervals.filter((iv) => !present.has(iv));
      if (missing.some((iv) => !quality.optional?.includes(iv))) continue;

      let score = missing.length * 2 + quality.intervals.length * 0.1;
      if (root !== bass) score += 1.5;
      // Two-note shapes are only meaningful as power chords.
      if (present.size === 2 && quality.id !== "power") continue;
      matches.push({ name: chordName(root, quality, bass), root, bass, quality, score });
    }
  }
  return matches.sort((a, b) => a.score - b.score);
}
