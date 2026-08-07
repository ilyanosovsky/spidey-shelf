import { isCoordinate, type Coordinate } from "../geo";

/**
 * Asking OpenStreetMap where a city is — the request, and what its answer means.
 *
 * Both halves are pure, exactly like `barcode/upcitemdb.ts`: the socket lives in
 * `./lookup.ts`, and everything that DECIDES anything is here, so the cases that matter (a
 * place, no such place, a rate limit, "the internet happened") are argued about in a unit
 * test rather than against a public service we are only entitled to call politely.
 *
 * **The usage policy is a contract, not a suggestion.**
 * <https://operations.osmfoundation.org/policies/nominatim/> — the service is run by the
 * OSM Foundation on donated hardware, and the terms it asks for are: a real identifying
 * `User-Agent` (a generic one is grounds for a block), an absolute maximum of one request
 * per second, no heavy or bulk use, and results cached rather than re-requested. This
 * project meets all four by construction rather than by discipline:
 *
 *   1. **At most one request per save**, and only for a city that is in neither the
 *      dictionary nor any row already on the shelf — so it is one request per NEW city, ever,
 *      not one per figure and never one per page view (ADR-012).
 *   2. **The answer is stored** in `owned_figures.acquired_lat` / `acquired_lng`. That IS the
 *      cache the policy asks for, and it is permanent.
 *   3. **One attempt, no retries**, and a 5-second budget — the same rule ADR-006 and ADR-010
 *      fixed for UPCitemdb. A retry loop is how a courtesy allowance becomes a block.
 *   4. **A real User-Agent** naming the project and its repository, so an operator looking at
 *      a log line can find a human.
 */

/** The search endpoint. No key, no account — which is exactly why the policy is strict. */
export const NOMINATIM_ENDPOINT = "https://nominatim.openstreetmap.org/search";

/**
 * Who is calling. The policy requires an identifying UA and blocks generic ones; a library
 * default (or a browser's, if this ever ran client-side) would be indistinguishable from a
 * scraper. Bumped by hand when the project's contact details change, never generated.
 */
export const NOMINATIM_USER_AGENT =
  "spidey-shelf/1.0 (+https://github.com/ilyanosovsky/spidey-shelf)";

/** The whole budget for one lookup. Past this the sighting is saved without a pin. */
export const NOMINATIM_TIMEOUT_MS = 5000;

/**
 * How precise a stored coordinate is allowed to be: two decimals, about 1 km at the equator.
 *
 * Two reasons, and the second is the one that settles it:
 *   · a marker on this map is five pixels of spider on a crop 8,000 km wide — anything past
 *     city precision is noise the picture cannot show;
 *   · this is a **public** site, and the geocoder is being asked about a place the owner
 *     physically stood in. A full-precision answer for a small town is close to the shop's
 *     doorstep. Rounding is the honest resolution of "where was this found", not a loss.
 *
 * It applies to geocoded answers only. The hand-written dictionary and coordinates copied
 * from a row that already has them are stored as they are — they are already city centres.
 */
export const COORDINATE_DECIMALS = 2;

/** `-118.2437` → `-118.24`. Symmetric around zero, which `Math.round` alone is not. */
export function roundToCityPrecision(value: number): number {
  const factor = 10 ** COORDINATE_DECIMALS;
  return Math.sign(value) * (Math.round(Math.abs(value) * factor) / factor);
}

/**
 * The URL for one structured city lookup, or `null` when there is nothing to ask about.
 *
 * **Structured (`city=` + `countrycodes=`) rather than free-form `q=`**, and that is a
 * deliberate pick: the two facts we hold are already separate fields, and a free-text
 * `"Kuala Lumpur, MY"` invites the geocoder to interpret a string we assembled ourselves —
 * which is how "LA" becomes Louisiana. `countrycodes` is a hard filter on the result set, so
 * a city name that exists in forty countries can only come back as the one the owner picked.
 *
 * `limit=1` because a second candidate is not information here: nothing downstream could
 * choose between two, and asking for ten and taking the first is the same answer with more
 * bytes. `format=jsonv2` is the current documented shape of the response.
 */
export function nominatimUrl(
  country: string | null | undefined,
  city: string | null | undefined,
): string | null {
  const code = (country ?? "").trim().toLowerCase();
  const name = (city ?? "").trim();
  if (!/^[a-z]{2}$/.test(code) || name.length === 0) return null;

  const url = new URL(NOMINATIM_ENDPOINT);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("city", name);
  url.searchParams.set("countrycodes", code);
  return url.toString();
}

/** The `lat` / `lon` of a jsonv2 result — strings in the documented shape, numbers tolerated. */
function readNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value !== "string" || value.trim() === "") return Number.NaN;
  return Number(value);
}

/**
 * What Nominatim said, as a coordinate or as nothing.
 *
 * Every failure is `null`, and the caller cannot tell them apart on purpose: a rate limit, a
 * town nobody has mapped, an HTML error page from a captive portal and a 500 all mean the
 * same thing to a sighting — it is saved without a pin, and the next edit will try again.
 * Distinguishing them would only be useful if something retried, and nothing may.
 *
 * The numbers are validated before they are rounded: `lat: "abc"` and a longitude of 400 are
 * both a `null`, never a marker somewhere off the map.
 */
export function parseNominatimResponse(status: number, body: unknown): Coordinate | null {
  if (status !== 200 || !Array.isArray(body) || body.length === 0) return null;

  const first = body[0];
  if (typeof first !== "object" || first === null) return null;

  const record = first as Record<string, unknown>;
  const point = { lat: readNumber(record.lat), lng: readNumber(record.lon) };
  if (!isCoordinate(point)) return null;

  return { lat: roundToCityPrecision(point.lat), lng: roundToCityPrecision(point.lng) };
}
