import { describe, expect, it } from "vitest";
import {
  centsBetween,
  clampCents,
  displayNote,
  formatNote,
  midiToFrequency,
  nearestNote,
  parseNote,
  solfegeName,
} from "@/lib/music/notes";
import {
  PRESET_TUNINGS,
  closestString,
  findTuning,
  stringFrequencies,
  stringLabels,
} from "@/lib/music/tunings";

describe("note math", () => {
  it("parses scientific pitch notation", () => {
    expect(parseNote("A4")).toBe(69);
    expect(parseNote("E2")).toBe(40);
    expect(parseNote("C#4")).toBe(61);
    expect(parseNote("Bb3")).toBe(58);
    expect(() => parseNote("H2")).toThrow();
  });

  it("converts MIDI to frequency for any reference pitch", () => {
    expect(midiToFrequency(69)).toBe(440);
    expect(midiToFrequency(40)).toBeCloseTo(82.407, 3);
    expect(midiToFrequency(69, 432)).toBe(432);
    expect(midiToFrequency(57, 415)).toBeCloseTo(207.5, 5);
  });

  it("computes cents and the nearest note", () => {
    expect(centsBetween(880, 440)).toBeCloseTo(1200);
    expect(centsBetween(440 * 2 ** (6 / 1200), 440)).toBeCloseTo(6);
    const n = nearestNote(111);
    expect(formatNote(n.midi)).toBe("A2");
    expect(n.cents).toBeCloseTo(15.67, 1);
    expect(nearestNote(108.5).name).toBe("A");
    expect(nearestNote(108.5).cents).toBeLessThan(0);
  });

  it("clamps the display deviation to ±50", () => {
    expect(clampCents(80)).toBe(50);
    expect(clampCents(-120)).toBe(-50);
    expect(clampCents(12.5)).toBe(12.5);
  });

  it("names notes", () => {
    expect(solfegeName(45)).toBe("La");
    expect(displayNote("F#")).toBe("F♯");
    expect(displayNote("Bb")).toBe("B♭");
  });
});

describe("tunings", () => {
  const standard = findTuning("standard", []);

  it("defines every preset low to high, with the expected number of strings", () => {
    const count = (id: string) => findTuning(id, []).strings.length;
    for (const t of PRESET_TUNINGS) {
      // A ukulele's high G (re-entrant tuning) is the one exception to low → high.
      if (t.id === "ukulele") continue;
      expect([...t.strings].sort((a, b) => a - b)).toEqual(t.strings);
    }
    expect(
      PRESET_TUNINGS.filter((t) => t.instrument === "guitar" && t.strings.length === 6),
    ).toHaveLength(11);
    expect([count("sevenString"), count("eightString"), count("bass4"), count("bass5")]).toEqual([
      7, 8, 4, 5,
    ]);
    expect(findTuning("ukulele", []).strings.map(formatNote)).toEqual(["G4", "C4", "E4", "A4"]);
    expect(standard.strings.map(formatNote)).toEqual(["E2", "A2", "D3", "G3", "B3", "E4"]);
  });

  it("applies per-string offsets to the targets", () => {
    const sweetened = { ...standard, offsets: [0, 0, 0, 0, -3, 0] };
    const b = stringFrequencies(sweetened, 440)[4];
    expect(centsBetween(b, midiToFrequency(59, 440))).toBeCloseTo(-3, 6);
    // A B string 3 cents flat reads 0 against the sweetened target.
    const match = closestString(b, sweetened.strings, 440, sweetened.offsets);
    expect(match.index).toBe(4);
    expect(match.cents).toBeCloseTo(0, 6);
  });

  it("labels strings like guitarists do", () => {
    expect(stringLabels(standard.strings)).toEqual(["E", "A", "D", "G", "B", "e"]);
    expect(stringLabels(findTuning("dadgad", []).strings)).toEqual(["D", "A", "D", "G", "A", "d"]);
  });

  it("falls back to standard for unknown ids and finds custom tunings", () => {
    expect(findTuning("nope", []).id).toBe("standard");
    const custom = { id: "c1", name: "Mine", strings: [38, 45, 50, 55, 59, 64], custom: true };
    expect(findTuning("c1", [custom])).toBe(custom);
  });

  it("picks the closest string in auto mode", () => {
    expect(closestString(110.8, standard.strings, 440)).toMatchObject({ index: 1 });
    expect(closestString(80, standard.strings, 440).index).toBe(0);
    expect(closestString(330, standard.strings, 440).index).toBe(5);
    const { cents } = closestString(196 * 2 ** (-10 / 1200), standard.strings, 440);
    expect(cents).toBeCloseTo(-10, 1);
  });
});
