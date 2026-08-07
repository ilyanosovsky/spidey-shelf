import "server-only";

import { and, isNotNull } from "drizzle-orm";

import { db } from "@/db";
import { ownedFigures } from "@/db/schema";

import { type KnownPlace } from "./resolve";

/**
 * Every place the shelf can already point at — step 2 of the skip logic.
 *
 * DISTINCT in SQL, and tiny by construction: it is one row per (city, country, coordinate)
 * among the rows that HAVE a coordinate, which is at most the number of cities the collection
 * has ever visited. Ten today. That is why the "has anybody been here before?" question is
 * answered in TypeScript by `knownCityCoordinate()` rather than by a `lower(city) = lower($1)`
 * predicate: the map's own normaliser folds accents and apostrophes (`München` = `Munich`),
 * and re-implementing it in SQL would be two spellings of one rule that could drift apart.
 *
 * `is not null` on both halves rather than on one: a row carrying half a coordinate is
 * meaningless, and `storedCoordinate()` would reject it downstream anyway.
 */
export function listKnownCityCoordinates(): Promise<KnownPlace[]> {
  return db
    .selectDistinct({
      country: ownedFigures.acquiredCountry,
      city: ownedFigures.acquiredCity,
      lat: ownedFigures.acquiredLat,
      lng: ownedFigures.acquiredLng,
    })
    .from(ownedFigures)
    .where(and(isNotNull(ownedFigures.acquiredLat), isNotNull(ownedFigures.acquiredLng)));
}
