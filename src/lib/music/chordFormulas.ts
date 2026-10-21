export interface ChordQuality {
  id: string;
  /** Suffix appended to the root, e.g. "m7" → "Am7". */
  symbol: string;
  /** Semitone intervals from the root, root (0) included. */
  intervals: number[];
  /** Intervals that may be omitted in a voicing (typically the fifth). */
  optional?: number[];
  /** Shown in the library quality filter. */
  library?: boolean;
}

export const CHORD_QUALITIES: ChordQuality[] = [
  { id: "major", symbol: "", intervals: [0, 4, 7], library: true },
  { id: "minor", symbol: "m", intervals: [0, 3, 7], library: true },
  { id: "7", symbol: "7", intervals: [0, 4, 7, 10], optional: [7], library: true },
  { id: "maj7", symbol: "maj7", intervals: [0, 4, 7, 11], optional: [7], library: true },
  { id: "m7", symbol: "m7", intervals: [0, 3, 7, 10], optional: [7], library: true },
  { id: "sus2", symbol: "sus2", intervals: [0, 2, 7], library: true },
  { id: "sus4", symbol: "sus4", intervals: [0, 5, 7], library: true },
  { id: "dim", symbol: "dim", intervals: [0, 3, 6], library: true },
  { id: "aug", symbol: "aug", intervals: [0, 4, 8], library: true },
  { id: "6", symbol: "6", intervals: [0, 4, 7, 9], optional: [7], library: true },
  { id: "m6", symbol: "m6", intervals: [0, 3, 7, 9], optional: [7], library: true },
  { id: "9", symbol: "9", intervals: [0, 2, 4, 7, 10], optional: [7], library: true },
  { id: "add9", symbol: "add9", intervals: [0, 2, 4, 7], optional: [7], library: true },
  { id: "power", symbol: "5", intervals: [0, 7], library: true },
  { id: "dim7", symbol: "dim7", intervals: [0, 3, 6, 9], library: true },
  { id: "m7b5", symbol: "m7♭5", intervals: [0, 3, 6, 10], library: true },
  { id: "7sus4", symbol: "7sus4", intervals: [0, 5, 7, 10], optional: [7], library: true },
  { id: "mMaj7", symbol: "m(maj7)", intervals: [0, 3, 7, 11], optional: [7] },
  { id: "madd9", symbol: "m(add9)", intervals: [0, 2, 3, 7], optional: [7] },
  { id: "m9", symbol: "m9", intervals: [0, 2, 3, 7, 10], optional: [7] },
  { id: "maj9", symbol: "maj9", intervals: [0, 2, 4, 7, 11], optional: [7] },
  { id: "6add9", symbol: "6/9", intervals: [0, 2, 4, 7, 9], optional: [7] },
  { id: "7#9", symbol: "7♯9", intervals: [0, 3, 4, 7, 10], optional: [7] },
  { id: "add11", symbol: "add11", intervals: [0, 4, 5, 7], optional: [7] },
  { id: "11", symbol: "11", intervals: [0, 2, 5, 7, 10], optional: [7, 2] },
  { id: "13", symbol: "13", intervals: [0, 4, 9, 10], optional: [] },
];

export const LIBRARY_QUALITIES = CHORD_QUALITIES.filter((q) => q.library);

export function qualityById(id: string): ChordQuality {
  const quality = CHORD_QUALITIES.find((q) => q.id === id);
  if (!quality) throw new Error(`Unknown chord quality: ${id}`);
  return quality;
}
