import { FIGURE_CATEGORIES, FIGURE_CATEGORY_LABELS, isFigureCategory } from "./categories";
import { type PublicCatalogFigure } from "./search";
import { type ShelfFilter } from "./showcase";

/**
 * The wishlist: the catalog minus the collection, for people who want to gift something.
 *
 * It is not a table — it is the `owned_count = 0` half of `catalog_with_ownership`, filtered
 * and ordered here so the rules are testable without a database.
 */

/**
 * PETER PARKER, not ALL, is the landing tab.
 *
 * The wishlist exists to answer "what should I get him?", and the honest answer is the
 * bucket the counter is about (ADR-009). ALL is one tap away and holds 232 figures — a wall
 * of Venoms and Stitches is a worse first impression than the 109 spiders he is hunting.
 */
export const DEFAULT_WISHLIST_FILTER: ShelfFilter = "peter";

/** `?cat=peter` → `peter`. Unknown or absent falls back to PETER PARKER, `all` is explicit. */
export function parseWishlistFilter(raw: string | string[] | undefined): ShelfFilter {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== "string") return DEFAULT_WISHLIST_FILTER;

  const trimmed = value.trim().toLowerCase();
  if (trimmed === "all") return "all";
  return isFigureCategory(trimmed) ? trimmed : DEFAULT_WISHLIST_FILTER;
}

/** The URL of a tab. The default tab is the bare path — it never shows in the address bar. */
export function wishlistHref(filter: ShelfFilter): string {
  return filter === DEFAULT_WISHLIST_FILTER ? "/wishlist" : `/wishlist?cat=${filter}`;
}

export function filterWishlist(
  figures: readonly PublicCatalogFigure[],
  filter: ShelfFilter = DEFAULT_WISHLIST_FILTER,
): PublicCatalogFigure[] {
  return figures.filter((figure) => filter === "all" || figure.category === filter);
}

/**
 * Wanted figures by box number, low to high; the ones without a number go last.
 *
 * Nine catalog rows are multi-packs with no number of their own. Sorting them as 0 would put
 * them first, ahead of #3 — so they fall to the end and sort by name among themselves. The
 * SQL orders the same way (`nulls last`); this is the tested statement of the rule.
 */
export function orderWishlist(figures: readonly PublicCatalogFigure[]): PublicCatalogFigure[] {
  return [...figures].sort((a, b) => {
    const left = a.popNumber;
    const right = b.popNumber;

    if (left === null && right === null) return a.name.localeCompare(b.name);
    if (left === null) return 1;
    if (right === null) return -1;
    if (left !== right) return left - right;
    return a.name.localeCompare(b.name);
  });
}

export interface WishlistTab {
  value: ShelfFilter;
  label: string;
  count: number;
}

/** ALL plus the four buckets, each carrying how many figures are still out there. */
export function wishlistTabs(figures: readonly PublicCatalogFigure[]): WishlistTab[] {
  return [
    { value: "all" as ShelfFilter, label: "ALL", count: figures.length },
    ...FIGURE_CATEGORIES.map((category) => ({
      value: category as ShelfFilter,
      label: FIGURE_CATEGORY_LABELS[category],
      count: filterWishlist(figures, category).length,
    })),
  ];
}

/**
 * The banner: `WANTED: 109 SPIDERS STILL OUT THERE`.
 *
 * Counted over the `peter` bucket whatever tab is open, because that is the number the home
 * counter promises — the banner must not disagree with the LCD one screen away.
 */
export function wantedHeadline(figures: readonly PublicCatalogFigure[]): string {
  return `WANTED: ${filterWishlist(figures, "peter").length} SPIDERS STILL OUT THERE`;
}
