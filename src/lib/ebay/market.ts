import "server-only";

import { collectionFinances, type CollectionFinances } from "@/lib/finances";
import { type PublicShelfEntry } from "@/lib/showcase";

import { fetchMarketSignal } from "./client";
import { isEbayConfigured } from "./config";
import { type MarketSignal } from "./parse";
import {
  figureIdForSlug,
  listFreshPriceSnapshots,
  listRefreshTargets,
  readPriceSnapshot,
  upsertPriceSnapshot,
} from "./queries";
import { ebaySearchQuery, ebaySearchUrl } from "./query";
import { CRON_BUDGET_MS, refreshTargets, type RefreshSummary } from "./refresh";
import {
  decideMarketFetch,
  formatMoney,
  formatSnapshotAge,
  mayShowPriceChip,
  snapshotAgeMs,
  PRICE_DISPLAY_TTL_MS,
  type StoredSnapshot,
} from "./snapshot";

/**
 * The one entry point a page calls: "what should the MARKET SIGNAL panel say?"
 *
 * It is a thin orchestrator on purpose. The gate, the staleness rule and every number are
 * decided in pure modules; what happens here is the ordering — read the cache, decide, maybe
 * spend a round trip, write back, and hand the component a plain object with no dates and no
 * promises in it.
 *
 * The order matters in one place: **the snapshot is written after the signal is in hand and
 * never in the same breath as anything else**. A failed cache write costs the next visitor
 * one API call and nothing else.
 */

/** Everything the panel renders — already formatted, so the component decides nothing. */
export interface MarketPanel extends MarketSignal {
  /** `CHECKED 6H AGO`. */
  ageLabel: string;
  /** True when eBay could not be reached and this is the last known answer. */
  stale: boolean;
  searchUrl: string;
}

function panelFrom(
  signal: MarketSignal,
  fetchedAt: Date,
  now: number,
  searchUrl: string,
  stale: boolean,
): MarketPanel {
  return {
    ...signal,
    ageLabel: formatSnapshotAge(snapshotAgeMs({ ...signal, fetchedAt }, now)),
    stale,
    searchUrl,
  };
}

/**
 * The figure page's price panel, or `null` for "render nothing".
 *
 * `null` is the answer in three different situations, and they are all the same to the page:
 * no keys, nothing cached and eBay unreachable, and a search that found no priced listing.
 * None of them deserves a panel that says so — a public showcase does not narrate its own
 * integrations.
 */
export async function getMarketPanel({
  slug,
  name,
  popNumber,
  now = Date.now(),
}: {
  slug: string;
  name: string;
  popNumber: number | null;
  now?: number;
}): Promise<MarketPanel | null> {
  if (!isEbayConfigured()) return null;

  const figureId = await figureIdForSlug(slug);
  if (!figureId) return null;

  const stored = await readPriceSnapshot(figureId);
  const decision = decideMarketFetch({ configured: true, snapshot: stored, now });

  const query = ebaySearchQuery(name, popNumber);
  const searchUrl = ebaySearchUrl(query);

  const servable = (snapshot: StoredSnapshot, stale: boolean): MarketPanel =>
    panelFrom(snapshot, snapshot.fetchedAt, now, searchUrl, stale);

  if (!decision.refresh) {
    return stored ? servable(stored, false) : null;
  }

  const outcome = await fetchMarketSignal(query);
  if (outcome.kind === "ok") {
    const fetchedAt = new Date(now);
    // A cache the page cannot write to is still a page. Swallow, do not fail the render.
    await upsertPriceSnapshot(figureId, outcome.signal, fetchedAt).catch(() => undefined);
    return panelFrom(outcome.signal, fetchedAt, now, searchUrl, false);
  }

  // eBay said nothing usable. Last known answer, labelled with its age — or no panel at all.
  return decision.serveStored && stored ? servable(stored, true) : null;
}

/**
 * Prices for a whole wishlist page: `slug → "~$24"`, and empty without keys.
 *
 * **This function cannot cause an API call, by construction** — it reads the cache and stops.
 * The wishlist is 232 cards; one refresh per card would spend the entire 5,000-a-day
 * allowance in twenty-two page views, so the rule is not a performance preference, it is what
 * keeps the free tier free. A figure page is the only thing that ever pays for a price, and
 * a chip on the wishlist is that payment being reused.
 *
 * The TTL is applied twice — once in SQL, once through `mayShowPriceChip` — the same
 * belt-and-braces the shelf uses for `is_public`: the SQL is the mechanism, the pure function
 * is the place the rule is written down and tested.
 */
export async function listPriceChips(now: number = Date.now()): Promise<Map<string, string>> {
  if (!isEbayConfigured()) return new Map();

  const fresh = await listFreshPriceSnapshots(now, PRICE_DISPLAY_TTL_MS);
  const chips = new Map<string, string>();

  for (const [slug, snapshot] of fresh) {
    if (!mayShowPriceChip(snapshot, now, PRICE_DISPLAY_TTL_MS)) continue;
    chips.set(slug, `~${formatMoney(snapshot.medianCents, snapshot.currency)}`);
  }

  return chips;
}

/**
 * What the shelf is worth — the FINANCES section on `/stats` (Phase 11).
 *
 * A **cache read and a sum**, and it could not be anything else: `/stats` renders every
 * owned figure, so a page that refreshed what it found stale would spend up to nineteen eBay
 * calls per visitor. The nightly cron is what keeps these numbers current; this function
 * reads what the cron left behind, exactly like the wishlist's chips do.
 *
 * `null` without keys, without snapshots and without a shelf alike — see
 * `collectionFinances()` for why all three render the same nothing.
 */
export async function getCollectionFinances(
  entries: readonly PublicShelfEntry[],
  now: number = Date.now(),
): Promise<CollectionFinances | null> {
  if (!isEbayConfigured()) return null;

  const prices = await listFreshPriceSnapshots(now, PRICE_DISPLAY_TTL_MS);
  return collectionFinances(entries, prices);
}

/**
 * The nightly sweep: refresh every stale price on the shelf, once, and report counts.
 *
 * The only thing that spends an eBay call outside a figure page, and the reason the shelf
 * and `/stats` can print prices at all. It is deliberately thin — the door is
 * `isCronAuthorized()`, the loop and its rules are `refreshTargets()`, and both are pure and
 * tested; what happens here is the wiring of the real client and the real cache to them.
 */
export async function refreshStalePrices(
  budgetMs: number = CRON_BUDGET_MS,
): Promise<RefreshSummary> {
  const targets = await listRefreshTargets();

  return refreshTargets(
    targets,
    { fetch: fetchMarketSignal, save: upsertPriceSnapshot },
    { budgetMs },
  );
}
