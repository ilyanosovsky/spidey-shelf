import { type CatalogSearchResult, type PublicCatalogFigure } from "@/lib/search";
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

/**
 * A catalog row as the public search and the wishlist see it — no `needs_review`, no
 * `source`, nothing a visitor may not see. Real figures again: #334 is the GameStop
 * Gamerverse Spider-Man nobody owns, which is the design brief's own NOT OWNED example.
 */
export function catalogFigure(overrides: Partial<PublicCatalogFigure> = {}): PublicCatalogFigure {
  return {
    slug: "pop-spider-man-gamerverse-spider-man-white-spider-334",
    name: "Spider-Man (White Spider)",
    popNumber: 334,
    category: "peter",
    productLine: "Pop! Spider-Man (Gamerverse)",
    exclusivity: "GameStop",
    variantFlags: [],
    ...overrides,
  };
}

/** The same row plus the ownership signals the verdict is made of. */
export function catalogResult(overrides: Partial<CatalogSearchResult> = {}): CatalogSearchResult {
  return {
    ...catalogFigure(),
    ownedCount: 0,
    hadOnce: false,
    hasPublicPage: false,
    ...overrides,
  };
}

/**
 * A wishlist slice with the two orderings that matter: shared box numbers, and the
 * numberless multi-packs that have to sink to the bottom.
 */
export const WISHLIST_FIXTURE: PublicCatalogFigure[] = [
  catalogFigure({
    slug: "pop-spider-man-no-way-home-3-pack",
    name: "Spider-Man: No Way Home (3 Pack)",
    popNumber: null,
  }),
  catalogFigure({
    slug: "pop-spider-man-gamerverse-spider-man-white-spider-334",
    popNumber: 334,
  }),
  catalogFigure({
    slug: "pop-spider-man-into-the-spider-verse-miles-morales-402",
    name: "Miles Morales",
    popNumber: 402,
    category: "spider_verse",
    productLine: "Pop! Spider-Man: Into the Spider-Verse",
    exclusivity: null,
  }),
  catalogFigure({
    slug: "pop-marvel-venom-363",
    name: "Venom",
    popNumber: 363,
    category: "friends_foes",
    productLine: "Pop! Marvel",
    exclusivity: null,
  }),
  catalogFigure({
    slug: "pop-spider-man-into-the-spider-verse-miles-morales-translucent-402",
    name: "Miles Morales Translucent",
    popNumber: 402,
    category: "spider_verse",
    productLine: "Pop! Spider-Man: Into the Spider-Verse",
    exclusivity: null,
  }),
  catalogFigure({
    slug: "pop-disney-lilo-stitch-leroy-1572",
    name: "Leroy",
    popNumber: 1572,
    category: "other",
    productLine: "Pop! Disney: Lilo & Stitch",
    exclusivity: null,
  }),
];
