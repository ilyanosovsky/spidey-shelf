import { describe, expect, it } from "vitest";

import { shelfEntry, SHELF_FIXTURE } from "@/test/fixtures";

import {
  acquisitionCountries,
  acquisitionTimeline,
  categoryProgressLabel,
  normalizeCategoryProgress,
  vaultCounters,
} from "./stats";

/** The live numbers on 2026-08-06 — the shape the stats screen is built against. */
const LIVE_PROGRESS = [
  { category: "peter", owned: 11, total: 120 },
  { category: "spider_verse", owned: 1, total: 60 },
  { category: "friends_foes", owned: 2, total: 62 },
  { category: "other", owned: 1, total: 5 },
];

describe("normalizeCategoryProgress", () => {
  it("returns the buckets in taxonomy order", () => {
    expect(
      normalizeCategoryProgress([...LIVE_PROGRESS].reverse()).map((row) => row.category),
    ).toEqual(["peter", "spider_verse", "friends_foes", "other"]);
  });

  it("keeps a bucket the query did not return, as 0 / 0", () => {
    expect(normalizeCategoryProgress([{ category: "peter", owned: 11, total: 120 }])).toEqual([
      { category: "peter", owned: 11, total: 120 },
      { category: "spider_verse", owned: 0, total: 0 },
      { category: "friends_foes", owned: 0, total: 0 },
      { category: "other", owned: 0, total: 0 },
    ]);
  });

  it("ignores a bucket the taxonomy does not know", () => {
    const rows = normalizeCategoryProgress([
      ...LIVE_PROGRESS,
      { category: "clones", owned: 9, total: 9 },
    ]);
    expect(rows).toHaveLength(4);
    expect(rows.some((row) => (row.category as string) === "clones")).toBe(false);
  });

  it("labels a bucket with the one wording the site uses", () => {
    expect(categoryProgressLabel({ category: "peter", owned: 0, total: 0 })).toBe("PETER PARKER");
    expect(categoryProgressLabel({ category: "friends_foes", owned: 0, total: 0 })).toBe(
      "FRIENDS & FOES",
    );
  });
});

describe("vaultCounters", () => {
  it("counts the canon, the spiders and the whole vault", () => {
    expect(vaultCounters(normalizeCategoryProgress(LIVE_PROGRESS))).toEqual([
      { label: "PETER CANON", value: "11 / 120" },
      { label: "ALL SPIDERS", value: "12 / 180" },
      { label: "WHOLE VAULT", value: "15 / 247" },
    ]);
  });

  it("survives an empty catalog without dividing anything", () => {
    expect(vaultCounters(normalizeCategoryProgress([]))).toEqual([
      { label: "PETER CANON", value: "0 / 0" },
      { label: "ALL SPIDERS", value: "0 / 0" },
      { label: "WHOLE VAULT", value: "0 / 0" },
    ]);
  });
});

describe("acquisitionTimeline", () => {
  it("groups the shelf by year, busiest year at full width", () => {
    expect(acquisitionTimeline(SHELF_FIXTURE)).toEqual([
      { year: 2023, count: 1, share: 0.333 },
      { year: 2024, count: 0, share: 0 },
      { year: 2025, count: 3, share: 1 },
      { year: 2026, count: 1, share: 0.333 },
    ]);
  });

  it("keeps the empty years so the timeline stays a timeline", () => {
    const rows = acquisitionTimeline([
      shelfEntry({ slug: "a", acquiredAt: "2023-01-01" }),
      shelfEntry({ slug: "b", acquiredAt: "2026-01-01" }),
    ]);
    expect(rows.map((row) => row.year)).toEqual([2023, 2024, 2025, 2026]);
    expect(rows.map((row) => row.count)).toEqual([1, 0, 0, 1]);
  });

  it("leaves out rows with no date rather than guessing one", () => {
    const rows = acquisitionTimeline([
      shelfEntry({ slug: "a", acquiredAt: "2025-04-12" }),
      shelfEntry({ slug: "b", acquiredAt: null }),
      shelfEntry({ slug: "c", acquiredAt: "not a date" }),
    ]);
    expect(rows).toEqual([{ year: 2025, count: 1, share: 1 }]);
  });

  it("skips the staged rows the grid also hides", () => {
    const rows = acquisitionTimeline([
      shelfEntry({ slug: "hidden", acquiredAt: "2019-01-01", isPublic: false }),
      shelfEntry({ slug: "shown", acquiredAt: "2025-01-01" }),
    ]);
    expect(rows).toEqual([{ year: 2025, count: 1, share: 1 }]);
  });

  it("is empty for an empty shelf", () => {
    expect(acquisitionTimeline([])).toEqual([]);
  });
});

describe("acquisitionCountries", () => {
  it("counts the flags, busiest first", () => {
    expect(acquisitionCountries(SHELF_FIXTURE)).toEqual([
      { code: "RU", flag: "\u{1F1F7}\u{1F1FA}", count: 2 },
      { code: "GE", flag: "\u{1F1EC}\u{1F1EA}", count: 1 },
      { code: "IL", flag: "\u{1F1EE}\u{1F1F1}", count: 1 },
      { code: "US", flag: "\u{1F1FA}\u{1F1F8}", count: 1 },
    ]);
  });

  it("breaks a tie by code, so the row order never wobbles", () => {
    const rows = acquisitionCountries([
      shelfEntry({ slug: "a", acquiredCountry: "NL" }),
      shelfEntry({ slug: "b", acquiredCountry: "DE" }),
    ]);
    expect(rows.map((row) => row.code)).toEqual(["DE", "NL"]);
  });

  it("ignores rows with no usable country", () => {
    expect(
      acquisitionCountries([
        shelfEntry({ slug: "a", acquiredCountry: null }),
        shelfEntry({ slug: "b", acquiredCountry: "" }),
        shelfEntry({ slug: "c", acquiredCountry: "GEO" }),
      ]),
    ).toEqual([]);
  });

  it("normalizes a lowercase code instead of splitting the count", () => {
    const rows = acquisitionCountries([
      shelfEntry({ slug: "a", acquiredCountry: "il" }),
      shelfEntry({ slug: "b", acquiredCountry: "IL" }),
    ]);
    expect(rows).toEqual([{ code: "IL", flag: "\u{1F1EE}\u{1F1F1}", count: 2 }]);
  });
});
