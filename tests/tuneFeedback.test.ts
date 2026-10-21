import { describe, expect, it } from "vitest";
import { initialFeedback, shouldChime } from "@/lib/audio/tuneFeedback";

/** Feeds a sequence of frames (one every 21 ms) and returns when it chimed. */
function run(frames: { note?: string | null; inTune?: boolean; silent?: boolean }[]) {
  const state = initialFeedback();
  return frames.flatMap((f, i) =>
    shouldChime(state, {
      now: i * 21,
      note: f.note === undefined ? "E2" : f.note,
      inTune: f.inTune ?? true,
      silent: f.silent ?? false,
    })
      ? [i]
      : [],
  );
}

const repeat = <T>(n: number, frame: T) => Array.from({ length: n }, () => frame);

describe("in-tune chime", () => {
  it("plays once while a note stays in tune", () => {
    expect(run(repeat(300, {}))).toEqual([0]);
  });

  it("does not replay when the reading flickers around the threshold", () => {
    const flicker = Array.from({ length: 300 }, (_, i) => ({ inTune: i % 7 !== 0 }));
    expect(run(flicker)).toHaveLength(1);
  });

  it("does not replay after a short dropout of the signal", () => {
    expect(
      run([...repeat(50, {}), ...repeat(10, { silent: true }), ...repeat(150, {})]),
    ).toHaveLength(1);
  });

  it("plays again for a new pluck after a real silence, once the cooldown has passed", () => {
    const chimes = run([...repeat(60, {}), ...repeat(50, { silent: true }), ...repeat(60, {})]);
    expect(chimes).toEqual([0, 110]);
  });

  it("plays for the next string, but not within the cooldown", () => {
    const quick = run([...repeat(20, {}), ...repeat(60, { note: "A2" })]);
    expect(quick).toEqual([0]);
    const later = run([...repeat(100, {}), ...repeat(60, { note: "A2" })]);
    expect(later).toEqual([0, 100]);
  });
});
