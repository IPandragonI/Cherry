import { describe, expect, it } from "vitest";
import { ReadingHold } from "@/lib/audio/readingHold";

const cents = (c: number) => 110 * 2 ** (c / 1200);

describe("ReadingHold (what the gauge shows)", () => {
  it("keeps the last reading for a few seconds after the note stops", () => {
    const hold = new ReadingHold(4000, 1);
    expect(hold.update(110, 0)).toBe(110);
    expect(hold.update(null, 1000)).toBe(110);
    expect(hold.update(null, 3900)).toBe(110);
    expect(hold.update(null, 4100)).toBeNull();
  });

  it("ignores sub-cent movements so a steady note keeps the gauge still", () => {
    const hold = new ReadingHold(4000, 1);
    hold.update(cents(0), 0);
    expect(hold.update(cents(0.6), 20)).toBe(cents(0));
    expect(hold.update(cents(-0.8), 40)).toBe(cents(0));
    expect(hold.update(cents(1.5), 60)).toBe(cents(1.5));
  });

  it("follows a new note at once", () => {
    const hold = new ReadingHold(4000, 1);
    hold.update(110, 0);
    expect(hold.update(146.83, 500)).toBe(146.83);
  });
});
