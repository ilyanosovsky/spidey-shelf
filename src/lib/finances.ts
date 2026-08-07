import { formatMoney, type StoredSnapshot } from "./ebay/snapshot";
import { type PublicShelfEntry } from "./showcase";

/**
 * What the shelf is worth, as arithmetic over rows somebody else already fetched.
 *
 * Nothing here reads a database or a network — the input is the same `PublicShelfEntry[]`
 * every other view of the collection is built from, plus the `price_snapshots` the nightly
 * cron filled in. That is the whole architecture of Phase 11 in one sentence: **pages read
 * the cache, the cron feeds it**, and the sum is pure.
 *
 * Three rules decide which rows are money, and each one is a claim the owner would have to
 * defend to a friend reading the page:
 *
 *   1. **Only `mine`.** A figure that left the shelf keeps its card, its story and its place
 *      in the counters — the collection is about the hunt — but it is not part of what the
 *      shelf is worth today. Neither is a row with no status at all: that is a half-finished
 *      quick-add, and an unfinished sighting is not a valuation. (This is deliberately
 *      stricter than `catalog_with_ownership.owned_count`, which counts a NULL status; that
 *      view answers "is it collected", which survives an unfinished form. This answers "what
 *      is on the shelf", which does not.)
 *   2. **Only what has a price.** A figure with no cached snapshot is left out of the total
 *      rather than counted as zero, and the count of what was priced is printed next to the
 *      number so the total is never mistaken for a complete one.
 *   3. **One currency.** Adding a dollar median to a euro median produces a number, not a
 *      price. The majority currency wins and the rest are dropped — the same rule
 *      `parseBrowseResponse()` applies inside a single figure's listings.
 */

/** The name, the picture and the price of one end of the collection. */
export interface FinanceFigure {
  slug: string;
  name: string;
  category: PublicShelfEntry["category"];
  popNumber: number | null;
  imagePath: string | null;
  medianCents: number;
  /** `~$24`, already formatted — the component decides nothing. */
  price: string;
}

/** Everything the FINANCES section renders. `null` when there is nothing honest to show. */
export interface CollectionFinances {
  /** Σ median × quantity over the priced `mine` rows, in cents. */
  totalCents: number;
  /** `~$412`. */
  totalLabel: string;
  /** How many of the owned figures had a usable snapshot. */
  pricedCount: number;
  /** How many figures are on the shelf at all — the coverage denominator. */
  ownedCount: number;
  top: FinanceFigure;
  bottom: FinanceFigure;
  /** ISO 4217, uppercase — the one currency everything above is in. */
  currency: string;
}

/**
 * The rows that count as "what is on the shelf right now".
 *
 * `isPublic` is checked here as well as in SQL, the same belt-and-braces `filterShelf()`
 * uses: the query is the mechanism, this is the place the rule is written down and tested.
 */
export function countsTowardValue(entry: PublicShelfEntry): boolean {
  return entry.isPublic === true && entry.status === "mine";
}

/** A quantity column that has been NULL since Phase 1 means one figure, not none. */
function copies(entry: PublicShelfEntry): number {
  const quantity = entry.quantity ?? 1;
  return Number.isFinite(quantity) ? Math.max(Math.trunc(quantity), 0) : 0;
}

interface PricedRow {
  entry: PublicShelfEntry;
  snapshot: StoredSnapshot;
}

/**
 * The currency most of the priced figures are quoted in, ties broken on the code.
 *
 * Deterministic on purpose: the same shelf and the same cache must produce the same total on
 * every request, or a refresh looks like a price move.
 */
function dominantCurrency(rows: readonly PricedRow[]): string {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const code = row.snapshot.currency.toUpperCase();
    counts.set(code, (counts.get(code) ?? 0) + 1);
  }

  let winner = "";
  let best = 0;
  for (const [code, count] of counts) {
    if (count > best || (count === best && code < winner)) {
      winner = code;
      best = count;
    }
  }
  return winner;
}

function toFigure(row: PricedRow): FinanceFigure {
  return {
    slug: row.entry.slug,
    name: row.entry.name,
    category: row.entry.category,
    popNumber: row.entry.popNumber,
    imagePath: row.entry.imagePath,
    medianCents: row.snapshot.medianCents,
    price: `~${formatMoney(row.snapshot.medianCents, row.snapshot.currency)}`,
  };
}

/**
 * The whole FINANCES section, or `null`.
 *
 * `null` covers every "there is no number to print" case at once — no keys (the caller hands
 * over an empty map), no snapshots yet, nothing owned, nothing priced — because they all
 * render the same thing: no section. A public showcase does not narrate its own integrations,
 * and "TOTAL VAULT VALUE: $0" is worse than silence in a way that "$412" is not.
 */
export function collectionFinances(
  entries: readonly PublicShelfEntry[],
  prices: ReadonlyMap<string, StoredSnapshot>,
): CollectionFinances | null {
  const owned = entries.filter(countsTowardValue);
  if (owned.length === 0) return null;

  const priced: PricedRow[] = [];
  for (const entry of owned) {
    const snapshot = prices.get(entry.slug);
    if (snapshot) priced.push({ entry, snapshot });
  }

  const currency = dominantCurrency(priced);
  const counted = priced.filter((row) => row.snapshot.currency.toUpperCase() === currency);
  if (counted.length === 0) return null;

  const totalCents = counted.reduce(
    (sum, row) => sum + row.snapshot.medianCents * copies(row.entry),
    0,
  );

  // Ties break on the name so the two cards never swap between requests.
  const byPrice = [...counted].sort(
    (a, b) =>
      a.snapshot.medianCents - b.snapshot.medianCents || a.entry.name.localeCompare(b.entry.name),
  );

  return {
    totalCents,
    totalLabel: `~${formatMoney(totalCents, currency)}`,
    pricedCount: counted.length,
    ownedCount: owned.length,
    top: toFigure(byPrice[byPrice.length - 1]),
    bottom: toFigure(byPrice[0]),
    currency,
  };
}

/** `PRICED: 7 / 15` — the coverage line, and the reason the total is an estimate. */
export function financeCoverageLine(finances: CollectionFinances): string {
  return `PRICED: ${finances.pricedCount} / ${finances.ownedCount}`;
}

/** True while the sweep has not caught up with the shelf yet. */
export function isCoveragePartial(finances: CollectionFinances): boolean {
  return finances.pricedCount < finances.ownedCount;
}

/**
 * The section's wording, in one place — the same closed-table rule as `MARKET_COPY`,
 * `QUICK_ADD_COPY` and `SCAN_COPY`.
 *
 * The fine print is **not** retyped here: it is `MARKET_COPY.disclaimer`, imported by the
 * component from the module that owns it. Two copies of "active listings, not sold prices"
 * is one copy that can quietly stop matching the other, and that sentence is the one doing
 * the honest work on this screen.
 */
export const FINANCE_COPY = {
  heading: "FINANCES",
  total: "TOTAL VAULT VALUE",
  top: "MOST PRIZED",
  bottom: "EASIEST FIND",
  pending: "MORE AFTER THE NEXT NIGHTLY SWEEP",
} as const;
