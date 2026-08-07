import { type BrowseOutcome, type MarketSignal } from "./parse";
import { ebaySearchQuery } from "./query";
import { PRICE_REFRESH_AFTER_MS, isSnapshotFresh, type StoredSnapshot } from "./snapshot";

/**
 * The nightly sweep, minus the network and minus the database (Phase 11).
 *
 * Pages do not fetch prices any more — the cron does, and every page reads what it left in
 * `price_snapshots`. That inverts the Phase 8 arrangement, where a figure page paid for its
 * own lookup, and it is what makes a price chip on a twenty-card shelf and a total on
 * `/stats` affordable at all: the cost of a price is now once a day per figure, not once per
 * visitor per figure.
 *
 * Everything decidable is decided here, over injected dependencies, so the loop that spends
 * real money on somebody's quota can be run in a test with no keys, no clock and no eBay:
 *
 *   · `isCronAuthorized()` — the door, pure, and closed by default;
 *   · `refreshTargets()` — the loop, over a `fetch` and a `save` the caller supplies.
 *
 * `src/lib/ebay/market.ts` wires the real client and the real queries to it, and the route
 * handler at `/api/cron/refresh-prices` is then five lines long.
 */

/**
 * Vercel's cron authentication, which is a bearer token and nothing cleverer.
 *
 * When `CRON_SECRET` exists in the project's environment, Vercel sends
 * `Authorization: Bearer <it>` on every scheduled invocation — so the check is a string
 * comparison, and the interesting part is what happens when it cannot be made:
 *
 * **A missing or blank secret authorizes nobody.** The other reading — "no secret
 * configured, so let it through" — turns a forgotten environment variable into a public
 * endpoint that spends the day's eBay allowance for whoever curls it. Failing closed costs
 * an unconfigured deployment a 401 in a log nobody reads; failing open costs the quota.
 *
 * The comparison is not constant-time and does not need to be: the answer is a fixed amount
 * of work behind it (a database read and, at most, nineteen calls), there is no user to
 * enumerate, and the secret is 256 bits of random.
 */
export function isCronAuthorized(
  header: string | null | undefined,
  secret: string | undefined,
): boolean {
  const expected = secret?.trim() ?? "";
  if (expected === "") return false;

  const presented = header?.trim() ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(presented);
  return match !== null && match[1].trim() === expected;
}

/**
 * How long the sweep may run before it stops starting calls.
 *
 * Ten seconds under the route's own `maxDuration`. Nineteen figures at eBay's 5-second
 * ceiling is 95 seconds in the worst imaginable case — in practice a call is well under a
 * second and a full sweep takes ten — so this is not a limit the run is expected to reach;
 * it is the difference between a slow night reporting what it did and a killed function
 * reporting nothing.
 */
export const CRON_BUDGET_MS = 50_000;

/** One figure the sweep may spend a call on, with whatever the cache already holds for it. */
export interface RefreshTarget {
  figureId: string;
  slug: string;
  name: string;
  popNumber: number | null;
  snapshot: StoredSnapshot | null;
}

/**
 * What the run did, and the only thing the route handler answers with.
 *
 * Counts, never listings: this endpoint is reachable from the internet with the right header,
 * and a price feed is not something a cron log needs to repeat. `checked + 0` is also the
 * cheapest possible smoke test — a summary of `{checked: 0}` means the join found nothing,
 * which is a different bug from `{failed: 19}`.
 */
export interface RefreshSummary {
  /** Figures the sweep looked at — targets it reached before the time budget ran out. */
  checked: number;
  /** Figures whose snapshot was replaced with a fresh answer from eBay. */
  refreshed: number;
  /** Figures eBay answered unusably (429, 401, a timeout) — skipped, never retried. */
  failed: number;
  /** Figures whose cached price was young enough to leave alone. */
  skippedFresh: number;
}

export interface RefreshDeps {
  /** One Browse call. Must not throw — `fetchMarketSignal()` does not. */
  fetch: (query: string) => Promise<BrowseOutcome>;
  /** Write the cache. A failed write costs the next sweep one call and nothing else. */
  save: (figureId: string, signal: MarketSignal, fetchedAt: Date) => Promise<void>;
  /** Injected so a test does not have to wait for a real clock to move. */
  now?: () => number;
}

export interface RefreshOptions {
  /** Anything older than this is refreshed. See `PRICE_REFRESH_AFTER_MS`. */
  ttl?: number;
  /**
   * Wall clock for the whole sweep. The loop starts no new call once it is spent.
   *
   * A serverless function is killed at its `maxDuration` with no chance to answer, and a
   * killed run reports nothing at all — not even the figures it did refresh, which it did
   * refresh, because each one is written as it arrives. Stopping early is how the summary
   * survives a slow night.
   */
  budgetMs?: number;
}

/**
 * Refresh every stale target, one at a time, and report.
 *
 * Three rules, and each is the same rule some other client in this project already follows:
 *
 *   1. **Sequential.** Nineteen parallel calls is a burst against a rate limiter for no gain
 *      — nothing is waiting on this run, and a cron that trips a 429 has spent its own night.
 *   2. **One attempt, no retries** (ADR-006, the UPCitemdb rule). A 429 answered by trying
 *      again is how a daily quota disappears in an afternoon. A failure is counted and the
 *      figure keeps yesterday's price, which is exactly what the display TTL is slack for.
 *   3. **A fresh snapshot is not touched.** The sweep is idempotent within its own TTL, so
 *      running it twice by hand costs nothing the second time.
 */
export async function refreshTargets(
  targets: readonly RefreshTarget[],
  deps: RefreshDeps,
  { ttl = PRICE_REFRESH_AFTER_MS, budgetMs = Number.POSITIVE_INFINITY }: RefreshOptions = {},
): Promise<RefreshSummary> {
  const clock = deps.now ?? Date.now;
  const startedAt = clock();
  const summary: RefreshSummary = { checked: 0, refreshed: 0, failed: 0, skippedFresh: 0 };

  for (const target of targets) {
    if (clock() - startedAt >= budgetMs) break;
    summary.checked += 1;

    if (isSnapshotFresh(target.snapshot, clock(), ttl)) {
      summary.skippedFresh += 1;
      continue;
    }

    const outcome = await deps.fetch(ebaySearchQuery(target.name, target.popNumber));
    if (outcome.kind !== "ok") {
      summary.failed += 1;
      continue;
    }

    // Written per figure rather than batched at the end: a run that is cut off mid-sweep
    // should keep what it already paid for.
    await deps.save(target.figureId, outcome.signal, new Date(clock())).catch(() => undefined);
    summary.refreshed += 1;
  }

  return summary;
}
