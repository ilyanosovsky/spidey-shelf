import "server-only";

import { asc, eq, gt } from "drizzle-orm";

import { db } from "@/db";
import { ownedFigures, priceSnapshots, referenceFigures } from "@/db/schema";

import { type MarketSignal } from "./parse";
import { type RefreshTarget } from "./refresh";
import { PRICE_SNAPSHOT_TTL_MS, type StoredSnapshot } from "./snapshot";

/**
 * The price cache's three reads and one write.
 *
 * `price_snapshots` is a cache, so nothing in here is allowed to matter: a failure to read it
 * means no panel, a failure to write it means the next page view pays for the same call
 * again. Nothing on this path is inside a transaction with anything the collection cares about.
 *
 * Every function is gated by the caller (`isEbayConfigured()`), so on the owner's current,
 * key-less deployment not one of these queries is ever issued.
 */

/** `price_snapshots` holds a figure id; the public world speaks in slugs. */
export async function figureIdForSlug(slug: string): Promise<string | null> {
  const [row] = await db
    .select({ id: referenceFigures.id })
    .from(referenceFigures)
    .where(eq(referenceFigures.slug, slug))
    .limit(1);

  return row?.id ?? null;
}

function toStored(row: {
  currency: string;
  minCents: number | null;
  medianCents: number | null;
  listingCount: number;
  fetchedAt: Date;
}): StoredSnapshot | null {
  // A row with no median is a row that cannot be rendered — treat it as a cache miss rather
  // than paint `~$0`. It can only exist if a future writer stops guarding its inserts.
  if (row.medianCents === null) return null;

  return {
    currency: row.currency,
    minCents: row.minCents ?? row.medianCents,
    medianCents: row.medianCents,
    listingCount: row.listingCount,
    fetchedAt: row.fetchedAt,
  };
}

export async function readPriceSnapshot(figureId: string): Promise<StoredSnapshot | null> {
  const [row] = await db
    .select({
      currency: priceSnapshots.currency,
      minCents: priceSnapshots.minCents,
      medianCents: priceSnapshots.medianCents,
      listingCount: priceSnapshots.listingCount,
      fetchedAt: priceSnapshots.fetchedAt,
    })
    .from(priceSnapshots)
    .where(eq(priceSnapshots.referenceFigureId, figureId))
    .limit(1);

  return row ? toStored(row) : null;
}

/**
 * Overwrite what we know about one figure. Upsert on the unique FK, so there is one row ever.
 *
 * `fetchedAt` is written explicitly rather than left to the column default: the TTL is
 * computed against this value, and a default that fires at statement time versus transaction
 * time is exactly the kind of hour-long discrepancy nobody notices until a cache never expires.
 */
export async function upsertPriceSnapshot(
  figureId: string,
  signal: MarketSignal,
  fetchedAt: Date = new Date(),
): Promise<void> {
  await db
    .insert(priceSnapshots)
    .values({
      referenceFigureId: figureId,
      currency: signal.currency,
      minCents: signal.minCents,
      medianCents: signal.medianCents,
      listingCount: signal.listingCount,
      fetchedAt,
    })
    .onConflictDoUpdate({
      target: priceSnapshots.referenceFigureId,
      set: {
        currency: signal.currency,
        minCents: signal.minCents,
        medianCents: signal.medianCents,
        listingCount: signal.listingCount,
        fetchedAt,
      },
    });
}

/**
 * Every still-fresh snapshot, keyed by slug — the wishlist's whole price story.
 *
 * One query for the whole page rather than one per card, and a **read only**: the wishlist
 * never triggers a refresh (see `mayShowPriceChip`). The TTL is applied in SQL so a table
 * that has grown to a few hundred rows still sends back only the handful that are current.
 */
export async function listFreshPriceSnapshots(
  now: number = Date.now(),
  ttl: number = PRICE_SNAPSHOT_TTL_MS,
): Promise<Map<string, StoredSnapshot>> {
  const rows = await db
    .select({
      slug: referenceFigures.slug,
      currency: priceSnapshots.currency,
      minCents: priceSnapshots.minCents,
      medianCents: priceSnapshots.medianCents,
      listingCount: priceSnapshots.listingCount,
      fetchedAt: priceSnapshots.fetchedAt,
    })
    .from(priceSnapshots)
    .innerJoin(referenceFigures, eq(referenceFigures.id, priceSnapshots.referenceFigureId))
    .where(gt(priceSnapshots.fetchedAt, new Date(now - ttl)));

  const found = new Map<string, StoredSnapshot>();
  for (const row of rows) {
    const stored = toStored(row);
    if (stored) found.set(row.slug, stored);
  }
  return found;
}

/**
 * Everything the nightly sweep is allowed to spend a call on (Phase 11).
 *
 * **The shelf, not the catalog.** The join is `owned_figures` INNER, so the 232 figures
 * nobody owns are not in this list and never will be: a wishlist card's price is a nice
 * extra, and 247 calls a night to provide it is how a free tier stops being free. The 19
 * figures on the shelf are the ones the shelf grid, `/stats` and the figure pages all
 * actually print a number for.
 *
 * Every status is included, `not_mine_anymore` too. A figure that left the shelf still has a
 * page, still shows a MARKET SIGNAL panel, and refreshing it costs the same as skipping it
 * would save — one call out of five thousand. The FINANCES total is where the status rule
 * lives (`countsTowardValue()`), not here.
 *
 * `DISTINCT` on the figure id, because two copies of #1450 are two shelf rows and one price.
 * Ordered by slug so a sweep that runs out of time runs out in the same place twice, and the
 * figures it never reaches are not the same ones every night by accident of insertion order.
 */
export async function listRefreshTargets(): Promise<RefreshTarget[]> {
  const rows = await db
    .selectDistinct({
      figureId: referenceFigures.id,
      slug: referenceFigures.slug,
      name: referenceFigures.name,
      popNumber: referenceFigures.popNumber,
      currency: priceSnapshots.currency,
      minCents: priceSnapshots.minCents,
      medianCents: priceSnapshots.medianCents,
      listingCount: priceSnapshots.listingCount,
      fetchedAt: priceSnapshots.fetchedAt,
    })
    .from(ownedFigures)
    .innerJoin(referenceFigures, eq(ownedFigures.referenceFigureId, referenceFigures.id))
    .leftJoin(priceSnapshots, eq(priceSnapshots.referenceFigureId, referenceFigures.id))
    .where(eq(ownedFigures.isPublic, true))
    .orderBy(asc(referenceFigures.slug));

  return rows.map((row) => ({
    figureId: row.figureId,
    slug: row.slug,
    name: row.name,
    popNumber: row.popNumber,
    snapshot:
      row.fetchedAt === null
        ? null
        : toStored({
            currency: row.currency ?? "",
            minCents: row.minCents,
            medianCents: row.medianCents,
            listingCount: row.listingCount ?? 0,
            fetchedAt: row.fetchedAt,
          }),
  }));
}
