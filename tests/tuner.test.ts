import { describe, expect, it } from "vitest";
import { tuneStatus } from "@/lib/audio/useTuner";

describe("tuneStatus", () => {
  it("classifies deviations", () => {
    expect(tuneStatus(null)).toBe("noSignal");
    expect(tuneStatus(2.5)).toBe("inTune");
    expect(tuneStatus(-9)).toBe("slightlyFlat");
    expect(tuneStatus(-30)).toBe("flat");
    expect(tuneStatus(9)).toBe("slightlySharp");
    expect(tuneStatus(30)).toBe("sharp");
  });

  it("uses hysteresis so the in-tune state does not flicker around ±3 cents", () => {
    expect(tuneStatus(4)).toBe("slightlySharp");
    expect(tuneStatus(4, true)).toBe("inTune");
    expect(tuneStatus(-4.9, true)).toBe("inTune");
    expect(tuneStatus(6, true)).toBe("slightlySharp");
  });
});
