import { type MarketSignal } from "./parse";

/**
 * The cache's rules, and the wording on the panel — all of it pure.
 *
 * The interesting decision in Phase 8's prices is not "how do we call eBay", it is **when we
 * are allowed to**. A figure page may spend a network round trip on a price; a wishlist of
 * 232 cards may not, ever. Both rules are functions here rather than `if`s scattered through
 * a page component, so the second one can be tested rather than trusted.
 */

/** A day. Funko prices move on release news and conventions, not on the hour. */
export const PRICE_SNAPSHOT_TTL_MS = 24 * 60 * 60 * 1000;

/** What the database holds. `fetchedAt` is the only thing staleness depends on. */
export interface StoredSnapshot extends MarketSignal {
  fetchedAt: Date;
}

export function snapshotAgeMs(snapshot: StoredSnapshot, now: number): number {
  return Math.max(now - snapshot.fetchedAt.getTime(), 0);
}

/** Fresh enough to serve without asking eBay again. A future timestamp counts as fresh. */
export function isSnapshotFresh(
  snapshot: StoredSnapshot | null | undefined,
  now: number,
  ttl: number = PRICE_SNAPSHOT_TTL_MS,
): boolean {
  if (!snapshot) return false;
  return snapshotAgeMs(snapshot, now) < ttl;
}

export interface MarketDecision {
  /** Ask eBay during this render. Only ever true on a figure page. */
  refresh: boolean;
  /** Render what we already have while (or instead of) refreshing. */
  serveStored: boolean;
}

/**
 * What a figure page should do about prices, given the keys and what is cached.
 *
 * Four cases, and the last is the one worth stating: **a stale snapshot is still served**.
 * If eBay is down, "≈$24, checked 3 days ago" is a better answer than a blank panel, and the
 * age is on screen so nobody mistakes it for live. A missing snapshot with a failed fetch
 * renders nothing at all — there is no honest number to put there.
 */
export function decideMarketFetch({
  configured,
  snapshot,
  now,
  ttl = PRICE_SNAPSHOT_TTL_MS,
}: {
  configured: boolean;
  snapshot: StoredSnapshot | null | undefined;
  now: number;
  ttl?: number;
}): MarketDecision {
  if (!configured) return { refresh: false, serveStored: false };
  if (isSnapshotFresh(snapshot, now, ttl)) return { refresh: false, serveStored: true };
  return { refresh: true, serveStored: Boolean(snapshot) };
}

/**
 * Whether a wishlist card may show a price chip.
 *
 * The rule is one-directional on purpose: the wishlist **reads** the cache and never fills
 * it. 232 cards × one Browse call is 232 calls for one page view, which would burn the whole
 * 5,000/day allowance in twenty-two page loads. A chip appears when a figure page has already
 * paid for that figure's price and the answer is still fresh; otherwise the card looks
 * exactly as it did in Phase 5.
 */
export function mayShowPriceChip(
  snapshot: StoredSnapshot | null | undefined,
  now: number,
  ttl: number = PRICE_SNAPSHOT_TTL_MS,
): boolean {
  return isSnapshotFresh(snapshot, now, ttl);
}

const CURRENCY_SYMBOLS: Readonly<Record<string, string>> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
};

/**
 * `2399, "USD"` → `$24`.
 *
 * **Whole dollars, deliberately.** The panel already says `~` and "active listings, not sold
 * prices"; printing `$23.99` next to those words would claim a precision the number does not
 * have — it is the median of twenty-five strangers' asking prices. An unknown currency code
 * is printed as a prefix (`AUD 24`) rather than guessed at.
 */
export function formatMoney(cents: number, currency: string): string {
  const symbol = CURRENCY_SYMBOLS[currency.toUpperCase()];
  const amount = Math.round(cents / 100);
  return symbol ? `${symbol}${amount}` : `${currency.toUpperCase()} ${amount}`;
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/**
 * `CHECKED JUST NOW` · `CHECKED 6H AGO` · `CHECKED 3D AGO`.
 *
 * Coarse on purpose: the exact minute is noise, and the only question this line answers is
 * "should I trust this number?" — which needs an order of magnitude, not a timestamp.
 */
export function formatSnapshotAge(ageMs: number): string {
  if (ageMs < HOUR_MS) return "CHECKED JUST NOW";
  if (ageMs < DAY_MS) return `CHECKED ${Math.floor(ageMs / HOUR_MS)}H AGO`;
  return `CHECKED ${Math.floor(ageMs / DAY_MS)}D AGO`;
}

/** The panel's wording, in one place — the same closed-table rule as every other screen. */
export const MARKET_COPY = {
  heading: "MARKET SIGNAL",
  link: "SEE ON EBAY",
  disclaimer: "Active listings, not sold prices. eBay US, Buy It Now.",
} as const;

/** `~$24 · 25 LISTINGS` — the LCD line. */
export function marketSignalLine(signal: MarketSignal): string {
  const listings = `${signal.listingCount} ${signal.listingCount === 1 ? "LISTING" : "LISTINGS"}`;
  return `~${formatMoney(signal.medianCents, signal.currency)} · ${listings}`;
}
