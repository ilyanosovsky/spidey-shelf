import { describe, expect, it } from "vitest";

import {
  DEFAULT_FIGURE_CATEGORY,
  FIGURE_CATEGORIES,
  FIGURE_CATEGORY_LABELS,
  figureCategoryLabel,
  isFigureCategory,
  isVeronikaCategory,
  VERONIKA_CATEGORIES,
} from "./categories";

describe("FIGURE_CATEGORIES", () => {
  it("is the six buckets in display order, with the catch-all last", () => {
    expect(FIGURE_CATEGORIES).toEqual([
      "peter",
      "spider_verse",
      "friends_foes",
      "stitch",
      "grogu",
      "other",
    ]);
    expect(DEFAULT_FIGURE_CATEGORY).toBe("other");
  });

  it("gives every bucket its short pixel label", () => {
    expect(FIGURE_CATEGORIES.map((category) => FIGURE_CATEGORY_LABELS[category])).toEqual([
      "PETER PARKER",
      "SPIDER-VERSE",
      "FRIENDS & FOES",
      "STITCH",
      "GROGU",
      "OTHER",
    ]);
  });

  it("recognizes the new buckets as categories", () => {
    expect(isFigureCategory("stitch")).toBe(true);
    expect(isFigureCategory("grogu")).toBe(true);
    expect(isFigureCategory("STITCH")).toBe(false);
    expect(isFigureCategory(null)).toBe(false);
  });

  it("labels an unknown or NULL category as OTHER", () => {
    expect(figureCategoryLabel("grogu")).toBe("GROGU");
    expect(figureCategoryLabel(null)).toBe("OTHER");
    expect(figureCategoryLabel("clones")).toBe("OTHER");
  });
});

describe("Veronika's lines", () => {
  it("are Stitch and Grogu, both real buckets", () => {
    expect(VERONIKA_CATEGORIES).toEqual(["stitch", "grogu"]);
    for (const category of VERONIKA_CATEGORIES) {
      expect(FIGURE_CATEGORIES).toContain(category);
    }
  });

  it("isVeronikaCategory is true for her two lines only", () => {
    expect(isVeronikaCategory("stitch")).toBe(true);
    expect(isVeronikaCategory("grogu")).toBe(true);
    for (const value of ["peter", "spider_verse", "friends_foes", "other", "Stitch", null, 3]) {
      expect(isVeronikaCategory(value), String(value)).toBe(false);
    }
  });
});
