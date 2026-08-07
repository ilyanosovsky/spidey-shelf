import "server-only";

import { geocodeCity } from "./lookup";
import { listKnownCityCoordinates } from "./queries";
import { coordinateColumns, resolveCityCoordinate, type CoordinateColumns } from "./resolve";

/**
 * The one function the write path calls: "where is this, in two columns".
 *
 * **`server-only` lives here rather than on `./lookup.ts`**, and that is the boundary that
 * matters — this is the module the server actions import, it reads the database, and nothing
 * client-side may reach it. The socket module underneath stays unmarked so
 * `scripts/backfill-geocode.ts` can reuse it under `tsx`, where the marker package throws by
 * design (see the note in `./lookup.ts`).
 *
 * Called from exactly two places, both of them writes: Quick Add's details submit
 * (`src/app/admin/add/actions.ts`) and the collection edit submit
 * (`src/app/admin/collection/actions.ts`). **A page never calls this.** The SIGHTINGS MAP is
 * rendered from columns that were filled in when the row was written, so a visitor's request
 * cannot cost OpenStreetMap anything — which is half of what makes the usage policy in
 * `./nominatim.ts` satisfiable at all (ADR-012).
 */
export async function resolveAcquiredCoordinate(
  country: string | null | undefined,
  city: string | null | undefined,
): Promise<CoordinateColumns> {
  try {
    const known = await listKnownCityCoordinates();
    return coordinateColumns(await resolveCityCoordinate(country, city, known, geocodeCity));
  } catch {
    // The read of the known places is the only thing here that can still throw, and a
    // database hiccup while looking up a convenience must not cost the owner the sighting he
    // is in the middle of saving. Two NULLs is the answer every row had before Phase 13.
    return coordinateColumns(null);
  }
}
