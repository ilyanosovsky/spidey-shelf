import { describe, expect, it } from "vitest";

import { shelfEntry } from "@/test/fixtures";

import { type StoredSnapshot } from "./ebay/snapshot";
import {
  collectionFinances,
  countsTowardValue,
  financeCoverageLine,
  isCoveragePartial,
} from "./finances";
import { type PublicShelfEntry } from "./showcase";

/**
 * What the shelf is worth — and, mostly, what does NOT count toward it.
 *
 * Every case below is a way the total could quietly become a different number than the one
 * the page claims: a figure that was given away, a duplicate counted once instead of twice,
 * a euro added to a dollar, a figure with no price counted as free.
 */

const NOW = Date.UTC(2026, 7, 7, 12, 0, 0);

function snapshot(medianCents: number, currency = "USD"): StoredSnapshot {
  return {
    listingCount: 25,
    minCents: Math.round(medianCents * 0.7),
    medianCents,
    currency,
    fetchedAt: new Date(NOW - 60 * 60 * 1000),
  };
}

function priced(entries: readonly [PublicShelfEntry, number | null][]): {
  entries: PublicShelfEntry[];
  prices: Map<string, StoredSnapshot>;
} {
  const prices = new Map<string, StoredSnapshot>();
  for (const [entry, cents] of entries) {
    if (cents !== null) prices.set(entry.slug, snapshot(cents));
  }
  return { entries: entries.map(([entry]) => entry), prices };
}

const MINE = shelfEntry({ slug: "a-mine", name: "Spider-Man", status: "mine" });
const ALSO_MINE = shelfEntry({ slug: "b-mine", name: "Miles Morales", status: "mine" });
const GONE = shelfEntry({ slug: "c-gone", name: "Hula Stitch", status: "not_mine_anymore" });

describe("countsTowardValue", () => {
  it("counts a public `mine` row and nothing else", () => {
    expect(countsTowardValue(MINE)).toBe(true);
    expect(countsTowardValue(GONE)).toBe(false);
    // A row with no status is a half-finished quick-add, not a valuation. This is
    // deliberately stricter than the view's `owned_count`, which does count it.
    expect(countsTowardValue(shelfEntry({ status: null }))).toBe(false);
    expect(countsTowardValue(shelfEntry({ status: "mine", isPublic: false }))).toBe(false);
  });
});

describe("collectionFinances", () => {
  it("adds up the medians of the figures that are actually on the shelf", () => {
    const { entries, prices } = priced([
      [MINE, 2400],
      [ALSO_MINE, 1600],
    ]);

    const finances = collectionFinances(entries, prices);

    expect(finances).not.toBeNull();
    expect(finances?.totalCents).toBe(4000);
    expect(finances?.totalLabel).toBe("~$40");
    expect(finances?.pricedCount).toBe(2);
    expect(finances?.ownedCount).toBe(2);
    expect(finances?.currency).toBe("USD");
  });

  it("leaves out a figure that left the shelf, price and all", () => {
    const { entries, prices } = priced([
      [MINE, 2400],
      [GONE, 9900],
    ]);

    const finances = collectionFinances(entries, prices);

    expect(finances?.totalCents).toBe(2400);
    expect(finances?.ownedCount).toBe(1);
    // The most expensive snapshot in the map belongs to a figure he no longer owns, so it
    // must not be the collection's most prized.
    expect(finances?.top.slug).toBe("a-mine");
  });

  it("multiplies by quantity — two boxes are two boxes' worth", () => {
    const { entries, prices } = priced([
      [shelfEntry({ slug: "a-mine", quantity: 3 }), 1000],
      [shelfEntry({ slug: "b-mine", name: "Venom", quantity: null }), 2000],
    ]);

    // 3 × $10 + 1 × $20 (NULL quantity is one figure, not none).
    expect(collectionFinances(entries, prices)?.totalCents).toBe(5000);
  });

  it("treats a nonsense quantity as nothing rather than as a negative collection", () => {
    const { entries, prices } = priced([
      [shelfEntry({ slug: "a-mine", quantity: -2 }), 1000],
      [shelfEntry({ slug: "b-mine", name: "Venom", quantity: 1 }), 2000],
    ]);

    expect(collectionFinances(entries, prices)?.totalCents).toBe(2000);
  });

  it("names both ends of the collection, cheapest and dearest", () => {
    const { entries, prices } = priced([
      [shelfEntry({ slug: "a", name: "Middle" }), 2000],
      [shelfEntry({ slug: "b", name: "Dear" }), 9900],
      [shelfEntry({ slug: "c", name: "Cheap" }), 500],
    ]);

    const finances = collectionFinances(entries, prices);

    expect(finances?.top).toMatchObject({ slug: "b", name: "Dear", medianCents: 9900 });
    expect(finances?.top.price).toBe("~$99");
    expect(finances?.bottom).toMatchObject({ slug: "c", name: "Cheap", medianCents: 500 });
    expect(finances?.bottom.price).toBe("~$5");
  });

  it("breaks a tie on the name, so the two cards never swap between requests", () => {
    const { entries, prices } = priced([
      [shelfEntry({ slug: "a", name: "Zeta" }), 2000],
      [shelfEntry({ slug: "b", name: "Alpha" }), 2000],
    ]);

    const finances = collectionFinances(entries, prices);
    expect(finances?.bottom.name).toBe("Alpha");
    expect(finances?.top.name).toBe("Zeta");
  });

  it("carries the picture, so the cards can draw the figure they name", () => {
    const { entries, prices } = priced([
      [
        shelfEntry({
          slug: "a",
          name: "Spider-Man",
          category: "spider_verse",
          popNumber: 1450,
          imagePath: "https://si4zn51deh.ufs.sh/f/abc",
        }),
        2000,
      ],
    ]);

    expect(collectionFinances(entries, prices)?.top).toMatchObject({
      category: "spider_verse",
      popNumber: 1450,
      imagePath: "https://si4zn51deh.ufs.sh/f/abc",
    });
  });

  it("excludes an unpriced figure from the total but counts it in the coverage", () => {
    const { entries, prices } = priced([
      [MINE, 2400],
      [ALSO_MINE, null],
      [shelfEntry({ slug: "d", name: "Gwen" }), null],
    ]);

    const finances = collectionFinances(entries, prices);

    expect(finances?.totalCents).toBe(2400);
    expect(finances?.pricedCount).toBe(1);
    expect(finances?.ownedCount).toBe(3);
    expect(isCoveragePartial(finances!)).toBe(true);
    expect(financeCoverageLine(finances!)).toBe("PRICED: 1 / 3");
  });

  it("never averages currencies — the majority wins and the rest are dropped", () => {
    const entries = [
      shelfEntry({ slug: "a", name: "One" }),
      shelfEntry({ slug: "b", name: "Two" }),
      shelfEntry({ slug: "c", name: "Three" }),
    ];
    const prices = new Map<string, StoredSnapshot>([
      ["a", snapshot(2000, "USD")],
      ["b", snapshot(3000, "USD")],
      ["c", snapshot(900000, "JPY")],
    ]);

    const finances = collectionFinances(entries, prices);

    expect(finances?.currency).toBe("USD");
    expect(finances?.totalCents).toBe(5000);
    // The yen figure is not priced *in this currency*, so it is coverage, not value.
    expect(finances?.pricedCount).toBe(2);
    expect(finances?.ownedCount).toBe(3);
    expect(finances?.top.slug).toBe("b");
  });

  it("is one figure at both ends when only one has a price", () => {
    const { entries, prices } = priced([
      [MINE, 2400],
      [ALSO_MINE, null],
    ]);

    const finances = collectionFinances(entries, prices);
    expect(finances?.top.slug).toBe(finances?.bottom.slug);
  });

  it("is null when nothing is owned", () => {
    const { entries, prices } = priced([[GONE, 2400]]);
    expect(collectionFinances(entries, prices)).toBeNull();
    expect(collectionFinances([], new Map())).toBeNull();
  });

  it("is null when nothing is priced — a shelf worth `$0` is a lie, not an estimate", () => {
    const { entries, prices } = priced([
      [MINE, null],
      [ALSO_MINE, null],
    ]);

    expect(collectionFinances(entries, prices)).toBeNull();
  });

  it("ignores a snapshot for a figure that is not on the shelf at all", () => {
    const { entries, prices } = priced([[MINE, 2400]]);
    prices.set("some-wishlist-figure", snapshot(50000));

    expect(collectionFinances(entries, prices)?.totalCents).toBe(2400);
  });

  it("says coverage is complete when it is", () => {
    const { entries, prices } = priced([
      [MINE, 2400],
      [ALSO_MINE, 1600],
    ]);

    const finances = collectionFinances(entries, prices);
    expect(isCoveragePartial(finances!)).toBe(false);
    expect(financeCoverageLine(finances!)).toBe("PRICED: 2 / 2");
  });
});
