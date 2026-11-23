ALTER TABLE "reference_figures" DROP CONSTRAINT "reference_figures_category_check";--> statement-breakpoint
ALTER TABLE "reference_figures" ADD CONSTRAINT "reference_figures_category_check" CHECK ("reference_figures"."category" in ('peter', 'spider_verse', 'friends_foes', 'stitch', 'grogu', 'other'));--> statement-breakpoint

-- Hand-added below this line: an idempotent data backfill for Phase 14 (Veronika joins the
-- shelf). Every statement only touches rows still in their pre-Phase-14 state, so running it
-- twice is a no-op.
--
-- 1–2. Move Veronika's two lines out of the `other` catch-all into their own buckets. Only
-- `other` rows are considered: a figure already filed as `peter`/`spider_verse`/… was put
-- there on purpose and is not second-guessed by a name match.
UPDATE reference_figures SET category = 'stitch', updated_at = now() WHERE category = 'other' AND (name ILIKE '%stitch%' OR "character" ILIKE '%stitch%' OR product_line ILIKE '%lilo & stitch%');--> statement-breakpoint
UPDATE reference_figures SET category = 'grogu', updated_at = now() WHERE category = 'other' AND (name ILIKE '%grogu%' OR "character" ILIKE '%grogu%');--> statement-breakpoint

-- 3. Hand Veronika her figures. Before the `veronika` status existed, her Stitches and Grogus
-- were entered as `not_mine_anymore` — the only way to say "on the shelf, but not Ilya's" —
-- so those rows in her two lines are rewritten to `veronika`. `mine` rows are deliberately
-- left alone: a Stitch logged as `mine` is the owner's own call and is not reassigned by a
-- guess. A row this gets wrong (a Stitch that really did leave the shelf) is one EDIT away
-- in /admin/collection.
UPDATE owned_figures SET status = 'veronika', updated_at = now() WHERE status = 'not_mine_anymore' AND reference_figure_id IN (SELECT id FROM reference_figures WHERE category IN ('stitch','grogu'));
