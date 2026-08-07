import "server-only";

import { eq, gt } from "drizzle-orm";

import { db } from "@/db";
import { priceSnapshots, referenceFigures } from "@/db/schema";

import { type MarketSignal } from "./parse";
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
