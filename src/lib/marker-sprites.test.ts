import { describe, expect, it } from "vitest";

import { FIGURE_SPRITE_KINDS } from "./figure-sprites";
import { STITCH_ROWS_5, GROGU_ROWS_5, MARKER_GRID, markerSpriteRects } from "./marker-sprites";
import { isMirrorSymmetric } from "./pixel-grid";

/** The set of filled cells, so silhouettes can be compared regardless of how rects merge. */
function silhouette(kind: (typeof FIGURE_SPRITE_KINDS)[number]): Set<string> {
  const cells = new Set<string>();
  for (const rect of markerSpriteRects(kind)) {
    for (let x = rect.x; x < rect.x + rect.width; x += 1) {
      for (let y = rect.y; y < rect.y + rect.height; y += 1) cells.add(`${x},${y}`);
    }
  }
  return cells;
}

describe("markerSpriteRects", () => {
  it.each(FIGURE_SPRITE_KINDS)("keeps the %s inside the 5×5 grid", (kind) => {
    for (const rect of markerSpriteRects(kind)) {
      expect(rect.x).toBeGreaterThanOrEqual(0);
      expect(rect.y).toBeGreaterThanOrEqual(0);
      expect(rect.x + rect.width).toBeLessThanOrEqual(MARKER_GRID);
      expect(rect.y + rect.height).toBeLessThanOrEqual(MARKER_GRID);
    }
  });

  it.each(FIGURE_SPRITE_KINDS)("draws the %s left-right symmetric", (kind) => {
    const cells = silhouette(kind);
    for (const cell of cells) {
      const [x, y] = cell.split(",").map(Number);
      expect(cells.has(`${MARKER_GRID - 1 - x},${y}`), `mirror of ${cell}`).toBe(true);
    }
  });

  it("keeps the spider exactly as it was drawn before Phase 14", () => {
    expect(markerSpriteRects("spider")).toEqual([
      { x: 0, y: 0, width: 1, height: 1, tone: "accent" },
      { x: 4, y: 0, width: 1, height: 1, tone: "accent" },
      { x: 0, y: 2, width: 1, height: 1, tone: "accent" },
      { x: 4, y: 2, width: 1, height: 1, tone: "accent" },
      { x: 0, y: 4, width: 1, height: 1, tone: "accent" },
      { x: 4, y: 4, width: 1, height: 1, tone: "accent" },
      { x: 1, y: 1, width: 3, height: 3, tone: "accent" },
      { x: 1, y: 1, width: 1, height: 1, tone: "cream" },
      { x: 3, y: 1, width: 1, height: 1, tone: "cream" },
    ]);
  });

  it("gives the three kinds three different silhouettes", () => {
    const shapes = FIGURE_SPRITE_KINDS.map((kind) => [...silhouette(kind)].sort().join(" "));
    expect(new Set(shapes).size).toBe(3);
  });

  it("returns a fresh array, so nothing can mutate the shared spider", () => {
    const first = markerSpriteRects("spider");
    first[0].x = 99;
    expect(markerSpriteRects("spider")[0].x).toBe(0);
  });
});

describe.each([
  ["Stitch", STITCH_ROWS_5],
  ["Grogu", GROGU_ROWS_5],
])("the 5×5 %s rows", (_, rows) => {
  it("are a 5×5 grid, symmetric", () => {
    expect(rows).toHaveLength(MARKER_GRID);
    for (const row of rows) expect(row).toHaveLength(MARKER_GRID);
    expect(isMirrorSymmetric(rows)).toBe(true);
  });
});
