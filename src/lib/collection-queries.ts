import "server-only";

import { and, asc, desc, eq, ilike, inArray, isNotNull, ne, or, sql, type SQL } from "drizzle-orm";

import { db } from "@/db";
import { catalogWithOwnership, ownedFigures, referenceFigures } from "@/db/schema";

import { type FigureCategory } from "./categories";
import { type OwnedStatus } from "./collection";
import { type ReferenceSearchQuery } from "./collection-form";
import {
  variantNamePrefix,
  type AdminCatalogFigure,
  type OwnedCopy,
  type SightingPlace,
} from "./quick-add";

/**
 * Every read the admin collection screens perform.
 *
 * These are plain queries, not a guard: the callers (`requireAdmin()`-ed pages and server
 * actions) decide who may run them. Nothing here is exposed to a public page yet.
 */

/**
 * Enough of a catalog row to recognize the figure — the shape the edit form's header takes.
 * The Quick Add flow uses the wider `AdminCatalogFigure`, which adds the two admin-only
 * signals (`needs_review`, `owned_count`).
 */
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

/** Never ship a whole catalog into a dropdown. */
export const SEARCH_RESULT_LIMIT = 25;

/**
 * The catalog as the admin sees it: the public columns plus `needs_review` and `owned_count`.
 *
 * Read off `catalog_with_ownership` rather than off `reference_figures`, so "he already has
 * this one" comes from the same view that answers the public verdict — the add screen and
 * the gift check can never disagree about what is owned.
 */
const adminCatalogColumns = {
  id: catalogWithOwnership.id,
  slug: catalogWithOwnership.slug,
  name: catalogWithOwnership.name,
  popNumber: catalogWithOwnership.popNumber,
  category: catalogWithOwnership.category,
  productLine: catalogWithOwnership.productLine,
  exclusivity: catalogWithOwnership.exclusivity,
  variantFlags: catalogWithOwnership.variantFlags,
  releaseYear: catalogWithOwnership.releaseYear,
  needsReview: sql<boolean>`coalesce(${catalogWithOwnership.needsReview}, false)`,
  ownedCount: catalogWithOwnership.ownedCount,
};

/**
 * Step 1 of Quick Add: an exact `pop_number`, or the name, over the WHOLE catalog.
 *
 * The same two-signal name search the public gift check runs — the `search_vector` FTS index
 * OR'd with a `pg_trgm` similarity on `name`, ranked by the better of the two — so "no way
 * home" and a typo like "spidy" both find something. The query is already parsed by the
 * caller (the page owns `?q=`), which is what keeps this function free of URL handling.
 */
export async function searchAdminCatalog(
  query: ReferenceSearchQuery,
): Promise<AdminCatalogFigure[]> {
  if (query.kind === "empty") return [];

  if (query.kind === "number") {
    return db
      .select(adminCatalogColumns)
      .from(catalogWithOwnership)
      .where(eq(catalogWithOwnership.popNumber, query.popNumber))
      .orderBy(asc(catalogWithOwnership.name))
      .limit(SEARCH_RESULT_LIMIT);
  }

  const text = query.text;
  return db
    .select(adminCatalogColumns)
    .from(catalogWithOwnership)
    .innerJoin(referenceFigures, eq(referenceFigures.id, catalogWithOwnership.id))
    .where(
      sql`${referenceFigures}."search_vector" @@ websearch_to_tsquery('simple', ${text})
          or ${referenceFigures.name} % ${text}`,
    )
    .orderBy(
      sql`greatest(
            ts_rank(${referenceFigures}."search_vector", websearch_to_tsquery('simple', ${text})),
            similarity(${referenceFigures.name}, ${text})
          ) desc`,
      asc(catalogWithOwnership.popNumber),
      asc(catalogWithOwnership.name),
    )
    .limit(SEARCH_RESULT_LIMIT);
}

/** One catalog figure by id — the hero of the confirm and details steps. */
export async function getAdminFigure(id: string): Promise<AdminCatalogFigure | null> {
  const [figure] = await db
    .select(adminCatalogColumns)
    .from(catalogWithOwnership)
    .where(eq(catalogWithOwnership.id, id))
    .limit(1);

  return figure ?? null;
}

/**
 * The catalog rows already carrying a scanned barcode.
 *
 * Both spellings of the code are passed in (`upcLookupForms()`): the column is text and
 * may hold the twelve-digit UPC-A or the thirteen-digit EAN-13 of the same product, and a
 * lookup that knew only one of them would miss the row and spend one of the hundred daily
 * UPCitemdb calls rediscovering a figure we already have.
 *
 * More than one row can come back — exclusives share codes (ADR-006) — which is why this
 * returns a list and `chooseScanTarget()` decides which one the confirm step opens.
 */
export function findFiguresByUpc(forms: readonly string[]): Promise<AdminCatalogFigure[]> {
  if (forms.length === 0) return Promise.resolve([]);

  return db
    .select(adminCatalogColumns)
    .from(catalogWithOwnership)
    .where(inArray(catalogWithOwnership.upc, [...forms]))
    .orderBy(asc(catalogWithOwnership.popNumber), asc(catalogWithOwnership.name))
    .limit(SEARCH_RESULT_LIMIT);
}

/**
 * The barcode a catalog row already knows, straight off the table.
 *
 * Read from `reference_figures` rather than from the ownership view because this is the
 * input to a WRITE decision (`decideUpcBackfill`): the view is a join that could in
 * principle be replaced, and "what is in the column right now" is a question only the
 * column can answer.
 */
export async function getReferenceUpc(id: string): Promise<string | null> {
  const [row] = await db
    .select({ upc: referenceFigures.upc })
    .from(referenceFigures)
    .where(eq(referenceFigures.id, id))
    .limit(1);

  return row?.upc ?? null;
}

/** Wide enough to hold every row that shares a number; `variantSiblings()` does the deciding. */
const VARIANT_CANDIDATE_LIMIT = 40;

/**
 * The rows the confirm step might offer as "or one of these".
 *
 * Two cheap SQL predicates cast the net — same box number, or the same name prefix inside the
 * same product line — and the pure `variantSiblings()` decides which of them actually is a
 * variant. The split matters: the rule is a product decision that gets argued about, and
 * arguing about it in a unit test is cheaper than arguing about it in SQL.
 */
export function listVariantCandidates(
  figure: Pick<AdminCatalogFigure, "popNumber" | "productLine" | "name">,
): Promise<AdminCatalogFigure[]> {
  const conditions: SQL[] = [];

  if (figure.popNumber !== null) {
    conditions.push(eq(catalogWithOwnership.popNumber, figure.popNumber));
  }

  // `%` and `_` stripped rather than escaped: no Funko name carries them, and a stripped
  // prefix can only widen the candidate net, which `variantSiblings()` narrows again.
  const prefix = variantNamePrefix(figure.name).replace(/[%_\\]/g, "");
  if (figure.productLine !== null && prefix.length > 0) {
    conditions.push(
      and(
        eq(catalogWithOwnership.productLine, figure.productLine),
        ilike(catalogWithOwnership.name, `${prefix}%`),
      ) as SQL,
    );
  }

  if (conditions.length === 0) return Promise.resolve([]);

  return db
    .select(adminCatalogColumns)
    .from(catalogWithOwnership)
    .where(conditions.length === 1 ? conditions[0] : (or(...conditions) as SQL))
    .orderBy(asc(catalogWithOwnership.popNumber), asc(catalogWithOwnership.name))
    .limit(VARIANT_CANDIDATE_LIMIT);
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
  /** The "write it later" queue flag — `true` means this sighting has no story yet. */
  needsStory: boolean | null;
  quantity: number | null;
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
  needsStory: ownedFigures.needsStory,
  quantity: ownedFigures.quantity,
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
 * Every shelf row holding one catalog figure — the duplicate guard's input.
 *
 * All statuses come back, not just `mine`: telling "he owns this" apart from "he had this
 * once" is `findOwnedDuplicate()`'s job, and a query that pre-filtered would hide the
 * distinction from the test that checks it.
 */
export function listOwnedCopies(referenceFigureId: string): Promise<OwnedCopy[]> {
  return db
    .select({
      id: ownedFigures.id,
      status: sql<OwnedStatus | null>`${ownedFigures.status}`,
      acquiredAt: ownedFigures.acquiredAt,
      quantity: ownedFigures.quantity,
      needsStory: ownedFigures.needsStory,
    })
    .from(ownedFigures)
    .where(eq(ownedFigures.referenceFigureId, referenceFigureId))
    .orderBy(asc(ownedFigures.acquiredAt));
}

/**
 * Every catalog slug that starts with `prefix` — the input to `catalogSlug()`'s dedup ladder
 * when step 1b invents a row. Scoped by prefix rather than fetching all 247: the ladder only
 * ever appends to the base, so a slug that does not start with it can never collide.
 */
export async function listTakenSlugs(prefix: string): Promise<Set<string>> {
  if (prefix.length === 0) return new Set();

  const rows = await db
    .select({ slug: referenceFigures.slug })
    .from(referenceFigures)
    .where(ilike(referenceFigures.slug, `${prefix.replace(/[%_\\]/g, "")}%`));

  return new Set(rows.map((row) => row.slug));
}

/** How far back the details step looks for a place to prefill. */
const RECENT_PLACE_LIMIT = 5;

/**
 * The last few places a figure was picked up, newest first — `lastUsedPlace()` picks one.
 *
 * `nulls last` is written out: Postgres sorts NULLs FIRST on a descending order, so a row
 * with no date would otherwise be "the most recent" and the whole trick would prefill the
 * wrong city.
 */
export function listRecentPlaces(limit: number = RECENT_PLACE_LIMIT): Promise<SightingPlace[]> {
  return db
    .select({
      city: ownedFigures.acquiredCity,
      country: ownedFigures.acquiredCountry,
    })
    .from(ownedFigures)
    .orderBy(sql`${ownedFigures.acquiredAt} desc nulls last`, desc(ownedFigures.createdAt))
    .limit(limit);
}

/** How many sightings are still waiting for their story. */
export async function countStoriesOwed(): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(ownedFigures)
    .where(eq(ownedFigures.needsStory, true));

  return row?.count ?? 0;
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
