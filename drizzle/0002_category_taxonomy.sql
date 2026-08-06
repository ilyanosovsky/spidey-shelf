ALTER TABLE "reference_figures" ADD COLUMN "category" text DEFAULT 'other' NOT NULL;--> statement-breakpoint
CREATE INDEX "reference_figures_category_idx" ON "reference_figures" USING btree ("category");--> statement-breakpoint
ALTER TABLE "reference_figures" ADD CONSTRAINT "reference_figures_category_check" CHECK ("reference_figures"."category" in ('peter', 'spider_verse', 'friends_foes', 'other'));--> statement-breakpoint

-- Hand-added below this line (drizzle-kit does not own the view — see src/db/schema.ts).
-- The view must expose `category` so the public tabs and the admin list can filter on it
-- without a second join. `CREATE OR REPLACE VIEW` may only append columns at the end, and
-- `category` belongs next to `character`, so the view is dropped and rebuilt. Nothing else
-- depends on it (no materialized view, no grants beyond the owner role).
DROP VIEW IF EXISTS "catalog_with_ownership";--> statement-breakpoint

CREATE VIEW "catalog_with_ownership" AS
SELECT
  r."id",
  r."slug",
  r."pop_number",
  r."name",
  r."character",
  r."category",
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
