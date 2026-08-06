import "server-only";

import { and, asc, desc, eq, exists, sql, type SQL } from "drizzle-orm";

import { db } from "@/db";
import { catalogWithOwnership, ownedFigures, referenceFigures } from "@/db/schema";

import {
  PUBLIC_SEARCH_LIMIT,
  type CatalogSearchResult,
  type PublicCatalogFigure,
  type PublicSearchQuery,
} from "./search";
import { type CategoryProgress } from "./stats";

/**
 * The catalog-wide public reads: search, wishlist, stats denominators.
 *
 * `src/lib/showcase-queries.ts` reads the *shelf* (what the owner has); this file reads the
 * *catalog* (everything that exists) through `catalog_with_ownership`, the one view that
 * already knows which of it is owned. Same rules as the showcase queries:
 *   1. only the columns a visitor may see — `needs_review`, `source` and `source_url` are
 *      never selected, so no public component can leak them (CLAUDE.md, "Security rules");
 *   2. nothing decides anything here. Verdicts, ordering and grouping are pure functions in
 *      `src/lib/search.ts`, `src/lib/wishlist.ts` and `src/lib/stats.ts`.
 */

const publicCatalogColumns = {
  slug: catalogWithOwnership.slug,
  name: catalogWithOwnership.name,
  popNumber: catalogWithOwnership.popNumber,
  category: catalogWithOwnership.category,
  productLine: catalogWithOwnership.productLine,
  exclusivity: catalogWithOwnership.exclusivity,
  variantFlags: catalogWithOwnership.variantFlags,
};

/** Notion's word for a figure that left the shelf. Bound as a parameter, never inlined. */
const GONE = "not_mine_anymore";

/**
 * The two ownership signals the view cannot give on its own.
 *
 * `owned_count` deliberately excludes `not_mine_anymore` rows (Data-Model.md), which is
 * right for the verdict and wrong for the footnote: "he had this one once" is a different
 * sentence from "he never had it", and only the shelf rows know the difference. Both
 * subqueries are restricted to `is_public` rows — a figure the owner is still staging must
 * not leak through a search result any more than through the grid.
 *
 * ⚠️ Built with `exists()` + the query builder, NOT with a raw `sql` template. Drizzle
 * renders an interpolated column **unqualified** inside a SELECT-list template, so the
 * hand-written version of this correlated subquery came out as
 * `"reference_figure_id" = "id"` — and since `owned_figures` has an `id` column of its own,
 * that is valid SQL that is always false. It shipped a silent "NOT OWNED YET" on every
 * figure that had left the shelf. The builder qualifies both sides
 * (`"owned_figures"."reference_figure_id" = "catalog_with_ownership"."id"`).
 *
 * Built inside the request, not at module scope: touching `db` during module evaluation
 * would reintroduce the build-time DATABASE_URL requirement the lazy client exists to avoid.
 */
function ownedFiguresFor(condition?: SQL) {
  return db
    .select({ one: sql`1` })
    .from(ownedFigures)
    .where(
      and(
        eq(ownedFigures.referenceFigureId, catalogWithOwnership.id),
        eq(ownedFigures.isPublic, true),
        condition,
      ),
    );
}

function searchColumns() {
  return {
    ...publicCatalogColumns,
    ownedCount: catalogWithOwnership.ownedCount,
    // `mapWith(Boolean)` only types the column — `exists` already comes back as a JS boolean.
    /** A public shelf row exists whose status is `not_mine_anymore`: it was here once. */
    hadOnce: exists(ownedFiguresFor(eq(ownedFigures.status, GONE))).mapWith(Boolean),
    /** Any public shelf row — i.e. `/figure/<slug>` renders instead of 404. */
    hasPublicPage: exists(ownedFiguresFor()).mapWith(Boolean),
  };
}

/** Owned matches first, so the answer to the gift question can never fall past the limit. */
const ownedFirst = desc(sql`${catalogWithOwnership.ownedCount} > 0`);

/**
 * The gift check: an exact box number, or a name.
 *
 * A run of digits is an exact `pop_number` match against the **whole catalog**, not just the
 * collection — the number is what is printed on the box in the friend's hand, and it is not
 * unique (chases and exclusives share it), so every variant comes back and gets its own
 * verdict. Anything else goes through the same two-signal name search the admin uses: the
 * `search_vector` FTS index OR'd with a trigram match, so both "no way home" and a typo like
 * "spidy" find something.
 *
 * The FTS column lives on `reference_figures` (a stored generated column, see
 * drizzle/0001), not on the view, hence the join on `id`.
 */
export async function searchCatalog(query: PublicSearchQuery): Promise<CatalogSearchResult[]> {
  if (query.kind === "empty") return [];

  if (query.kind === "number") {
    return db
      .select(searchColumns())
      .from(catalogWithOwnership)
      .where(eq(catalogWithOwnership.popNumber, query.popNumber))
      .orderBy(ownedFirst, asc(catalogWithOwnership.name))
      .limit(PUBLIC_SEARCH_LIMIT);
  }

  const text = query.text;
  return db
    .select(searchColumns())
    .from(catalogWithOwnership)
    .innerJoin(referenceFigures, eq(referenceFigures.id, catalogWithOwnership.id))
    .where(
      sql`${referenceFigures}."search_vector" @@ websearch_to_tsquery('simple', ${text})
          or ${referenceFigures.name} % ${text}`,
    )
    .orderBy(
      ownedFirst,
      sql`greatest(
            ts_rank(${referenceFigures}."search_vector", websearch_to_tsquery('simple', ${text})),
            similarity(${referenceFigures.name}, ${text})
          ) desc`,
      asc(catalogWithOwnership.popNumber),
      asc(catalogWithOwnership.name),
    )
    .limit(PUBLIC_SEARCH_LIMIT);
}

/**
 * Everything still out there: the catalog rows nobody owns.
 *
 * `owned_count = 0` IS the wishlist — no second table, no flag to keep in sync. Ordered by
 * box number with the numberless multi-packs last (`orderWishlist()` states the same rule in
 * TypeScript, and is what the tests check).
 */
export function listWishlist(): Promise<PublicCatalogFigure[]> {
  return db
    .select(publicCatalogColumns)
    .from(catalogWithOwnership)
    .where(eq(catalogWithOwnership.ownedCount, 0))
    .orderBy(sql`${catalogWithOwnership.popNumber} asc nulls last`, asc(catalogWithOwnership.name));
}

/**
 * Owned and total per catalog bucket — the counters, and the radar's four sectors.
 *
 * `is_owned` rather than a join on the shelf: the view is the single definition of owned
 * (Data-Model.md), so the stats screen and the search verdict can never disagree.
 */
export function getCatalogProgress(): Promise<CategoryProgress[]> {
  return db
    .select({
      category: catalogWithOwnership.category,
      owned: sql<number>`(count(*) filter (where ${catalogWithOwnership.isOwned}))::int`,
      total: sql<number>`count(*)::int`,
    })
    .from(catalogWithOwnership)
    .groupBy(catalogWithOwnership.category);
}
