import {
  FIGURE_CATEGORIES,
  FIGURE_CATEGORY_LABELS,
  isFigureCategory,
  type FigureCategory,
} from "./categories";
import { countryFlagEmoji } from "./format";
import { filterShelf, type PublicShelfEntry } from "./showcase";

/**
 * The collector's dashboard, minus the database.
 *
 * Three readings of the same collection: how far through each bucket it is (the counters and
 * the radar), when the figures arrived (the timeline), and where they were found (the flags
 * — the travel log is half the point of this collection). All pure, all tested.
 */

/** How much of one catalog bucket is collected. One row per `category`, from the view. */
export interface CategoryProgress {
  category: FigureCategory;
  owned: number;
  total: number;
}

/**
 * The grouped query's rows in taxonomy order, with every bucket present.
 *
 * A bucket with no rows at all is `0 / 0` rather than missing: the radar has a sector for it
 * either way, and a chart that silently loses a category is a chart that lies.
 */
export function normalizeCategoryProgress(
  rows: readonly { category: string; owned: number; total: number }[],
): CategoryProgress[] {
  return FIGURE_CATEGORIES.map((category) => {
    const row = rows.find((candidate) => candidate.category === category);
    return {
      category,
      owned: row?.owned ?? 0,
      total: row?.total ?? 0,
    };
  });
}

export function categoryProgressLabel(progress: CategoryProgress): string {
  return FIGURE_CATEGORY_LABELS[isFigureCategory(progress.category) ? progress.category : "other"];
}

/** One LCD readout on the stats screen. */
export interface VaultCounter {
  label: string;
  /** Already formatted: `11 / 120`. */
  value: string;
}

function sumProgress(
  progress: readonly CategoryProgress[],
  categories: readonly FigureCategory[],
): { owned: number; total: number } {
  return progress
    .filter((row) => categories.includes(row.category))
    .reduce((sum, row) => ({ owned: sum.owned + row.owned, total: sum.total + row.total }), {
      owned: 0,
      total: 0,
    });
}

/**
 * The three counters, widest promise last.
 *
 * PETER CANON is the honest denominator (ADR-009) and the same number the home screen shows.
 * ALL SPIDERS adds the rest of the web-slingers; WHOLE VAULT is every catalogued figure,
 * including the Stitches. Every number is computed from the live catalog — nothing here is
 * a constant that can rot when the CSVs are re-seeded.
 */
export function vaultCounters(progress: readonly CategoryProgress[]): VaultCounter[] {
  const peter = sumProgress(progress, ["peter"]);
  const spiders = sumProgress(progress, ["peter", "spider_verse"]);
  const vault = sumProgress(progress, FIGURE_CATEGORIES);

  return [
    { label: "PETER CANON", value: `${peter.owned} / ${peter.total}` },
    { label: "ALL SPIDERS", value: `${spiders.owned} / ${spiders.total}` },
    { label: "WHOLE VAULT", value: `${vault.owned} / ${vault.total}` },
  ];
}

/** One year of the hunt. */
export interface TimelineRow {
  year: number;
  count: number;
  /** `count / busiest year`, 0…1 — the bar's width. Rounded so the markup is stable. */
  share: number;
}

function acquisitionYear(entry: PublicShelfEntry): number | null {
  const match = /^(\d{4})-\d{2}-\d{2}/.exec((entry.acquiredAt ?? "").trim());
  if (!match) return null;
  return Number.parseInt(match[1], 10);
}

/**
 * Figures per year, from the first sighting to the last, with the empty years kept.
 *
 * Gaps are filled deliberately: a year in which nothing was found is part of the story, and
 * a timeline that skips it would draw 2023 next to 2026 as if they were neighbours. Rows
 * without a date are left out entirely rather than bucketed into a guess.
 */
export function acquisitionTimeline(entries: readonly PublicShelfEntry[]): TimelineRow[] {
  const years = filterShelf(entries)
    .map(acquisitionYear)
    .filter((year): year is number => year !== null);

  if (years.length === 0) return [];

  const first = Math.min(...years);
  const last = Math.max(...years);
  const counts = new Map<number, number>();
  for (const year of years) counts.set(year, (counts.get(year) ?? 0) + 1);

  const busiest = Math.max(...counts.values());

  return Array.from({ length: last - first + 1 }, (_, offset) => {
    const year = first + offset;
    const count = counts.get(year) ?? 0;
    return { year, count, share: busiest > 0 ? Math.round((count / busiest) * 1000) / 1000 : 0 };
  });
}

/** One country of the travel log. */
export interface CountryRow {
  /** ISO 3166-1 alpha-2, uppercase. */
  code: string;
  flag: string;
  count: number;
}

/**
 * Where the collection was found, busiest country first.
 *
 * Ties break by code so the row order never wobbles between requests. A shelf row without a
 * country contributes nothing — the flags row is a travel log, and an unknown place is not
 * a place.
 */
export function acquisitionCountries(entries: readonly PublicShelfEntry[]): CountryRow[] {
  const counts = new Map<string, number>();

  for (const entry of filterShelf(entries)) {
    const code = (entry.acquiredCountry ?? "").trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(code)) continue;
    counts.set(code, (counts.get(code) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([code, count]) => ({ code, flag: countryFlagEmoji(code), count }))
    .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code));
}
