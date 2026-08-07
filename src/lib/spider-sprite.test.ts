import { describe, expect, it } from "vitest";

import { mirrorColumn, SPIDER_GRID, spiderSpriteRects } from "./spider-sprite";

describe("spiderSpriteRects", () => {
  it("stays inside the 16×16 grid", () => {
    for (const rect of spiderSpriteRects()) {
      expect(rect.x).toBeGreaterThanOrEqual(0);
      expect(rect.y).toBeGreaterThanOrEqual(0);
      expect(rect.x + rect.width).toBeLessThanOrEqual(SPIDER_GRID);
      expect(rect.y + rect.height).toBeLessThanOrEqual(SPIDER_GRID);
    }
  });

  it("is symmetric — that is what makes it read as a spider", () => {
    const cells = new Set<string>();
    for (const rect of spiderSpriteRects()) {
      for (let x = rect.x; x < rect.x + rect.width; x += 1) {
        for (let y = rect.y; y < rect.y + rect.height; y += 1) cells.add(`${x},${y}`);
      }
    }

    for (const cell of cells) {
      const [x, y] = cell.split(",").map(Number);
      expect(cells.has(`${mirrorColumn(x)},${y}`), `mirror of ${cell}`).toBe(true);
    }
  });

  it("has a body, eight leg segments a side, and two eyes", () => {
    const rects = spiderSpriteRects();
    expect(rects.filter((rect) => rect.part === "body").length).toBeGreaterThan(0);
    expect(rects.filter((rect) => rect.part === "eye")).toHaveLength(2);
    // Four legs of four cells, mirrored.
    expect(rects.filter((rect) => rect.part === "leg")).toHaveLength(32);
  });

  it("draws the eyes last, so they land on top of the body", () => {
    const parts = spiderSpriteRects().map((rect) => rect.part);
    expect(parts.lastIndexOf("eye")).toBe(parts.length - 1);
    expect(parts.indexOf("eye")).toBeGreaterThan(parts.lastIndexOf("body"));
  });

  it("returns a fresh array, so nothing can mutate the shared sprite", () => {
    const first = spiderSpriteRects();
    first.length = 0;
    expect(spiderSpriteRects().length).toBeGreaterThan(20);
  });
});

describe("mirrorColumn", () => {
  it("reflects across the grid", () => {
    expect(mirrorColumn(0)).toBe(15);
    expect(mirrorColumn(15)).toBe(0);
    expect(mirrorColumn(mirrorColumn(6))).toBe(6);
  });
});
