import "server-only";

import { fetchMarketSignal } from "./client";
import { isEbayConfigured } from "./config";
import { type MarketSignal } from "./parse";
import {
  figureIdForSlug,
  listFreshPriceSnapshots,
  readPriceSnapshot,
  upsertPriceSnapshot,
} from "./queries";
import { ebaySearchQuery, ebaySearchUrl } from "./query";
import {
  decideMarketFetch,
  formatMoney,
  formatSnapshotAge,
  mayShowPriceChip,
  snapshotAgeMs,
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

  const fresh = await listFreshPriceSnapshots(now);
  const chips = new Map<string, string>();

  for (const [slug, snapshot] of fresh) {
    if (!mayShowPriceChip(snapshot, now)) continue;
    chips.set(slug, `~${formatMoney(snapshot.medianCents, snapshot.currency)}`);
  }

  return chips;
}
