-- Custom migration: everything drizzle-kit cannot model.
-- Keep this file hand-written; `db:generate` never touches it.

-- Trigram matching for fuzzy name search ("spidy" → "Spider-Man").
CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint

-- Full-text search column. STORED GENERATED so it is always in sync with the row and
-- costs nothing at query time. Weights: name (A) beats character (B) beats line (C).
ALTER TABLE "reference_figures"
  ADD COLUMN "search_vector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce("name", '')), 'A') ||
    setweight(to_tsvector('simple', coalesce("character", '')), 'B') ||
    setweight(to_tsvector('simple', coalesce("product_line", '')), 'C')
  ) STORED;
--> statement-breakpoint

CREATE INDEX "reference_figures_search_vector_idx"
  ON "reference_figures" USING gin ("search_vector");
--> statement-breakpoint

CREATE INDEX "reference_figures_name_trgm_idx"
  ON "reference_figures" USING gin ("name" gin_trgm_ops);
--> statement-breakpoint

-- One definition behind the public OWNED / NOT OWNED verdict, the stats counters and the
-- wishlist (the rows where is_owned = false ARE the wishlist).
-- `not_mine_anymore` rows do not count as owned; rows with a NULL status still do, so a
-- half-filled quick-add never silently disappears from the collection.
CREATE OR REPLACE VIEW "catalog_with_ownership" AS
SELECT
  r."id",
  r."slug",
  r."pop_number",
  r."name",
  r."character",
  r."product_line",
  r."release_year",
  r."exclusivity",
  r."variant_flags",
  r."is_vaulted",
  r."upc",
  r."image_path",
  r."counts_toward_total",
  r."source",
  r."source_url",
  r."needs_review",
  r."created_at",
  r."updated_at",
  COALESCE(o."owned_count", 0) > 0 AS "is_owned",
  COALESCE(o."owned_count", 0)::int AS "owned_count",
  o."first_owned_at"
FROM "reference_figures" r
LEFT JOIN (
  SELECT
    "reference_figure_id",
    SUM(COALESCE("quantity", 1))::int AS "owned_count",
    MIN("created_at") AS "first_owned_at"
  FROM "owned_figures"
  WHERE "reference_figure_id" IS NOT NULL
    AND "status" IS DISTINCT FROM 'not_mine_anymore'
  GROUP BY "reference_figure_id"
) o ON o."reference_figure_id" = r."id";
