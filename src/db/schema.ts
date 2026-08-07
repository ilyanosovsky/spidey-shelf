import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  numeric,
  pgTable,
  pgView,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

// Relative, not `@/` — drizzle-kit and the seed scripts load this file outside the Next.js
// module resolver, where the path alias is not guaranteed to exist.
import { DEFAULT_FIGURE_CATEGORY, FIGURE_CATEGORIES, type FigureCategory } from "../lib/categories";

/**
 * Schema for docs/wiki/Data-Model.md.
 *
 * Ground rule: `pop_number` is NOT unique — Funko reuses numbers across product lines and
 * variants (chase / GITD / metallic) share the base number. `slug` is the natural key.
 *
 * Three things live in hand-written SQL instead of this file because drizzle-kit cannot
 * model them (see drizzle/0001_search_vector_and_view.sql):
 *   1. `reference_figures.search_vector` — a STORED GENERATED tsvector over
 *      name + character + product_line, with a GIN index.
 *   2. the `gin_trgm_ops` index on `reference_figures.name` (fuzzy search, needs pg_trgm).
 *   3. the `catalog_with_ownership` view (declared below with `.existing()` so Drizzle can
 *      query it in a typed way without trying to own its DDL). Every change to its column
 *      list needs a hand-written `CREATE OR REPLACE VIEW` — see
 *      drizzle/0002_category_taxonomy.sql, which added `category` to it.
 *
 * Because of that, migrations MUST go through `npm run db:generate` + `npm run db:migrate`.
 * Never `drizzle-kit push` against this database — push diffs the live database against
 * this file and would happily drop the generated column, the trigram index and the view.
 */

/** Catalog of every Funko that exists — the denominator of the collection. */
export const referenceFigures = pgTable(
  "reference_figures",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    /** Natural key, e.g. `marvel-spider-man-last-stand-1450`. See src/lib/slug.ts. */
    slug: text("slug").notNull().unique(),
    /** NOT unique on purpose — numbers repeat across lines and variants. */
    popNumber: integer("pop_number"),
    name: text("name").notNull(),
    /** Spider-Man / Miles Morales / Spider-Gwen … (reserved word in SQL, always quoted). */
    character: text("character"),
    /**
     * Taxonomy bucket — `peter` / `spider_verse` / `friends_foes` / `other` (ADR-009).
     * Invariant enforced by the seed: `counts_toward_total` ⇔ `category = 'peter'`.
     */
    category: text("category").$type<FigureCategory>().notNull().default(DEFAULT_FIGURE_CATEGORY),
    /** e.g. `Pop! Marvel: No Way Home`. */
    productLine: text("product_line"),
    releaseYear: integer("release_year"),
    /** Common / Walgreens / SDCC … */
    exclusivity: text("exclusivity"),
    /** chase, glow, metallic, flocked, 10inch … */
    variantFlags: text("variant_flags").array(),
    isVaulted: boolean("is_vaulted"),
    /** Scanner target. Exclusives may share a UPC — always confirm the variant. */
    upc: text("upc"),
    /** Normalized 800×800 WebP in the bucket. */
    imagePath: text("image_path"),
    /** THE stats denominator switch. */
    countsTowardTotal: boolean("counts_toward_total").default(true),
    source: text("source"),
    sourceUrl: text("source_url"),
    /** Seed triage flag — never exposed on public pages. */
    needsReview: boolean("needs_review").default(false),
    /**
     * WHY the row is flagged, when a machine flagged it (Phase 7).
     *
     * A scan that reads a barcode onto a row already carrying a different one must not
     * overwrite it — exclusives share UPCs (ADR-006) — so it flags the row instead, and a
     * flag with no reason is a flag nobody can act on. Admin-only, like `needs_review`.
     */
    reviewNote: text("review_note"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("reference_figures_pop_number_idx").on(table.popNumber),
    index("reference_figures_upc_idx").on(table.upc),
    index("reference_figures_category_idx").on(table.category),
    // A text column with a CHECK instead of a pg enum: adding a fifth bucket later is an
    // ALTER of one constraint, not an irreversible type change.
    // `sql.raw` on purpose: a template value would become a bind parameter, and drizzle-kit
    // would emit `CHECK (category in ($1, $2, …))` into the migration file.
    check(
      "reference_figures_category_check",
      sql`${table.category} in (${sql.raw(FIGURE_CATEGORIES.map((value) => `'${value}'`).join(", "))})`,
    ),
  ],
);

/** The collection itself plus the acquisition story behind each figure. */
export const ownedFigures = pgTable(
  "owned_figures",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    /** Nullable: a figure can be owned before it is catalogued. */
    referenceFigureId: uuid("reference_figure_id").references(() => referenceFigures.id, {
      onDelete: "set null",
    }),
    /** Used only while `reference_figure_id` is null. */
    customName: text("custom_name"),
    customNumber: integer("custom_number"),
    /** `mine` / `not_mine_anymore` (Notion semantics). */
    status: text("status"),
    quantity: integer("quantity").default(1),
    /** Staging switch — lets the owner enter a figure before revealing it publicly. */
    isPublic: boolean("is_public").default(true),
    isFavorite: boolean("is_favorite").default(false),
    acquiredAt: date("acquired_at"),
    acquiredCity: text("acquired_city"),
    /** ISO 3166-1 alpha-2. */
    acquiredCountry: varchar("acquired_country", { length: 2 }),
    acquiredLat: numeric("acquired_lat"),
    acquiredLng: numeric("acquired_lng"),
    /** bought / gift / trade */
    acquisitionType: text("acquisition_type"),
    giftedBy: text("gifted_by"),
    storyTitle: text("story_title"),
    /** Markdown. */
    story: text("story"),
    /** "write it later" queue. */
    needsStory: boolean("needs_story").default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("owned_figures_reference_figure_id_idx").on(table.referenceFigureId),
    index("owned_figures_created_at_idx").on(table.createdAt),
  ],
);

/**
 * `reference_figures LEFT JOIN owned_figures` → `is_owned`, `owned_count`.
 *
 * One definition powers the public OWNED / NOT OWNED verdict, the stats counters and the
 * wishlist (its NULL rows ARE the wishlist). Created in SQL, declared here as `.existing()`.
 */
export const catalogWithOwnership = pgView("catalog_with_ownership", {
  id: uuid("id").notNull(),
  slug: text("slug").notNull(),
  popNumber: integer("pop_number"),
  name: text("name").notNull(),
  character: text("character"),
  category: text("category").$type<FigureCategory>().notNull(),
  productLine: text("product_line"),
  releaseYear: integer("release_year"),
  exclusivity: text("exclusivity"),
  variantFlags: text("variant_flags").array(),
  isVaulted: boolean("is_vaulted"),
  upc: text("upc"),
  imagePath: text("image_path"),
  countsTowardTotal: boolean("counts_toward_total"),
  source: text("source"),
  sourceUrl: text("source_url"),
  needsReview: boolean("needs_review"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  isOwned: boolean("is_owned").notNull(),
  ownedCount: integer("owned_count").notNull(),
  /** When the first copy was added to the site — drives the "new sightings" ribbon. */
  firstOwnedAt: timestamp("first_owned_at", { withTimezone: true }),
}).existing();

export type ReferenceFigure = typeof referenceFigures.$inferSelect;
export type NewReferenceFigure = typeof referenceFigures.$inferInsert;
export type OwnedFigure = typeof ownedFigures.$inferSelect;
export type NewOwnedFigure = typeof ownedFigures.$inferInsert;
export type CatalogRow = typeof catalogWithOwnership.$inferSelect;
