import {
  FIGURE_CATEGORIES,
  FIGURE_CATEGORY_LABELS,
  isFigureCategory,
  type FigureCategory,
} from "./categories";
import { type OwnedStatus } from "./collection";
import { formatPlace, formatPopNumber, formatSightingDate } from "./format";

/**
 * The public showcase, minus the database.
 *
 * Everything the home grid and the figure page decide — which rows a visitor may see, which
 * tab they belong to, what the ticker says, who the neighbours of a figure are — lives here
 * as pure functions over plain rows, so it is unit-tested against fixtures instead of
 * against Railway. `src/lib/showcase-queries.ts` is the thin layer that fetches the rows.
 */

/**
 * One figure on the public shelf: the owner's row joined with its catalog figure.
 *
 * Deliberately narrow. `needs_review`, `source`, `source_url` and every admin-only column of
 * `reference_figures` are absent by construction, so a public component cannot leak them
 * even by accident (CLAUDE.md, "Security rules").
 */
export interface PublicShelfEntry {
  /** Reference slug — the figure's public URL, `/figure/<slug>`. */
  slug: string;
  name: string;
  popNumber: number | null;
  category: FigureCategory;
  productLine: string | null;
  exclusivity: string | null;
  variantFlags: string[] | null;
  /**
   * `reference_figures.image_path` — an owner-uploaded 800×800 WebP, or NULL (ADR-011).
   * A public column: the picture is the one catalog field a visitor is here to look at.
   */
  imagePath: string | null;
  /** `mine` / `not_mine_anymore`; NULL rows predate the status column. */
  status: OwnedStatus | null;
  /**
   * How many copies of this figure are on the shelf (Phase 11 — the FINANCES total
   * multiplies by it). Never rendered as a number: two boxes are one figure everywhere a
   * count is shown, which is what keeps the grid and the counters honest. NULL means one.
   */
  quantity: number | null;
  /** The owner's staging switch. Only `true` rows are ever rendered. */
  isPublic: boolean;
  /** ISO `YYYY-MM-DD`. */
  acquiredAt: string | null;
  acquiredCity: string | null;
  /** ISO 3166-1 alpha-2. */
  acquiredCountry: string | null;
  story: string | null;
}

/** The numbers on the home LCD: `11 / 120`. Filled in by `getShelfProgress()`. */
export interface ShelfProgress {
  /** Distinct `peter` catalog figures with at least one public shelf row. */
  owned: number;
  /** Every `peter` figure in the catalog — the honest denominator (ADR-009). */
  total: number;
}

/** The home tabs: the four catalog buckets plus the default "everything". */
export type ShelfFilter = FigureCategory | "all";

export const DEFAULT_SHELF_FILTER: ShelfFilter = "all";

/** The `?cat=` value of each tab, in display order. Labels come from the taxonomy. */
export const SHELF_TABS: readonly { value: ShelfFilter; label: string }[] = [
  { value: "all", label: "ALL" },
  ...FIGURE_CATEGORIES.map((category) => ({
    value: category as ShelfFilter,
    label: FIGURE_CATEGORY_LABELS[category],
  })),
];

/** `?cat=peter` → `peter`. Anything unknown (or absent, or repeated) falls back to ALL. */
export function parseShelfFilter(raw: string | string[] | undefined): ShelfFilter {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== "string") return DEFAULT_SHELF_FILTER;

  const trimmed = value.trim().toLowerCase();
  if (trimmed === "all") return "all";
  return isFigureCategory(trimmed) ? trimmed : DEFAULT_SHELF_FILTER;
}

/** The URL of a tab. ALL is the bare path — the default never shows up in the address bar. */
export function shelfHref(filter: ShelfFilter): string {
  return filter === "all" ? "/" : `/?cat=${filter}`;
}

/** A figure that left the shelf keeps its row, its story and a dimmed card. */
export function hasLeftTheShelf(entry: PublicShelfEntry): boolean {
  return entry.status === "not_mine_anymore";
}

/**
 * The rows a visitor may see, in the given tab.
 *
 * The public query already filters `is_public` in SQL — a private row never leaves the
 * database. This repeats the check because it is the one place the rule is spelled out and
 * tested: a future query change cannot quietly put a staged figure on the grid.
 */
export function filterShelf(
  entries: readonly PublicShelfEntry[],
  filter: ShelfFilter = DEFAULT_SHELF_FILTER,
): PublicShelfEntry[] {
  return entries.filter(
    (entry) => entry.isPublic === true && (filter === "all" || entry.category === filter),
  );
}

/** How many cards the NEW SIGHTINGS ribbon carries. */
export const NEW_SIGHTINGS_LIMIT = 5;

/**
 * The newest arrivals.
 *
 * Ordered by `acquired_at`, NOT by `created_at`: the whole collection was backfilled from
 * the owner's Notion table in a single seed run, so every row shares one `created_at`
 * instant and "recently added to the site" would be meaningless. The date the figure was
 * picked up is the real story anyway. Callers pass an already-ordered list (the query sorts
 * in SQL); this only takes the head of it.
 */
export function newSightings(
  entries: readonly PublicShelfEntry[],
  limit: number = NEW_SIGHTINGS_LIMIT,
): PublicShelfEntry[] {
  return filterShelf(entries).slice(0, Math.max(limit, 0));
}

/** `true` when this entry is one of the newest arrivals — the card gets a star. */
export function isNewSighting(
  entry: PublicShelfEntry,
  entries: readonly PublicShelfEntry[],
  limit: number = NEW_SIGHTINGS_LIMIT,
): boolean {
  return newSightings(entries, limit).some((recent) => recent.slug === entry.slug);
}

export interface ShelfNeighbours {
  current: PublicShelfEntry;
  /** The next figure up the timeline; wraps to the oldest when `current` is the newest. */
  previous: PublicShelfEntry;
  /** The next figure down the timeline; wraps to the newest at the end of the shelf. */
  next: PublicShelfEntry;
}

/**
 * Where a figure sits on the shelf, and what is on either side of it.
 *
 * The ring wraps on purpose: browsing the shelf is a loop, and a dead end at the oldest
 * figure is a worse answer than coming back round to the newest one. A shelf of one is its
 * own neighbour on both sides.
 */
export function findShelfNeighbours(
  entries: readonly PublicShelfEntry[],
  slug: string,
): ShelfNeighbours | null {
  const visible = filterShelf(entries);
  const index = visible.findIndex((entry) => entry.slug === slug);
  if (index === -1) return null;

  const size = visible.length;
  return {
    current: visible[index],
    previous: visible[(index - 1 + size) % size],
    next: visible[(index + 1) % size],
  };
}

/**
 * The ticker line: `LATEST SIGHTING: SPIDER-MAN #1450 · 🇺🇸 LA · APR 2025`.
 *
 * Built from the newest acquisition, uppercase because it is set in the pixel font.
 * An empty shelf gets the gadget's idle message instead of a half-empty line.
 */
export function latestSightingLine(entries: readonly PublicShelfEntry[]): string {
  const [latest] = filterShelf(entries);
  if (!latest) return "NO SIGHTINGS LOGGED YET · THE SHELF IS WARMING UP";

  return [
    `LATEST SIGHTING: ${latest.name.toUpperCase()} ${formatPopNumber(latest.popNumber)}`,
    formatPlace(latest.acquiredCity, latest.acquiredCountry),
    formatSightingDate(latest.acquiredAt),
  ]
    .filter((part) => part !== "—")
    .join(" · ");
}
