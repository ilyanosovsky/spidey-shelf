import { describe, expect, it } from "vitest";

import { isMirrorSymmetric, pixelGridRects } from "./pixel-grid";

describe("pixelGridRects", () => {
  it("merges each horizontal run of one tone into a single rect", () => {
    expect(pixelGridRects(["##o.#"])).toEqual([
      { x: 0, y: 0, width: 2, height: 1, tone: "accent" },
      { x: 2, y: 0, width: 1, height: 1, tone: "ink" },
      { x: 4, y: 0, width: 1, height: 1, tone: "accent" },
    ]);
  });

  it("puts each row on its own line and skips empty cells", () => {
    expect(pixelGridRects(["...", ".c.", "po."])).toEqual([
      { x: 1, y: 1, width: 1, height: 1, tone: "cream" },
      { x: 0, y: 2, width: 1, height: 1, tone: "pink" },
      { x: 1, y: 2, width: 1, height: 1, tone: "ink" },
    ]);
  });

  it("throws on a typo instead of leaving a hole in the sprite", () => {
    expect(() => pixelGridRects(["#x#"])).toThrow(/unknown sprite character "x"/);
  });
});

describe("isMirrorSymmetric", () => {
  it("accepts rows that read the same backwards and rejects the rest", () => {
    expect(isMirrorSymmetric(["#o.o#", ".###."])).toBe(true);
    expect(isMirrorSymmetric(["#o..#"])).toBe(false);
  });
});
