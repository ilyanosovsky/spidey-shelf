import "server-only";

import { and, desc, eq, isNotNull, ne, sql } from "drizzle-orm";

import { db } from "@/db";
import { catalogWithOwnership, ownedFigures, referenceFigures } from "@/db/schema";

import { type FigureCategory } from "./categories";
import { type OwnedStatus } from "./collection";
import { parseReferenceSearchQuery } from "./collection-form";

/**
 * Every read the admin collection screens perform.
 *
 * These are plain queries, not a guard: the callers (`requireAdmin()`-ed pages and server
 * actions) decide who may run them. Nothing here is exposed to a public page yet.
 */

/** Enough of a catalog row to recognize the figure in a search result. */
export interface ReferenceSearchResult {
  id: string;
  slug: string;
  popNumber: number | null;
  name: string;
  category: FigureCategory;
  productLine: string | null;
  exclusivity: string | null;
  releaseYear: number | null;
}

const referenceColumns = {
  id: referenceFigures.id,
  slug: referenceFigures.slug,
  popNumber: referenceFigures.popNumber,
  name: referenceFigures.name,
  category: referenceFigures.category,
  productLine: referenceFigures.productLine,
  exclusivity: referenceFigures.exclusivity,
  releaseYear: referenceFigures.releaseYear,
};

/** Never ship a whole catalog into a dropdown. */
export const SEARCH_RESULT_LIMIT = 25;

/**
 * The search behind the add screen: an exact `pop_number`, or the name.
 *
 * The text branch is the `search_vector` FTS index OR'd with a trigram match on `name`, so
 * both "no way home" (words the vector knows) and "spidey" (a near-miss the trigram index
 * catches) find something. Ranking prefers the better of the two signals, then the number.
 */
export async function searchReferenceFigures(rawQuery: string): Promise<ReferenceSearchResult[]> {
  const query = parseReferenceSearchQuery(rawQuery);
  if (query.kind === "empty") return [];

  if (query.kind === "number") {
    return db
      .select(referenceColumns)
      .from(referenceFigures)
      .where(eq(referenceFigures.popNumber, query.popNumber))
      .orderBy(referenceFigures.name)
      .limit(SEARCH_RESULT_LIMIT);
  }

  const text = query.text;
  return db
    .select(referenceColumns)
    .from(referenceFigures)
    .where(
      sql`search_vector @@ websearch_to_tsquery('simple', ${text}) or ${referenceFigures.name} % ${text}`,
    )
    .orderBy(
      sql`greatest(
            ts_rank(search_vector, websearch_to_tsquery('simple', ${text})),
            similarity(${referenceFigures.name}, ${text})
          ) desc`,
      referenceFigures.popNumber,
      referenceFigures.name,
    )
    .limit(SEARCH_RESULT_LIMIT);
}

/** One shelf row joined with the catalog figure it points at. */
export interface OwnedFigureRow {
  id: string;
  referenceFigureId: string | null;
  status: OwnedStatus | null;
  isPublic: boolean | null;
  acquiredAt: string | null;
  acquiredCity: string | null;
  acquiredCountry: string | null;
  story: string | null;
  createdAt: Date;
  popNumber: number | null;
  name: string | null;
  category: FigureCategory | null;
  productLine: string | null;
  exclusivity: string | null;
  slug: string | null;
}

const ownedColumns = {
  id: ownedFigures.id,
  referenceFigureId: ownedFigures.referenceFigureId,
  status: sql<OwnedStatus | null>`${ownedFigures.status}`,
  isPublic: ownedFigures.isPublic,
  acquiredAt: ownedFigures.acquiredAt,
  acquiredCity: ownedFigures.acquiredCity,
  acquiredCountry: ownedFigures.acquiredCountry,
  story: ownedFigures.story,
  createdAt: ownedFigures.createdAt,
  popNumber: referenceFigures.popNumber,
  name: referenceFigures.name,
  category: referenceFigures.category,
  productLine: referenceFigures.productLine,
  exclusivity: referenceFigures.exclusivity,
  slug: referenceFigures.slug,
};

/**
 * The whole shelf, newest acquisition first.
 *
 * A LEFT join, not an inner one: `reference_figure_id` is nullable by design (a figure can
 * be owned before it is catalogued), and such a row must still be editable in the admin.
 * `acquired_at` sorts first because that is the story order; `created_at` breaks ties.
 */
export function listOwnedFigures(): Promise<OwnedFigureRow[]> {
  return db
    .select(ownedColumns)
    .from(ownedFigures)
    .leftJoin(referenceFigures, eq(ownedFigures.referenceFigureId, referenceFigures.id))
    .orderBy(desc(ownedFigures.acquiredAt), desc(ownedFigures.createdAt));
}

export async function getOwnedFigure(id: string): Promise<OwnedFigureRow | null> {
  const [figure] = await db
    .select(ownedColumns)
    .from(ownedFigures)
    .leftJoin(referenceFigures, eq(ownedFigures.referenceFigureId, referenceFigures.id))
    .where(eq(ownedFigures.id, id))
    .limit(1);

  return figure ?? null;
}

/** The numbers on the console's LCD panel. */
export interface VaultStats {
  /** Shelf rows whose status is `mine`. */
  mine: number;
  /** Shelf rows in total, including the ones that left. */
  total: number;
  /** Distinct `peter` catalog figures owned — the numerator of the honest denominator. */
  peterOwned: number;
  /** Every `peter` figure that exists in the catalog. */
  peterTotal: number;
}

export async function getVaultStats(): Promise<VaultStats> {
  const [shelf] = await db
    .select({
      mine: sql<number>`(count(*) filter (where ${ownedFigures.status} = 'mine'))::int`,
      total: sql<number>`count(*)::int`,
    })
    .from(ownedFigures);

  const [peter] = await db
    .select({
      owned: sql<number>`(count(*) filter (where ${catalogWithOwnership.isOwned}))::int`,
      total: sql<number>`count(*)::int`,
    })
    .from(catalogWithOwnership)
    .where(eq(catalogWithOwnership.category, "peter"));

  return {
    mine: shelf?.mine ?? 0,
    total: shelf?.total ?? 0,
    peterOwned: peter?.owned ?? 0,
    peterTotal: peter?.total ?? 0,
  };
}

/**
 * Is this exact figure already on the shelf on this exact day?
 *
 * The same key the seeder uses, so entering by hand what the CSV already holds is caught
 * instead of silently doubling a figure. `exceptId` lets the edit form save itself.
 */
export async function findDuplicateOwnedFigure(
  referenceFigureId: string,
  acquiredAt: string,
  exceptId?: string,
): Promise<string | null> {
  const [existing] = await db
    .select({ id: ownedFigures.id })
    .from(ownedFigures)
    .where(
      and(
        isNotNull(ownedFigures.referenceFigureId),
        eq(ownedFigures.referenceFigureId, referenceFigureId),
        eq(ownedFigures.acquiredAt, acquiredAt),
        exceptId ? ne(ownedFigures.id, exceptId) : undefined,
      ),
    )
    .limit(1);

  return existing?.id ?? null;
}
