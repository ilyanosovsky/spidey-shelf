/**
 * Fills `owned_figures.acquired_lat` / `acquired_lng` for rows written before Phase 13.
 *
 *   npm run geo:backfill -- --dry-run     # say what it would do, touch nothing
 *   npm run geo:backfill                  # do it
 *
 * The one-time counterpart to the write path (ADR-012): from Phase 13 on, a sighting is
 * geocoded when it is SAVED, so this exists for the rows that predate that — and for any row
 * whose lookup failed at the time, since a failure writes nothing down and is therefore a
 * retry rather than a state. It is safe to run repeatedly: a row that already has a
 * coordinate is never selected again, so a second run does nothing and says so.
 *
 * **What it deliberately does NOT do: backfill the founding nine cities.** Haifa, Munich,
 * Tbilisi, Batumi, Moscow, LA, Madrid, Mallorca and Amsterdam are placed by the hand-checked
 * dictionary in `src/lib/geo.ts`, the map reads `column ?? dictionary`, and asking a gazetteer
 * to re-derive nine coordinates a human already verified would spend nine requests to move
 * some of them by a few hundred metres. Those rows stay NULL on purpose.
 *
 * **The OSM Foundation's usage policy is the budget**
 * (<https://operations.osmfoundation.org/policies/nominatim/>). This script honours it by
 * construction: one request per distinct city rather than per row, at most one request per
 * second, one attempt each, the identifying User-Agent from `src/lib/geocode/nominatim.ts`,
 * and a city resolved earlier in the same run is reused rather than asked about twice.
 *
 * Reads DATABASE_URL from the environment, falling back to `.env`, and never prints it.
 */

import path from "node:path";

import { and, eq, isNull, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { ownedFigures } from "../src/db/schema";
import { cityKey, lookupCity } from "../src/lib/geo";
import { geocodeCity } from "../src/lib/geocode/lookup";
import {
  coordinateColumns,
  knownCityCoordinate,
  type KnownPlace,
} from "../src/lib/geocode/resolve";

/** The policy's hard ceiling is one request per second; a little over it is politeness. */
const REQUEST_SPACING_MS = 1100;

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

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  const client = postgres(loadDatabaseUrl(process.cwd()), { max: 1, prepare: false });
  const db = drizzle(client);

  try {
    // Every place the shelf can already point at — the same question the write path asks,
    // so a city one row learned about is free for every other row that shares it.
    const known: KnownPlace[] = await db
      .selectDistinct({
        country: ownedFigures.acquiredCountry,
        city: ownedFigures.acquiredCity,
        lat: ownedFigures.acquiredLat,
        lng: ownedFigures.acquiredLng,
      })
      .from(ownedFigures);

    const pending = await db
      .select({
        id: ownedFigures.id,
        city: ownedFigures.acquiredCity,
        country: ownedFigures.acquiredCountry,
      })
      .from(ownedFigures)
      .where(or(isNull(ownedFigures.acquiredLat), isNull(ownedFigures.acquiredLng)));

    // One entry per city, not per row: `(country, city)` folded through the map's own
    // normaliser, which is what makes `Munich` and `München` a single request.
    const cities = new Map<string, { city: string; country: string; ids: string[] }>();
    let skippedNoPlace = 0;

    for (const row of pending) {
      const key = cityKey(row.country, row.city);
      if (key === "") {
        skippedNoPlace += 1;
        continue;
      }
      const bucket = cities.get(key);
      if (bucket) bucket.ids.push(row.id);
      else
        cities.set(key, {
          city: (row.city ?? "").trim(),
          country: (row.country ?? "").trim().toUpperCase(),
          ids: [row.id],
        });
    }

    console.log(
      `${pending.length} rows without coordinates · ${cities.size} distinct cities · ` +
        `${skippedNoPlace} with no place at all${dryRun ? " · DRY RUN" : ""}`,
    );

    const resolved: KnownPlace[] = [...known];
    let requests = 0;
    let updatedRows = 0;

    for (const [key, place] of cities) {
      if (lookupCity(place.country, place.city) !== null) {
        console.log(`  ${key} — in the dictionary, left NULL on purpose`);
        continue;
      }

      let coordinate = knownCityCoordinate(place.country, place.city, resolved);
      let source = "a row that already knows it";

      if (coordinate === null) {
        // The one request. Spaced, so a shelf with several new cities cannot burst.
        if (requests > 0) await wait(REQUEST_SPACING_MS);
        requests += 1;
        coordinate = await geocodeCity(place.country.toLowerCase(), place.city);
        source = "nominatim";
      }

      if (coordinate === null) {
        console.log(`  ${key} — NOT FOUND, left NULL (the next edit of the row will retry)`);
        continue;
      }

      const columns = coordinateColumns(coordinate);
      console.log(
        `  ${key} — ${columns.acquiredLat}, ${columns.acquiredLng} (${source}) → ` +
          `${place.ids.length} row(s)`,
      );

      resolved.push({ ...place, lat: columns.acquiredLat, lng: columns.acquiredLng });
      if (dryRun) continue;

      for (const id of place.ids) {
        await db
          .update(ownedFigures)
          .set({ ...columns, updatedAt: new Date() })
          .where(and(eq(ownedFigures.id, id), isNull(ownedFigures.acquiredLat)));
        updatedRows += 1;
      }
    }

    const [remaining] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(ownedFigures)
      .where(isNull(ownedFigures.acquiredLat));

    console.log(
      `${dryRun ? "Would update" : "Updated"} ${updatedRows} row(s) · ${requests} Nominatim ` +
        `request(s) · ${remaining?.count ?? 0} row(s) still without a coordinate ` +
        `(the dictionary places most of them)`,
    );
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
