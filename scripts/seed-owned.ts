/**
 * Seeds `owned_figures` from data/collection/owned.csv — the owner's 19 figures.
 *
 *   npm run db:seed:owned
 *
 * Run it AFTER `npm run db:seed`: every row must resolve to a `reference_figures` row (the
 * 7 non-Spider-Man figures live in `data/catalog/others-manual.csv`), and the script hard
 * fails, listing the misses, rather than writing a shelf with dangling names.
 *
 * Idempotent by a deterministic match: one shelf row is identified by
 * `(reference_figure_id, acquired_at)`. Re-running updates those rows in place instead of
 * inserting duplicates. It never deletes — rows added through the admin UI are untouched,
 * and dropping a line from the CSV leaves the figure (and its story) in the database.
 *
 * `acquisition_type` is deliberately left NULL: the Notion export does not say whether a
 * figure was bought or gifted, and inventing "bought" would be a lie in the data.
 *
 * Reads DATABASE_URL from the environment, falling back to `.env`, and never prints it.
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { and, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { ownedFigures, referenceFigures } from "../src/db/schema";
import {
  OWNED_CSV_PATH,
  parseOwnedCsv,
  resolveOwnedRows,
  type ReferenceCandidate,
} from "../src/lib/collection";

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

async function main(): Promise<void> {
  // `npm run db:seed:owned` always runs with the package root as cwd.
  const repoRoot = process.cwd();
  const csvPath = path.join(repoRoot, OWNED_CSV_PATH);
  if (!existsSync(csvPath)) {
    throw new Error(
      `${OWNED_CSV_PATH} not found — run this from the repo root (npm run db:seed:owned).`,
    );
  }

  const rows = parseOwnedCsv(readFileSync(csvPath, "utf8"));
  console.log(`Parsed ${rows.length} collection rows from ${OWNED_CSV_PATH}`);

  const client = postgres(loadDatabaseUrl(repoRoot), { max: 1, prepare: false });
  const db = drizzle(client);

  try {
    const references: ReferenceCandidate[] = await db
      .select({
        id: referenceFigures.id,
        popNumber: referenceFigures.popNumber,
        name: referenceFigures.name,
      })
      .from(referenceFigures);

    const { matches, misses } = resolveOwnedRows(rows, references);

    if (misses.length > 0) {
      const detail = misses.map((miss) => `  line ${miss.row.line}: ${miss.reason}`).join("\n");
      throw new Error(
        `${misses.length} of ${rows.length} collection rows do not resolve to a catalog figure.\n` +
          `Run \`npm run db:seed\` first, or add the figure to data/catalog/others-manual.csv.\n${detail}`,
      );
    }

    let inserted = 0;
    let updated = 0;

    await db.transaction(async (tx) => {
      for (const match of matches) {
        const values = {
          referenceFigureId: match.reference.id,
          status: match.row.status,
          isPublic: true,
          acquiredAt: match.row.acquiredAt,
          acquiredCity: match.row.acquiredCity,
          acquiredCountry: match.row.acquiredCountry,
        };

        // The deterministic identity of a shelf row: this figure, acquired on this day.
        const existing = await tx
          .select({ id: ownedFigures.id })
          .from(ownedFigures)
          .where(
            and(
              eq(ownedFigures.referenceFigureId, match.reference.id),
              eq(ownedFigures.acquiredAt, match.row.acquiredAt),
            ),
          )
          .limit(1);

        if (existing.length > 0) {
          await tx
            .update(ownedFigures)
            .set({ ...values, updatedAt: sql`now()` })
            .where(eq(ownedFigures.id, existing[0].id));
          updated += 1;
        } else {
          await tx.insert(ownedFigures).values(values);
          inserted += 1;
        }
      }
    });

    const [totals] = await db
      .select({
        total: sql<number>`count(*)::int`,
        mine: sql<number>`(count(*) filter (where ${ownedFigures.status} = 'mine'))::int`,
        notMineAnymore: sql<number>`(count(*) filter (where ${ownedFigures.status} = 'not_mine_anymore'))::int`,
        unlinked: sql<number>`(count(*) filter (where ${ownedFigures.referenceFigureId} is null))::int`,
      })
      .from(ownedFigures);

    console.log(`Seeded: ${inserted} inserted, ${updated} updated`);
    console.log(
      `owned_figures: ${totals.total} rows · ${totals.mine} mine · ${totals.notMineAnymore} not mine anymore · ${totals.unlinked} without a catalog row`,
    );
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
