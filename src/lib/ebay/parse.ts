/**
 * Turning whatever eBay sends back into a number, or into nothing.
 *
 * Pure and total: every function here takes `unknown` and returns a value, never throws, and
 * never assumes a shape. That is not defensive-programming theatre — this runs inside a page
 * render, and a `TypeError` from `payload.itemSummaries[0].price.value` would replace a
 * figure's page with an error boundary because a listing had no price on it.
 *
 * ⚠️ **The shapes below are eBay's documented ones, not observed ones.** The owner has no
 * developer keys yet (Phase 8 shipped the feature gated), so these were written against the
 * Browse API reference and exercised against fixtures. When the keys arrive, one real
 * response should be diffed against `parse.test.ts`'s fixtures before the panel is trusted.
 */

/** What one refresh learned about a figure. Money is integer cents, always. */
export interface MarketSignal {
  /** Priced listings the numbers were computed over — the sample, not eBay's total. */
  listingCount: number;
  minCents: number;
  medianCents: number;
  /** ISO 4217, uppercase. */
  currency: string;
}

/** Every way a Browse call can end. The caller renders each one differently, or not at all. */
export type BrowseOutcome =
  | { kind: "ok"; signal: MarketSignal }
  /** A valid response with nothing priced in it — a real answer, and it is "no idea". */
  | { kind: "empty" }
  /** 401/403 — the token is stale or the keys are wrong. */
  | { kind: "unauthorized" }
  /** 429 — the daily quota or the burst limit. Never retried. */
  | { kind: "rate-limited" }
  /** Anything else: a 500, a captive portal's HTML, a truncated body, a timeout. */
  | { kind: "unusable" };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * `"12.99"` → `1299`. Also survives `"1,299.00"`, `12.99`, and `" 12.9 "`.
 *
 * Rounded, not truncated: a price of `19.999` (eBay does send three decimals on some
 * converted currencies) is 20 dollars, not 19.99. Anything that is not a finite positive
 * number is `null`, and a `null` price drops the listing rather than counting it as free.
 */
export function priceToCents(value: unknown): number | null {
  const raw =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value.replace(/,/g, ""))
        : NaN;

  if (!Number.isFinite(raw) || raw <= 0) return null;
  return Math.round(raw * 100);
}

/** `[1, 2, 3, 4]` → `250`. Even counts average the middle pair; the input is sorted here. */
export function medianCents(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]
    : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

interface PricedItem {
  cents: number;
  currency: string;
}

function pricedItems(payload: unknown): PricedItem[] {
  if (!isRecord(payload) || !Array.isArray(payload.itemSummaries)) return [];

  const items: PricedItem[] = [];
  for (const summary of payload.itemSummaries) {
    if (!isRecord(summary) || !isRecord(summary.price)) continue;

    const cents = priceToCents(summary.price.value);
    const currency =
      typeof summary.price.currency === "string" ? summary.price.currency.toUpperCase() : "";
    if (cents === null || !/^[A-Z]{3}$/.test(currency)) continue;

    items.push({ cents, currency });
  }
  return items;
}

/**
 * The numbers, from a body that parsed.
 *
 * **Mixed currencies are not averaged.** A US search can return the odd GBP or EUR listing,
 * and a median across three currencies is not a price, it is a number. The majority currency
 * wins and everything else is discarded, so `listingCount` and the median always describe the
 * same set of listings — which is the whole reason the count is on the panel next to the price.
 */
export function parseBrowseResponse(payload: unknown): MarketSignal | null {
  const items = pricedItems(payload);
  if (items.length === 0) return null;

  const byCurrency = new Map<string, number[]>();
  for (const item of items) {
    byCurrency.set(item.currency, [...(byCurrency.get(item.currency) ?? []), item.cents]);
  }

  let currency = "";
  let cents: number[] = [];
  for (const [candidate, values] of byCurrency) {
    // Ties break on the currency code, so the same body always yields the same answer.
    if (values.length > cents.length || (values.length === cents.length && candidate < currency)) {
      currency = candidate;
      cents = values;
    }
  }

  if (cents.length === 0) return null;

  return {
    listingCount: cents.length,
    minCents: Math.min(...cents),
    medianCents: medianCents(cents),
    currency,
  };
}

/**
 * HTTP status + body → an outcome, with no branch that throws.
 *
 * The body is taken as already-parsed JSON or as `undefined` when it did not parse; a
 * non-2xx status is classified before the body is even looked at, because a 429's body is an
 * error document and reading a price out of it would be inventing one.
 */
export function interpretBrowseResponse(status: number, payload: unknown): BrowseOutcome {
  if (status === 401 || status === 403) return { kind: "unauthorized" };
  if (status === 429) return { kind: "rate-limited" };
  if (status < 200 || status >= 300) return { kind: "unusable" };

  if (!isRecord(payload)) return { kind: "unusable" };

  const signal = parseBrowseResponse(payload);
  return signal ? { kind: "ok", signal } : { kind: "empty" };
}

/** The OAuth token response — `access_token` plus a lifetime in seconds. */
export interface EbayToken {
  accessToken: string;
  /** Epoch milliseconds after which the token must not be used. */
  expiresAt: number;
}

/**
 * Parse a client-credentials token response, expiring it early on purpose.
 *
 * eBay's application tokens last two hours. A minute is shaved off the lifetime so a token
 * cannot expire *between* the check and the request that uses it — the failure mode that
 * would otherwise look like an intermittent, unreproducible 401.
 */
export function parseTokenResponse(payload: unknown, now: number): EbayToken | null {
  if (!isRecord(payload)) return null;

  const token = payload.access_token;
  const lifetime = payload.expires_in;
  if (typeof token !== "string" || token.trim() === "") return null;
  if (typeof lifetime !== "number" || !Number.isFinite(lifetime) || lifetime <= 0) return null;

  return { accessToken: token, expiresAt: now + Math.max(lifetime - 60, 0) * 1000 };
}
