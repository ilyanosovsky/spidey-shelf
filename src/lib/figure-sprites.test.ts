import { describe, expect, it } from "vitest";

import { FIGURE_CATEGORIES } from "./categories";
import { lineSpriteRects, figureSpriteKind, STITCH_ROWS_16, GROGU_ROWS_16 } from "./figure-sprites";
import { isMirrorSymmetric } from "./pixel-grid";
import { SPECK_CELLS, SPIDER_GRID } from "./spider-sprite";

describe("figureSpriteKind", () => {
  it("gives Veronika's two lines their own sprite and everything else the spider", () => {
    expect(figureSpriteKind("stitch")).toBe("stitch");
    expect(figureSpriteKind("grogu")).toBe("grogu");
    for (const category of FIGURE_CATEGORIES.filter((c) => c !== "stitch" && c !== "grogu")) {
      expect(figureSpriteKind(category)).toBe("spider");
    }
    expect(figureSpriteKind(null)).toBe("spider");
    expect(figureSpriteKind("nonsense")).toBe("spider");
  });
});

describe.each([
  ["Stitch", STITCH_ROWS_16, "stitch"],
  ["Grogu", GROGU_ROWS_16, "grogu"],
] as const)("the 16×16 %s", (_, rows, kind) => {
  it("is a full 16×16 grid", () => {
    expect(rows).toHaveLength(SPIDER_GRID);
    for (const row of rows) expect(row).toHaveLength(SPIDER_GRID);
  });

  it("is left-right symmetric", () => {
    expect(isMirrorSymmetric(rows)).toBe(true);
  });

  it("leaves every speck cell free, so a speck never lands on the sprite", () => {
    for (const [row, column] of SPECK_CELLS) {
      expect(rows[row][column], `speck at row ${row}, column ${column}`).toBe(".");
    }
  });

  it("parses into rects that stay inside the grid, accent first-class", () => {
    const rects = lineSpriteRects(kind);
    expect(rects.some((rect) => rect.tone === "accent")).toBe(true);
    expect(rects.some((rect) => rect.tone !== "accent")).toBe(true);
    for (const rect of rects) {
      expect(rect.x + rect.width).toBeLessThanOrEqual(SPIDER_GRID);
      expect(rect.y + rect.height).toBeLessThanOrEqual(SPIDER_GRID);
    }
  });
});

describe("the two line sprites", () => {
  it("are different drawings", () => {
    expect(STITCH_ROWS_16).not.toEqual(GROGU_ROWS_16);
  });
});
