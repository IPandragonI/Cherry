import { describe, expect, it } from "vitest";
import { tapTempo, tempoMarking } from "@/lib/audio/metronome";

describe("tap tempo", () => {
  it("needs two taps", () => {
    expect(tapTempo([])).toBeNull();
    expect(tapTempo([1000])).toBeNull();
  });

  it("reads the tempo from the median interval", () => {
    expect(tapTempo([0, 500, 1000, 1500])).toBe(120);
    // One sloppy tap does not throw it off.
    expect(tapTempo([0, 500, 1000, 1700, 2200, 2700])).toBe(120);
  });

  it("starts over after a pause", () => {
    expect(tapTempo([0, 300, 600, 5000, 6000])).toBe(60);
  });

  it("stays within the metronome range", () => {
    expect(tapTempo([0, 100])).toBe(250);
    expect(tapTempo([0, 1990])).toBe(30);
  });
});

describe("tempo marking", () => {
  it("names common tempos", () => {
    expect(tempoMarking(50)).toBe("Largo");
    expect(tempoMarking(90)).toBe("Andante");
    expect(tempoMarking(140)).toBe("Allegro");
  });
});
