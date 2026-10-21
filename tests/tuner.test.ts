import { describe, expect, it } from "vitest";
import { displayDeviation, gaugePosition, tuneStatus } from "@/lib/audio/useTuner";

describe("tuneStatus", () => {
  it("classifies deviations", () => {
    expect(tuneStatus(null)).toBe("noSignal");
    expect(tuneStatus(7.5)).toBe("inTune");
    expect(tuneStatus(-11)).toBe("slightlyFlat");
    expect(tuneStatus(-30)).toBe("flat");
    expect(tuneStatus(11)).toBe("slightlySharp");
    expect(tuneStatus(30)).toBe("sharp");
  });

  it("uses hysteresis so the in-tune state does not flicker around ±8 cents", () => {
    expect(tuneStatus(9)).toBe("slightlySharp");
    expect(tuneStatus(9, true)).toBe("inTune");
    expect(tuneStatus(-9.9, true)).toBe("inTune");
    expect(tuneStatus(11, true)).toBe("slightlySharp");
  });

  it("is strict in precise mode (±3 cents, left beyond ±5)", () => {
    expect(tuneStatus(2.5, false, true)).toBe("inTune");
    expect(tuneStatus(4, false, true)).toBe("slightlySharp");
    expect(tuneStatus(-4.9, true, true)).toBe("inTune");
    expect(tuneStatus(6, true, true)).toBe("slightlySharp");
  });
});

describe("displayDeviation", () => {
  it("shows tenths of the cents by default: −10 cents reads −1", () => {
    expect(displayDeviation(-10, false)).toBe(-1);
    expect(displayDeviation(-20, false)).toBe(-2);
    expect(displayDeviation(14, false)).toBe(1);
    expect(displayDeviation(-4, false)).toBe(0);
    expect(displayDeviation(5, false)).toBe(1);
    expect(displayDeviation(-5, false)).toBe(-1);
    expect(displayDeviation(50, false)).toBe(5);
  });

  it("shows cents in precise mode", () => {
    expect(displayDeviation(-10, true)).toBe(-10);
    expect(displayDeviation(-0.4, true)).toBe(0);
  });
});

describe("gaugePosition", () => {
  it("compresses the centre by default, like popular tuner apps", () => {
    expect(gaugePosition(-10, false)).toBeCloseTo(-2);
    expect(gaugePosition(20, false)).toBeCloseTo(8);
    expect(gaugePosition(-50, false)).toBeCloseTo(-50);
    expect(gaugePosition(80, false)).toBeCloseTo(50);
  });

  it("is the real deviation in precise mode", () => {
    expect(gaugePosition(-10, true)).toBe(-10);
  });
});
