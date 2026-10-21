import { describe, expect, it } from "vitest";
import library from "@/lib/music/chords.json";
import { qualityById } from "@/lib/music/chordFormulas";
import { fingerVoicing, generateChordLibrary, type ChordEntry } from "@/lib/music/chordShapes";
import { notesFromFrets, recognizeChord, type Fret } from "@/lib/music/recognize";
import { findTuning } from "@/lib/music/tunings";

const STANDARD = findTuning("standard", []).strings;

/** Parses "x32010" or "8.10.10.9.8.8" into frets. */
function shape(s: string): Fret[] {
  const parts = s.includes(".") ? s.split(".") : s.split("");
  return parts.map((p) => (p === "x" ? null : Number(p)));
}

const names = (s: string, strings = STANDARD) =>
  recognizeChord(notesFromFrets(shape(s), strings)).map((m) => m.name);

describe("recognizeChord", () => {
  it.each([
    ["x32010", "C"],
    ["320003", "G"],
    ["xx0232", "D"],
    ["x02210", "Am"],
    ["022000", "Em"],
    ["133211", "F"],
    ["x02020", "A7"],
    ["x32000", "Cmaj7"],
    ["xx0211", "Dm7"],
    ["xx0233", "Dsus4"],
    ["xx0230", "Dsus2"],
    ["x2313x", "Bdim7"],
    ["x3434x", "Cm7♭5"],
    ["x32030", "Cadd9"],
    ["x3233x", "C9"],
    ["022xxx", "E5"],
  ])("%s → %s", (frets, expected) => {
    expect(names(frets)[0]).toBe(expected);
  });

  it("offers alternative names (Am7 / C6)", () => {
    const result = names("x02013");
    expect(result[0]).toBe("Am7");
    expect(result).toContain("C6/A");
  });

  it("names inversions as slash chords", () => {
    expect(names("032010")[0]).toBe("C/E");
    expect(names("2x0232")[0]).toBe("D/F#");
  });

  it("respects the current tuning", () => {
    const dropD = findTuning("dropD", []).strings;
    expect(names("000232", dropD)[0]).toBe("D");
    const openG = findTuning("openG", []).strings;
    expect(names("000000", openG)[0]).toBe("G/D");
    expect(names("x00000", openG)[0]).toBe("G");
  });

  it("returns nothing for fewer than two pitch classes", () => {
    expect(names("xxxxxx")).toEqual([]);
    expect(names("x0xxxx")).toEqual([]);
    expect(names("x0x2xx")).toEqual([]);
  });
});

describe("chord library dataset", () => {
  const chords = library as ChordEntry[];

  it("is up to date with the shape generator", () => {
    expect(chords).toEqual(JSON.parse(JSON.stringify(generateChordLibrary())));
  });

  it("covers 12 roots × every library quality with several voicings", () => {
    expect(chords).toHaveLength(12 * 17);
    for (const c of chords) expect(c.voicings.length, c.id).toBeGreaterThanOrEqual(1);
    const multi = chords.filter((c) => c.voicings.length >= 2).length;
    expect(multi / chords.length).toBeGreaterThan(0.9);
  });

  it("every voicing is recognized as its own chord", () => {
    for (const chord of chords) {
      const expected = `${chord.root}${qualityById(chord.quality).symbol}`;
      for (const v of chord.voicings) {
        const found = recognizeChord(notesFromFrets(v.frets, STANDARD)).map((m) => m.name);
        expect(found, `${chord.id} ${v.frets.join(",")}`).toContain(expected);
      }
    }
  });

  it("every voicing is playable with four fingers", () => {
    for (const chord of chords) {
      for (const v of chord.voicings) {
        const used = new Set(v.fingers.filter((f) => f !== null));
        expect(used.size).toBeLessThanOrEqual(4);
        const fretted = v.frets.filter((f): f is number => f !== null && f > 0);
        if (fretted.length) expect(Math.max(...fretted) - Math.min(...fretted)).toBeLessThan(4);
      }
    }
  });

  it("fingers open and barre chords", () => {
    expect(fingerVoicing(shape("x32010"))?.fingers).toEqual([null, 3, 2, null, 1, null]);
    const f = fingerVoicing(shape("133211"))!;
    expect(f.barre).toEqual({ fret: 1, from: 0, to: 5 });
    expect(f.fingers).toEqual([1, 3, 4, 2, 1, 1]);
  });
});
