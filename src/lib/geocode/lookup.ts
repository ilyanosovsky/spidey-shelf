import { type Coordinate } from "../geo";
import {
  nominatimUrl,
  NOMINATIM_TIMEOUT_MS,
  NOMINATIM_USER_AGENT,
  parseNominatimResponse,
} from "./nominatim";

/**
 * The one network call the geocoder is allowed to make, wrapped so it can never be more than
 * one and can never throw.
 *
 * The same shape `barcode/lookup.ts` has, for the same reasons — but note what is NOT here:
 * **no `import "server-only"`**. Every other module that opens a socket in this project
 * carries the marker; this one cannot, because `scripts/backfill-geocode.ts` reuses it under
 * `tsx`, where the `server-only` package throws by design (its `default` export condition IS
 * a `throw`, and the `react-server` condition only exists inside a React Server Components
 * build). The guard lives one level up instead: `./index.ts`, the module the two server
 * actions import, is `server-only`, so nothing in the app can reach this file from a client
 * component without going through it. This file holds no secret, reads no session and touches
 * no database, so the marker was buying a boundary rather than protecting a value.
 *
 * The callers are, exhaustively: `./index.ts` (Quick Add's details submit and the collection
 * edit submit) and the backfill script. **No page, layout or route handler geocodes** —
 * a rendered page reads `acquired_lat` / `acquired_lng` off a row that already has them.
 */
export async function geocodeCity(country: string, city: string): Promise<Coordinate | null> {
  const url = nominatimUrl(country, city);
  if (url === null) return null;

  try {
    const response = await fetch(url, {
      headers: {
        // The policy's first requirement, and the one that gets projects blocked. See
        // https://operations.osmfoundation.org/policies/nominatim/ and ./nominatim.ts.
        "User-Agent": NOMINATIM_USER_AGENT,
        Accept: "application/json",
      },
      // Never cached: this is one event with a budget, not a page fragment. The cache that
      // matters is the `acquired_lat` / `acquired_lng` columns the answer is written to.
      cache: "no-store",
      // One attempt. `AbortSignal.timeout` rejects the fetch, which the catch below turns
      // into "no pin" — a sighting must never wait on somebody else's server.
      signal: AbortSignal.timeout(NOMINATIM_TIMEOUT_MS),
    });

    // A non-JSON body (an HTML rate-limit page, a captive portal) throws here — that is a
    // `null`, not a crash, because a save is in flight behind this call.
    const body = await response.json().catch(() => null);
    return parseNominatimResponse(response.status, body);
  } catch {
    return null;
  }
}
