import { type FigureCategory } from "./categories";
import { parseReferenceSearchQuery, type ReferenceSearchQuery } from "./collection-form";

/**
 * The gift check — "does Ilya already own this one?" — minus the database.
 *
 * This is the reason the site exists: a friend is standing in a shop with a box in his hand
 * and needs one glance to decide. Everything that glance depends on (how the query is read,
 * what the verdict is, which result comes first) is a pure function here, so it is tested
 * against fixtures instead of against Railway. `src/lib/catalog-queries.ts` only fetches.
 */

/**
 * One catalog figure as a visitor may see it.
 *
 * Deliberately narrow, exactly like `PublicShelfEntry`: `needs_review`, `source`,
 * `source_url` and the rest of the catalog's internals are absent by construction, so a
 * public component cannot leak them even by accident (CLAUDE.md, "Security rules"). The
 * wishlist reads the same shape — it is the same catalog, seen from the other side.
 */
export interface PublicCatalogFigure {
  /** Reference slug — the figure's public URL when it is on the shelf. */
  slug: string;
  name: string;
  popNumber: number | null;
  category: FigureCategory;
  productLine: string | null;
  exclusivity: string | null;
  variantFlags: string[] | null;
}

/** A catalog figure plus the three ownership signals the verdict is made of. */
export interface CatalogSearchResult extends PublicCatalogFigure {
  /**
   * `catalog_with_ownership.owned_count` — copies currently in the collection. The view
   * already excludes `not_mine_anymore` rows, which is why a second signal is needed below.
   */
  ownedCount: number;
  /** A public shelf row exists whose status is `not_mine_anymore`: it was here once. */
  hadOnce: boolean;
  /** A public shelf row exists at all — i.e. `/figure/<slug>` will render instead of 404. */
  hasPublicPage: boolean;
}

/** How the public box reads one input. Same parser as the admin's — one search grammar. */
export type PublicSearchQuery = ReferenceSearchQuery;

/**
 * `?q=` → a parsed query.
 *
 * A repeated parameter takes the first value (the same rule as `?cat=`), and the raw string
 * is trusted to be nothing but text: the number branch is an exact integer match and the
 * text branch is a bound parameter to `websearch_to_tsquery`, never string-built SQL.
 */
export function parseSearchQuery(raw: string | string[] | undefined): PublicSearchQuery {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== "string") return { kind: "empty" };
  return parseReferenceSearchQuery(value);
}

/** What goes back into the input box after a search, so the friend can edit it. */
export function searchQueryValue(raw: string | string[] | undefined): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Generous on purpose: the whole catalog is 247 rows, and a friend typing "spider-man"
 * matching 236 of them still wants the owned ones on screen (the query sorts those first).
 */
export const PUBLIC_SEARCH_LIMIT = 60;

/** The three answers a friend can get. */
export type SearchVerdict = "owned" | "had_once" | "never";

/**
 * The verdict, from the two ownership signals.
 *
 * The order matters: a figure the owner has TWO of, one of them given away, is OWNED —
 * `owned_count` wins over the history. `had_once` is not a softer OWNED either; it is a
 * NOT OWNED with a footnote, because the honest answer to "can I gift this?" is yes.
 */
export function searchVerdict(
  result: Pick<CatalogSearchResult, "ownedCount" | "hadOnce">,
): SearchVerdict {
  if (result.ownedCount > 0) return "owned";
  return result.hadOnce ? "had_once" : "never";
}

/** The stamp's wording. `had_once` says NOT OWNED without the hopeful "YET". */
export const VERDICT_LABELS: Record<SearchVerdict, string> = {
  owned: "OWNED",
  had_once: "NOT OWNED",
  never: "NOT OWNED YET",
};

/** The footnote under a `had_once` stamp — lower case, body font: it is an aside, not a claim. */
export const HAD_ONCE_NOTE = "was in the collection once";

/** Shown when nothing matched. No "email the owner" CTA — this is a read-only showcase. */
export const NO_MATCH_HEADLINE = "NOT IN THE CATALOG (YET)";

export function isOwnedResult(result: CatalogSearchResult): boolean {
  return searchVerdict(result) === "owned";
}

/**
 * Owned matches first, everything else in the order the query returned.
 *
 * The SQL sorts this way too (so the limit can never cut an owned match off the page); this
 * repeats it because it is the one place the rule is spelled out and tested. A number query
 * usually returns several variants sharing the number, and the one already on the shelf is
 * the answer the friend came for — it belongs above the fold, next to its green stamp.
 */
export function orderSearchResults(results: readonly CatalogSearchResult[]): CatalogSearchResult[] {
  return [...results.filter(isOwnedResult), ...results.filter((result) => !isOwnedResult(result))];
}

/**
 * The line above the grid: `31 MATCHES · 1 ALREADY ON THE SHELF`.
 *
 * When the result set is exactly the limit it is almost certainly truncated, and saying so
 * is better than implying the catalog holds exactly 60 Spider-Men.
 */
export function searchSummaryLine(
  results: readonly CatalogSearchResult[],
  limit: number = PUBLIC_SEARCH_LIMIT,
): string {
  const owned = results.filter(isOwnedResult).length;
  const head =
    results.length >= limit
      ? `FIRST ${results.length} MATCHES`
      : `${results.length} MATCH${results.length === 1 ? "" : "ES"}`;

  return owned > 0 ? `${head} · ${owned} ALREADY ON THE SHELF` : head;
}

/** The canonical shareable answer for a figure: its number, or its name when it has none. */
export function searchHrefFor(figure: Pick<PublicCatalogFigure, "popNumber" | "name">): string {
  const query = typeof figure.popNumber === "number" ? String(figure.popNumber) : figure.name;
  return `/search?q=${encodeURIComponent(query)}`;
}
