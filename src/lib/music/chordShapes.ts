import { LIBRARY_QUALITIES } from "./chordFormulas";
import { NOTE_NAMES } from "./notes";
import type { Fret } from "./recognize";

export interface Barre {
  fret: number;
  /** String indexes (0 = low E), inclusive. */
  from: number;
  to: number;
}

export interface Voicing {
  /** Absolute fret per string, low E first. `null` = muted, 0 = open. */
  frets: Fret[];
  /** Finger per string (1–4), `null` for open/muted strings. */
  fingers: (number | null)[];
  barre?: Barre;
  /** First fret shown in the diagram. */
  baseFret: number;
}

export interface ChordEntry {
  id: string;
  root: string;
  quality: string;
  voicings: Voicing[];
}

/** Standard-tuning open string pitch classes, low E first. */
const OPEN_PCS = [4, 9, 2, 7, 11, 4];

type Offsets = (number | null)[];

/**
 * Movable shapes as fret offsets from the root's fret on `rootString`.
 * Named after the open chord they come from (CAGED).
 */
const SHAPES: Record<string, { rootString: number; offsets: Offsets }[]> = {
  major: [
    { rootString: 0, offsets: [0, 2, 2, 1, 0, 0] },
    { rootString: 1, offsets: [null, 0, 2, 2, 2, 0] },
    { rootString: 2, offsets: [null, null, 0, 2, 3, 2] },
    { rootString: 1, offsets: [null, 0, -1, -3, -2, -3] },
    { rootString: 0, offsets: [0, -1, -3, -3, -3, 0] },
  ],
  minor: [
    { rootString: 0, offsets: [0, 2, 2, 0, 0, 0] },
    { rootString: 1, offsets: [null, 0, 2, 2, 1, 0] },
    { rootString: 2, offsets: [null, null, 0, 2, 3, 1] },
  ],
  "7": [
    { rootString: 0, offsets: [0, 2, 0, 1, 0, 0] },
    { rootString: 1, offsets: [null, 0, 2, 0, 2, 0] },
    { rootString: 2, offsets: [null, null, 0, 2, 1, 2] },
    { rootString: 1, offsets: [null, 0, -1, 0, -2, -3] },
    { rootString: 0, offsets: [0, -1, -3, -3, -3, -2] },
  ],
  maj7: [
    { rootString: 0, offsets: [0, null, 1, 1, 0, null] },
    { rootString: 1, offsets: [null, 0, 2, 1, 2, 0] },
    { rootString: 2, offsets: [null, null, 0, 2, 2, 2] },
    { rootString: 1, offsets: [null, 0, -1, -3, -3, -3] },
  ],
  m7: [
    { rootString: 0, offsets: [0, 2, 0, 0, 0, 0] },
    { rootString: 1, offsets: [null, 0, 2, 0, 1, 0] },
    { rootString: 2, offsets: [null, null, 0, 2, 1, 1] },
  ],
  sus2: [
    { rootString: 1, offsets: [null, 0, 2, 2, 0, 0] },
    { rootString: 2, offsets: [null, null, 0, 2, 3, 0] },
  ],
  sus4: [
    { rootString: 0, offsets: [0, 2, 2, 2, 0, 0] },
    { rootString: 1, offsets: [null, 0, 2, 2, 3, 0] },
    { rootString: 2, offsets: [null, null, 0, 2, 3, 3] },
  ],
  dim: [
    { rootString: 0, offsets: [0, 1, 2, 0, null, null] },
    { rootString: 1, offsets: [null, 0, 1, 2, 1, null] },
    { rootString: 2, offsets: [null, null, 0, 1, 3, 1] },
  ],
  aug: [
    { rootString: 0, offsets: [0, null, 2, 1, 1, null] },
    { rootString: 1, offsets: [null, 0, 3, 2, 2, null] },
    { rootString: 1, offsets: [null, 0, null, 2, 2, 1] },
    { rootString: 2, offsets: [null, null, 0, 3, 3, 2] },
  ],
  "6": [
    { rootString: 0, offsets: [0, 2, 2, 1, 2, 0] },
    { rootString: 0, offsets: [0, null, -1, 1, 0, null] },
    { rootString: 1, offsets: [null, 0, 2, 2, 2, 2] },
    { rootString: 1, offsets: [null, 0, 2, -1, 2, null] },
    { rootString: 2, offsets: [null, null, 0, 2, 0, 2] },
  ],
  m6: [
    { rootString: 0, offsets: [0, 2, 2, 0, 2, 0] },
    { rootString: 1, offsets: [null, 0, 2, 2, 1, 2] },
    { rootString: 2, offsets: [null, null, 0, 2, 0, 1] },
  ],
  "9": [
    { rootString: 0, offsets: [0, 2, 0, 1, 0, 2] },
    { rootString: 1, offsets: [null, 0, -1, 0, 0, null] },
    { rootString: 2, offsets: [null, null, 0, -1, 1, 0] },
  ],
  add9: [
    { rootString: 0, offsets: [0, 2, 2, 1, 0, 2] },
    { rootString: 1, offsets: [null, 0, 2, 4, 2, 0] },
    { rootString: 1, offsets: [null, 0, -1, -3, 0, -3] },
  ],
  power: [
    { rootString: 0, offsets: [0, 2, 2, null, null, null] },
    { rootString: 1, offsets: [null, 0, 2, 2, null, null] },
    { rootString: 2, offsets: [null, null, 0, 2, 3, null] },
  ],
  dim7: [
    { rootString: 0, offsets: [0, null, -1, 0, -1, null] },
    { rootString: 1, offsets: [null, 0, 1, -1, 1, null] },
    { rootString: 2, offsets: [null, null, 0, 1, 0, 1] },
  ],
  m7b5: [
    { rootString: 0, offsets: [0, null, 0, 0, -1, null] },
    { rootString: 1, offsets: [null, 0, 1, 0, 1, null] },
    { rootString: 2, offsets: [null, null, 0, 1, 1, 1] },
  ],
  "7sus4": [
    { rootString: 0, offsets: [0, 2, 0, 2, 0, 0] },
    { rootString: 1, offsets: [null, 0, 2, 0, 3, 0] },
    { rootString: 2, offsets: [null, null, 0, 2, 1, 3] },
  ],
};

const MAX_FRET = 15;

/** Assigns fingers (and a first-finger barre when needed). Returns null if unplayable. */
export function fingerVoicing(frets: Fret[]): Voicing | null {
  const fretted = frets.flatMap((f, i) => (f !== null && f > 0 ? [{ fret: f, string: i }] : []));
  const sounded = frets.filter((f) => f !== null).length;
  if (sounded < 2) return null;
  if (fretted.length === 0) return { frets, fingers: frets.map(() => null), baseFret: 1 };

  const min = Math.min(...fretted.map((n) => n.fret));
  const max = Math.max(...fretted.map((n) => n.fret));
  if (max > MAX_FRET || max - min > 3) return null;

  const fingers: (number | null)[] = frets.map(() => null);
  const atMin = fretted.filter((n) => n.fret === min);
  let barre: Barre | undefined;
  let rest = fretted;
  let nextFinger = 1;

  if (atMin.length >= 2) {
    const from = atMin[0].string;
    const to = atMin[atMin.length - 1].string;
    const spanOk = frets.slice(from, to + 1).every((f) => f !== null && f >= min);
    if (spanOk) {
      barre = { fret: min, from, to };
      atMin.forEach((n) => (fingers[n.string] = 1));
      rest = fretted.filter((n) => n.fret !== min);
      nextFinger = 2;
    }
  }

  const ordered = [...rest].sort((a, b) => a.fret - b.fret || a.string - b.string);
  if (ordered.length > 5 - nextFinger) return null;
  for (const n of ordered) fingers[n.string] = nextFinger++;

  return { frets, fingers, barre, baseFret: max <= 4 ? 1 : min };
}

function voicingsFor(rootPc: number, quality: string): Voicing[] {
  const seen = new Set<string>();
  const result: Voicing[] = [];
  for (const shape of SHAPES[quality] ?? []) {
    const first = (rootPc - OPEN_PCS[shape.rootString] + 12) % 12;
    for (const rootFret of [first, first + 12]) {
      const frets = shape.offsets.map((o) => (o === null ? null : rootFret + o));
      if (frets.some((f) => f !== null && f < 0)) continue;
      const voicing = fingerVoicing(frets);
      const key = frets.join(",");
      if (!voicing || seen.has(key)) continue;
      seen.add(key);
      result.push(voicing);
    }
  }
  const lowest = (v: Voicing) => Math.max(0, ...v.frets.map((f) => f ?? 0));
  return result.sort((a, b) => lowest(a) - lowest(b));
}

export function generateChordLibrary(): ChordEntry[] {
  return NOTE_NAMES.flatMap((root, rootPc) =>
    LIBRARY_QUALITIES.map((q) => ({
      id: `${root}-${q.id}`,
      root,
      quality: q.id,
      voicings: voicingsFor(rootPc, q.id),
    })),
  );
}
