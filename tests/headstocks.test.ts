import { describe, expect, it } from "vitest";
import { CX, HEADSTOCKS, NUT_Y } from "@/components/tuner/headstocks";

const THREE_PLUS_THREE = ["jazz", "openbook", "square"] as const;
// String indexes: 0 = low E … 5 = high e.
const [E, A, D, G, B, e] = [0, 1, 2, 3, 4, 5];

describe.each(THREE_PLUS_THREE)("%s headstock (3+3)", (id) => {
  const model = HEADSTOCKS[id];
  const post = (i: number) => model.post(i, 6);

  it("routes D, A, low E down the left side", () => {
    for (const i of [E, A, D]) expect(post(i).x).toBeLessThan(CX);
    expect(post(D).y).toBeLessThan(post(A).y);
    expect(post(A).y).toBeLessThan(post(E).y);
  });

  it("routes G, B, high e down the right side", () => {
    for (const i of [G, B, e]) expect(post(i).x).toBeGreaterThan(CX);
    expect(post(G).y).toBeLessThan(post(B).y);
    expect(post(B).y).toBeLessThan(post(e).y);
  });

  it("has every string on its own post, above the nut", () => {
    const ys = new Set([E, A, D, G, B, e].map((i) => `${post(i).x},${post(i).y}`));
    expect(ys.size).toBe(6);
    for (let i = 0; i < 6; i++) expect(post(i).y).toBeLessThan(NUT_Y);
  });

  it("has horizontal tuner keys", () => {
    for (let i = 0; i < 6; i++) expect(model.key(i, 6).y).toBeCloseTo(post(i).y, 6);
  });
});

describe("6-in-line headstock", () => {
  it("puts the low E nearest the nut, high e at the tip, all on the bass side", () => {
    const model = HEADSTOCKS.inline;
    const ys = [0, 1, 2, 3, 4, 5].map((i) => model.post(i, 6).y);
    expect([...ys].sort((a, b) => b - a)).toEqual(ys);
    for (let i = 0; i < 6; i++) expect(model.key(i, 6).x).toBeLessThan(model.post(i, 6).x);
  });
});
