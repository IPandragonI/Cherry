import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, sanitizeSettings } from "@/store/settings";

describe("saved settings", () => {
  it("keeps valid values", () => {
    const saved = { ...DEFAULT_SETTINGS, a4: 432.5, mode: "chromatic", inputGain: 2 };
    expect(sanitizeSettings(saved)).toEqual(saved);
  });

  it("falls back on defaults for missing, mistyped or unknown values", () => {
    const s = sanitizeSettings({
      a4: "440",
      mode: "strobe",
      theme: null,
      headstock: "telecaster",
      precise: "yes",
      bpm: Number.NaN,
    });
    expect(s.a4).toBe(DEFAULT_SETTINGS.a4);
    expect(s.mode).toBe(DEFAULT_SETTINGS.mode);
    expect(s.theme).toBe(DEFAULT_SETTINGS.theme);
    expect(s.headstock).toBe(DEFAULT_SETTINGS.headstock);
    expect(s.precise).toBe(DEFAULT_SETTINGS.precise);
    expect(s.bpm).toBe(DEFAULT_SETTINGS.bpm);
    expect(sanitizeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
  });

  it("clamps out-of-range numbers and rounds the reference pitch to a tenth", () => {
    const s = sanitizeSettings({ a4: 500, bpm: 1000, inputGain: 0, selectedString: 2.6 });
    expect(s.a4).toBe(466);
    expect(s.bpm).toBe(250);
    expect(s.inputGain).toBe(0.25);
    expect(s.selectedString).toBe(3);
    expect(sanitizeSettings({ a4: 440.04 }).a4).toBe(440);
  });
});
