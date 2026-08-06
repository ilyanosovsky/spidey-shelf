/**
 * Seeds `reference_figures` from every CSV in data/catalog/.
 *
 *   npm run db:seed
 *
 * Two files today: `spiderman.csv` (the 240-row curated Spider-Man catalog, ADR-008) and
 * `others-manual.csv` (the non-Spider-Man figures the owner actually owns, so his shelf can
 * point at a real catalog row). They are parsed as one catalog with one slug namespace, in
 * the order of `CATALOG_CSV_PATHS`, so the Spider-Man rows keep the slugs they were seeded
 * with in Phase 2.
 *
 * Idempotent by construction: every row is upserted on its `slug` (the natural key), so
 * running it twice changes nothing but `updated_at`. It never deletes — a figure dropped
 * from the CSV stays in the database, because `owned_figures` may point at it.
 *
 * Columns the CSV does not own are never touched on update: `image_path`, `upc` and
 * `is_vaulted` are filled in by later phases and must survive a re-seed. `image_path`
 * stays NULL for now — box art is blocked on image rights (ADR-004/ADR-008), Phase 4
 * renders pixel-art placeholders instead.
 *
 * Reads DATABASE_URL from the environment, falling back to `.env`, and never prints it.
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { referenceFigures } from "../src/db/schema";
import { FIGURE_CATEGORIES } from "../src/lib/categories";
import { CATALOG_CSV_PATHS, parseCatalogCsvFiles, type CatalogSeedRow } from "../src/lib/catalog";

/** postgres.js has no statement-size problem here, but small batches keep errors readable. */
const CHUNK_SIZE = 50;

function loadDatabaseUrl(repoRoot: string): string {
  if (!process.env.DATABASE_URL) {
    try {
      process.loadEnvFile(path.join(repoRoot, ".env"));
    } catch {
      // No .env — the environment is expected to carry DATABASE_URL itself.
    }
  }
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set — see docs/wiki/Environment.md.");
  }
  return url;
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

async function main(): Promise<void> {
  // `npm run db:seed` always runs with the package root as cwd.
  const repoRoot = process.cwd();
  const files = CATALOG_CSV_PATHS.map((csvPath) => {
    const absolute = path.join(repoRoot, csvPath);
    if (!existsSync(absolute)) {
      throw new Error(`${csvPath} not found — run this from the repo root (npm run db:seed).`);
    }
    return { path: csvPath, text: readFileSync(absolute, "utf8") };
  });

  const rows: CatalogSeedRow[] = parseCatalogCsvFiles(files);

  console.log(`Parsed ${rows.length} catalog rows from ${CATALOG_CSV_PATHS.join(", ")}`);

  const client = postgres(loadDatabaseUrl(repoRoot), { max: 1, prepare: false });
  const db = drizzle(client);

  try {
    let inserted = 0;
    let updated = 0;

    await db.transaction(async (tx) => {
      for (const batch of chunk(rows, CHUNK_SIZE)) {
        const result = await tx
          .insert(referenceFigures)
          .values(batch)
          .onConflictDoUpdate({
            target: referenceFigures.slug,
            set: {
              popNumber: sql`excluded.pop_number`,
              name: sql`excluded.name`,
              character: sql`excluded.character`,
              category: sql`excluded.category`,
              productLine: sql`excluded.product_line`,
              releaseYear: sql`excluded.release_year`,
              exclusivity: sql`excluded.exclusivity`,
              variantFlags: sql`excluded.variant_flags`,
              countsTowardTotal: sql`excluded.counts_toward_total`,
              source: sql`excluded.source`,
              sourceUrl: sql`excluded.source_url`,
              needsReview: sql`excluded.needs_review`,
              updatedAt: sql`now()`,
            },
          })
          // `xmax = 0` is true only for a freshly inserted tuple — the cheapest honest way
          // to tell an insert from an update in a single upsert statement.
          .returning({ isInsert: sql<boolean>`(xmax = 0)` });

        for (const row of result) {
          if (row.isInsert) inserted += 1;
          else updated += 1;
        }
      }
    });

    const [totals] = await db
      .select({
        total: sql<number>`count(*)::int`,
        countsTowardTotal: sql<number>`(count(*) filter (where ${referenceFigures.countsTowardTotal}))::int`,
        needsReview: sql<number>`(count(*) filter (where ${referenceFigures.needsReview}))::int`,
      })
      .from(referenceFigures);

    const byCategory = await db
      .select({
        category: referenceFigures.category,
        count: sql<number>`count(*)::int`,
      })
      .from(referenceFigures)
      .groupBy(referenceFigures.category);

    const counts = new Map(byCategory.map((row) => [row.category, row.count]));

    console.log(`Upserted: ${inserted} inserted, ${updated} updated`);
    console.log(
      `reference_figures: ${totals.total} rows · ${totals.countsTowardTotal} count toward the total · ${totals.needsReview} need review`,
    );
    console.log(
      `categories: ${FIGURE_CATEGORIES.map(
        (category) => `${category} ${counts.get(category) ?? 0}`,
      ).join(" · ")}`,
    );
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
