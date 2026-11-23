/**
 * The catalog's six buckets (owner decision, ADR-009; extended in Phase 14).
 *
 * `peter` is not "every red-and-blue suit" — it is the figure the stats denominator is
 * about, so `reference_figures.counts_toward_total` is true for exactly the `peter` rows.
 * Everything else is context: other web-slingers (`spider_verse`), the people around them
 * (`friends_foes`), Veronika's two lines (`stitch`, `grogu` — she collects alongside the
 * owner, but only these two), and figures from outside all of that (`other`, the catch-all
 * that lets the owner's Deadpools and Harry Potter live in the same vault).
 *
 * The order below is the display order everywhere (tabs, filters, admin lists). `other`
 * stays last because it is the catch-all, not a line anyone hunts.
 */
export const FIGURE_CATEGORIES = [
  "peter",
  "spider_verse",
  "friends_foes",
  "stitch",
  "grogu",
  "other",
] as const;

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
  stitch: "STITCH",
  grogu: "GROGU",
  other: "OTHER",
};

/**
 * The lines Veronika collects. They drive the smart defaults (a Stitch scanned in Quick Add
 * is preselected as hers) and the wishlist (her lines have no hunt catalog of their own).
 */
export const VERONIKA_CATEGORIES = ["stitch", "grogu"] as const;

export function isFigureCategory(value: unknown): value is FigureCategory {
  return typeof value === "string" && (FIGURE_CATEGORIES as readonly string[]).includes(value);
}

/** True for one of Veronika's lines; anything else (including NULL/unknown) is not. */
export function isVeronikaCategory(value: unknown): boolean {
  return typeof value === "string" && (VERONIKA_CATEGORIES as readonly string[]).includes(value);
}

/** Label for a category that may be NULL/unknown (a row written before the taxonomy). */
export function figureCategoryLabel(value: unknown): string {
  return isFigureCategory(value)
    ? FIGURE_CATEGORY_LABELS[value]
    : FIGURE_CATEGORY_LABELS[DEFAULT_FIGURE_CATEGORY];
}
