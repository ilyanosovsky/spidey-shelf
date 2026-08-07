import "server-only";

import { and, asc, desc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { ownedFigures, referenceFigures } from "@/db/schema";

import { type OwnedStatus } from "./collection";
import { type PublicShelfEntry, type ShelfProgress } from "./showcase";

/**
 * The two reads behind the public showcase.
 *
 * Rules that hold for everything in this file:
 *   1. only `is_public = true` shelf rows — the owner's staging switch is respected in SQL,
 *      not in a component;
 *   2. only the columns a visitor may see — `needs_review`, `source`, `source_url` and the
 *      rest of the catalog's internals are never selected (CLAUDE.md, "Security rules");
 *   3. an INNER join on `reference_figures`: a shelf row that is not linked to the catalog
 *      has no slug, so it has no public URL and cannot be shown. The seeder resolves every
 *      row, so today this excludes nothing.
 *
 * Pure logic (filtering, ordering decisions, neighbours, the ticker line) lives in
 * `src/lib/showcase.ts` and is tested there; this file only fetches.
 */

const shelfColumns = {
  slug: referenceFigures.slug,
  name: referenceFigures.name,
  popNumber: referenceFigures.popNumber,
  category: referenceFigures.category,
  productLine: referenceFigures.productLine,
  exclusivity: referenceFigures.exclusivity,
  variantFlags: referenceFigures.variantFlags,
  imagePath: referenceFigures.imagePath,
  status: sql<OwnedStatus | null>`${ownedFigures.status}`,
  isPublic: sql<boolean>`coalesce(${ownedFigures.isPublic}, false)`,
  acquiredAt: ownedFigures.acquiredAt,
  acquiredCity: ownedFigures.acquiredCity,
  acquiredCountry: ownedFigures.acquiredCountry,
  story: ownedFigures.story,
};

/**
 * The whole public shelf, newest acquisition first.
 *
 * `acquired_at` is the sort key, not `created_at`: the collection was backfilled from the
 * owner's Notion table in one seed run, so every row shares a single `created_at` instant
 * and sorting by it would be arbitrary. `created_at` and the name only break ties between
 * two figures picked up on the same day, so the order is stable across requests.
 *
 * One query for the whole shelf on purpose — it is ~20 rows, and the home grid, the ribbon,
 * the ticker and the figure page's neighbours are all views of the same list.
 */
export function listPublicShelf(): Promise<PublicShelfEntry[]> {
  return db
    .select(shelfColumns)
    .from(ownedFigures)
    .innerJoin(referenceFigures, eq(ownedFigures.referenceFigureId, referenceFigures.id))
    .where(eq(ownedFigures.isPublic, true))
    .orderBy(
      desc(ownedFigures.acquiredAt),
      desc(ownedFigures.createdAt),
      asc(referenceFigures.name),
    );
}

/**
 * Progress through the `peter` bucket, which is what "collected" means here (ADR-009).
 *
 * Counted DISTINCT over `reference_figure_id`: owning two copies of #1450 is one figure
 * collected. A figure that later left the shelf still counts — it was collected, and the
 * counter is about the hunt, not about today's inventory.
 */
export async function getShelfProgress(): Promise<ShelfProgress> {
  const [total] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(referenceFigures)
    .where(eq(referenceFigures.category, "peter"));

  const [owned] = await db
    .select({ count: sql<number>`count(distinct ${ownedFigures.referenceFigureId})::int` })
    .from(ownedFigures)
    .innerJoin(referenceFigures, eq(ownedFigures.referenceFigureId, referenceFigures.id))
    .where(and(eq(referenceFigures.category, "peter"), eq(ownedFigures.isPublic, true)));

  return { owned: owned?.count ?? 0, total: total?.count ?? 0 };
}
