import { describe, expect, it } from "vitest";
import { calibrate, calibrationFromReadings } from "@/lib/music/calibration";
import { centsBetween } from "@/lib/music/notes";

const at = (hz: number, n = 40) => Array.from({ length: n }, (_, i) => hz * 2 ** ((i % 3) / 12000));

describe("calibration from a reference A", () => {
  it("measures the device offset and returns the correction", () => {
    // A440 read 2.5 cents low on this device → add 2.5 cents to every reading.
    const correction = calibrationFromReadings(at(440 * 2 ** (-2.5 / 1200)))!;
    expect(correction).toBeCloseTo(2.5, 0);
    expect(centsBetween(calibrate(440 * 2 ** (-2.5 / 1200), correction), 440)).toBeCloseTo(0, 0);
  });

  it("accepts the reference A in any octave", () => {
    expect(calibrationFromReadings(at(110 * 2 ** (3 / 1200)))).toBeCloseTo(-3, 0);
    expect(calibrationFromReadings(at(880))).toBeCloseTo(0, 0);
  });

  it("refuses too few, unsteady or non-A readings", () => {
    expect(calibrationFromReadings(at(440, 5))).toBeNull();
    expect(calibrationFromReadings(at(466.16))).toBeNull(); // a B♭, not an A
    const wobbly = Array.from({ length: 40 }, (_, i) => 440 * 2 ** (((i % 2) * 12 - 6) / 1200));
    expect(calibrationFromReadings(wobbly)).toBeNull();
  });
});
