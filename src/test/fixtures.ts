import { type PublicShelfEntry } from "@/lib/showcase";

/**
 * Shelf rows for the tests, shaped exactly like the ones the query returns.
 *
 * Real figures from `data/collection/owned.csv` — a fixture that lies about the data is a
 * fixture that lets a bug through. Ordered newest acquisition first, the order the public
 * query guarantees.
 */
export function shelfEntry(overrides: Partial<PublicShelfEntry> = {}): PublicShelfEntry {
  return {
    slug: "pop-marvel-spider-man-3",
    name: "Spider-Man",
    popNumber: 3,
    category: "peter",
    productLine: "Pop! Marvel",
    exclusivity: null,
    variantFlags: [],
    status: "mine",
    isPublic: true,
    acquiredAt: "2023-12-28",
    acquiredCity: "Haifa",
    acquiredCountry: "IL",
    story: null,
    ...overrides,
  };
}

export const SHELF_FIXTURE: PublicShelfEntry[] = [
  shelfEntry({
    slug: "pop-marvel-peter-b-parker-mayday-1239",
    name: "Peter B. Parker & Mayday",
    popNumber: 1239,
    acquiredAt: "2026-01-05",
    acquiredCity: "Moscow",
    acquiredCountry: "RU",
  }),
  shelfEntry({
    slug: "pop-lilo-stitch-stitch-as-pineapple-1570",
    name: "Stitch As Pineapple",
    popNumber: 1570,
    category: "other",
    productLine: "Pop! Lilo & Stitch",
    status: "not_mine_anymore",
    acquiredAt: "2025-12-31",
    acquiredCity: "Batumi",
    acquiredCountry: "GE",
  }),
  shelfEntry({
    slug: "pop-marvel-spider-man-last-stand-1450",
    name: "Spider-Man (Last Stand)",
    popNumber: 1450,
    acquiredAt: "2025-04-12",
    acquiredCity: "LA",
    acquiredCountry: "US",
    story: "Picked it up on Melrose after a very long flight.",
  }),
  shelfEntry({
    slug: "pop-spider-verse-miles-g-morales-1412",
    name: "Miles G. Morales",
    popNumber: 1412,
    category: "spider_verse",
    productLine: "Pop! Spider-Man: Across the Spider-Verse",
    acquiredAt: "2025-03-06",
    acquiredCity: "Moscow",
    acquiredCountry: "RU",
  }),
  shelfEntry({
    slug: "pop-marvel-spider-man-hidden-1111",
    name: "Spider-Man (Staged)",
    popNumber: 1111,
    isPublic: false,
    acquiredAt: "2025-02-14",
    acquiredCity: "Munich",
    acquiredCountry: "DE",
  }),
  shelfEntry(),
];
