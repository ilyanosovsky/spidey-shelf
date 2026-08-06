/**
 * The catalog's four buckets (owner decision, ADR-009).
 *
 * `peter` is not "every red-and-blue suit" — it is the figure the stats denominator is
 * about, so `reference_figures.counts_toward_total` is true for exactly the `peter` rows.
 * Everything else is context: other web-slingers (`spider_verse`), the people around them
 * (`friends_foes`), and figures from outside Spider-Man entirely (`other`, which exists so
 * the owner's Deadpools, Stitches and Harry Potter can live in the same vault).
 *
 * The order below is the display order everywhere (tabs, filters, admin lists).
 */
export const FIGURE_CATEGORIES = ["peter", "spider_verse", "friends_foes", "other"] as const;

export type FigureCategory = (typeof FIGURE_CATEGORIES)[number];

/** The category a row falls back to when nothing says otherwise (matches the DB default). */
export const DEFAULT_FIGURE_CATEGORY: FigureCategory = "other";

/**
 * UI labels — Press Start 2P, so they are short and uppercase by design.
 * See docs/wiki/Design-System.md.
 */
export const FIGURE_CATEGORY_LABELS: Record<FigureCategory, string> = {
  peter: "PETER PARKER",
  spider_verse: "SPIDER-VERSE",
  friends_foes: "FRIENDS & FOES",
  other: "OTHER",
};

export function isFigureCategory(value: unknown): value is FigureCategory {
  return typeof value === "string" && (FIGURE_CATEGORIES as readonly string[]).includes(value);
}

/** Label for a category that may be NULL/unknown (a row written before the taxonomy). */
export function figureCategoryLabel(value: unknown): string {
  return isFigureCategory(value)
    ? FIGURE_CATEGORY_LABELS[value]
    : FIGURE_CATEGORY_LABELS[DEFAULT_FIGURE_CATEGORY];
}
