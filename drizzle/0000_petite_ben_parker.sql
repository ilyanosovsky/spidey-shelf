CREATE TABLE "owned_figures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference_figure_id" uuid,
	"custom_name" text,
	"custom_number" integer,
	"status" text,
	"quantity" integer DEFAULT 1,
	"is_public" boolean DEFAULT true,
	"is_favorite" boolean DEFAULT false,
	"acquired_at" date,
	"acquired_city" text,
	"acquired_country" varchar(2),
	"acquired_lat" numeric,
	"acquired_lng" numeric,
	"acquisition_type" text,
	"gifted_by" text,
	"story_title" text,
	"story" text,
	"needs_story" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reference_figures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"pop_number" integer,
	"name" text NOT NULL,
	"character" text,
	"product_line" text,
	"release_year" integer,
	"exclusivity" text,
	"variant_flags" text[],
	"is_vaulted" boolean,
	"upc" text,
	"image_path" text,
	"counts_toward_total" boolean DEFAULT true,
	"source" text,
	"source_url" text,
	"needs_review" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reference_figures_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "owned_figures" ADD CONSTRAINT "owned_figures_reference_figure_id_reference_figures_id_fk" FOREIGN KEY ("reference_figure_id") REFERENCES "public"."reference_figures"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "owned_figures_reference_figure_id_idx" ON "owned_figures" USING btree ("reference_figure_id");--> statement-breakpoint
CREATE INDEX "owned_figures_created_at_idx" ON "owned_figures" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "reference_figures_pop_number_idx" ON "reference_figures" USING btree ("pop_number");--> statement-breakpoint
CREATE INDEX "reference_figures_upc_idx" ON "reference_figures" USING btree ("upc");