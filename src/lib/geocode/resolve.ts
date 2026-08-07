import { cityKey, lookupCity, storedCoordinate, type Coordinate } from "../geo";

/**
 * WHEN a sighting is geocoded — which is almost never, and that is the whole design.
 *
 * Pure and unit-tested, with the network call injected, so "does this reach OpenStreetMap?"
 * is a question a test can answer with a spy instead of a socket. The order below is the
 * budget promised in ADR-012 and in the Nominatim policy note in `./nominatim.ts`:
 *
 *   1. **the dictionary** (`src/lib/geo.ts`) — the nine founding cities, hand-checked in
 *      Phase 8. Zero network calls, and it stays first so a Haifa sighting can never be
 *      re-derived from somebody else's database;
 *   2. **a row already on the shelf** with the same country + city — the same normaliser the
 *      map keys markers by, so `Munich` and `München` are one place. Zero network calls;
 *   3. **one request**, and only then.
 *
 * So the cost is one request per NEW city over the lifetime of the collection — the second
 * figure from Kuala Lumpur is free, because the first one wrote the answer down.
 */

/** A row that may already know where a city is: the shape `listKnownCityCoordinates()` returns. */
export interface KnownPlace {
  country: string | null;
  city: string | null;
  /** `numeric` columns — Drizzle hands them back as strings. */
  lat: string | number | null;
  lng: string | number | null;
}

/** The injected step 3. Never throws in production (`./lookup.ts`); guarded here anyway. */
export type CityGeocoder = (country: string, city: string) => Promise<Coordinate | null>;

/**
 * Steps 1 and 2 — everything that can be answered without asking anybody.
 *
 * Exported because the backfill script needs exactly this question ("is this city already
 * placeable?") before it decides whether a row is worth a request.
 */
export function knownCityCoordinate(
  country: string | null | undefined,
  city: string | null | undefined,
  known: readonly KnownPlace[],
): Coordinate | null {
  const key = cityKey(country, city);
  if (key === "") return null;

  const dictionary = lookupCity(country, city);
  if (dictionary !== null) return dictionary;

  for (const place of known) {
    if (cityKey(place.country, place.city) !== key) continue;
    const coordinate = storedCoordinate(place.lat, place.lng);
    if (coordinate !== null) return coordinate;
  }

  return null;
}

/**
 * The coordinate to store with a sighting, or `null` — and `null` is a normal answer.
 *
 * **This never rejects.** It runs inside a server action with a figure and a story attached
 * to it, and the rule from ADR-012 is that a geocoder is an enrichment: a timeout, a 429 or
 * a town OpenStreetMap has never heard of leaves the row with NULL coordinates, exactly as
 * every row had before Phase 13, and the figure still lands on the shelf. The next edit of
 * that sighting tries again, for free, because a failed lookup wrote nothing down.
 *
 * A row with no city (or no country) never reaches the network at all: `city` alone is not a
 * question a geocoder can answer, and the map has always shown those as UNCHARTED.
 */
export async function resolveCityCoordinate(
  country: string | null | undefined,
  city: string | null | undefined,
  known: readonly KnownPlace[],
  geocode: CityGeocoder,
): Promise<Coordinate | null> {
  const key = cityKey(country, city);
  if (key === "") return null;

  const hit = knownCityCoordinate(country, city, known);
  if (hit !== null) return hit;

  try {
    // The country goes as the lowercase alpha-2 the key already normalised; the city goes as
    // the owner spelled it, because that is what a gazetteer is best at matching.
    return await geocode(key.split(":")[0], (city ?? "").trim());
  } catch {
    return null;
  }
}

/** The two columns a write sets, from a coordinate or from nothing. */
export interface CoordinateColumns {
  acquiredLat: string | null;
  acquiredLng: string | null;
}

/**
 * A coordinate as `numeric` column values.
 *
 * Strings rather than numbers because that is what Drizzle's `numeric` takes — Postgres'
 * arbitrary-precision type has no float to round through, and going via one would be the
 * bug the column type exists to prevent. Rounding already happened where it belongs: at the
 * geocoder's boundary (`roundToCityPrecision`), never to a dictionary value.
 */
export function coordinateColumns(coordinate: Coordinate | null): CoordinateColumns {
  if (coordinate === null) return { acquiredLat: null, acquiredLng: null };
  return { acquiredLat: String(coordinate.lat), acquiredLng: String(coordinate.lng) };
}
