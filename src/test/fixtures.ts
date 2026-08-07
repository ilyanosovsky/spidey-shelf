import type { OwnedFigureRow } from "@/lib/collection-queries";
import { type AdminCatalogFigure } from "@/lib/quick-add";
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
    imagePath: null,
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
    imagePath: null,
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

/**
 * A catalog row as the ADMIN sees it — the public columns plus `needs_review` and
 * `owned_count`. Real figure again: #3 is the one number in this catalog with four
 * Spider-Men behind it, which is exactly what the confirm step exists for.
 */
export function adminFigure(overrides: Partial<AdminCatalogFigure> = {}): AdminCatalogFigure {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    slug: "pop-marvel-spider-man-3",
    name: "Spider-Man",
    popNumber: 3,
    category: "peter",
    productLine: "Pop! Marvel",
    exclusivity: null,
    variantFlags: [],
    releaseYear: 2011,
    imagePath: null,
    needsReview: false,
    ownedCount: 0,
    ...overrides,
  };
}

/** #3 and its three variants, plus one unrelated figure that must never join the group. */
export const VARIANT_FIXTURE: AdminCatalogFigure[] = [
  adminFigure(),
  adminFigure({
    id: "22222222-2222-4222-8222-222222222222",
    slug: "pop-marvel-spider-man-metallic-3",
    name: "Spider-Man (Metallic)",
    variantFlags: ["metallic"],
  }),
  adminFigure({
    id: "33333333-3333-4333-8333-333333333333",
    slug: "pop-marvel-spider-man-glow-3",
    name: "Spider-Man (Glow)",
    variantFlags: ["glow"],
    exclusivity: "SDCC",
    needsReview: true,
  }),
  adminFigure({
    id: "44444444-4444-4444-8444-444444444444",
    slug: "pop-marvel-spider-man-translucent-4",
    name: "Spider-Man (Translucent)",
    popNumber: 4,
  }),
  adminFigure({
    id: "55555555-5555-4555-8555-555555555555",
    slug: "pop-marvel-spider-man-1090",
    name: "Spider-Man",
    popNumber: 1090,
    releaseYear: 2022,
  }),
  adminFigure({
    id: "66666666-6666-4666-8666-666666666666",
    slug: "pop-marvel-venom-363",
    name: "Venom",
    popNumber: 363,
    category: "friends_foes",
  }),
];

/**
 * A shelf row as the ADMIN list sees it — the `owned_figures` columns LEFT-joined onto the
 * catalog, which is why every catalog field is nullable here and only here.
 *
 * The type is imported for its shape only (`import type`, so nothing from
 * `collection-queries.ts` — and therefore nothing `server-only` — is pulled into a jsdom
 * test run).
 */
export function ownedRow(overrides: Partial<OwnedFigureRow> = {}): OwnedFigureRow {
  return {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    referenceFigureId: "11111111-1111-4111-8111-111111111111",
    status: "mine",
    isPublic: true,
    acquiredAt: "2023-12-28",
    acquiredCity: "Haifa",
    acquiredCountry: "IL",
    story: "Found it in a tiny shop off Ben Gurion.",
    needsStory: false,
    quantity: 1,
    createdAt: new Date("2026-08-06T10:00:00.000Z"),
    popNumber: 3,
    name: "Spider-Man",
    category: "peter",
    productLine: "Pop! Marvel",
    exclusivity: null,
    slug: "pop-marvel-spider-man-3",
    imagePath: null,
    ...overrides,
  };
}
