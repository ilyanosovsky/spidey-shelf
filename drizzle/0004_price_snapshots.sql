CREATE TABLE "price_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference_figure_id" uuid NOT NULL,
	"currency" varchar(3) NOT NULL,
	"min_cents" integer,
	"median_cents" integer,
	"listing_count" integer DEFAULT 0 NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "price_snapshots_reference_figure_id_unique" UNIQUE("reference_figure_id")
);
--> statement-breakpoint
ALTER TABLE "price_snapshots" ADD CONSTRAINT "price_snapshots_reference_figure_id_reference_figures_id_fk" FOREIGN KEY ("reference_figure_id") REFERENCES "public"."reference_figures"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "price_snapshots_fetched_at_idx" ON "price_snapshots" USING btree ("fetched_at");