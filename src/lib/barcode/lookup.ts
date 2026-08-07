import "server-only";

import {
  parseUpcItemDbResponse,
  upcItemDbUrl,
  UPCITEMDB_TIMEOUT_MS,
  type UpcLookupOutcome,
} from "./upcitemdb";

/**
 * The one network call the scanner is allowed to make, wrapped so it can never be more
 * than one and can never throw.
 *
 * **The budget is real.** UPCitemdb's free trial tier is 100 lookups per day per IP, with
 * no key and no way to raise it, and a Vercel function's IP is shared. So:
 *   - the catalog is asked first and this is only reached on a miss;
 *   - there are **no retries** — a 429 answered by trying again is how a daily budget
 *     disappears in an afternoon, and the screen has a perfectly good keyboard on it;
 *   - a scan that failed its check digit never gets here at all (`normalizeScannedCode`).
 *
 * Every failure mode — timeout, DNS, an HTML captive-portal page, a 500 — becomes an
 * outcome, not an exception: this runs inside a page render, and a thrown fetch would
 * replace the whole scan flow with an error boundary.
 */
export async function lookupUpcItemDb(upc: string): Promise<UpcLookupOutcome> {
  try {
    const response = await fetch(upcItemDbUrl(upc), {
      headers: { Accept: "application/json" },
      // Never cached: a lookup is an event with a budget, not a page fragment.
      cache: "no-store",
      signal: AbortSignal.timeout(UPCITEMDB_TIMEOUT_MS),
    });

    // `.json()` on a non-JSON body throws — that is an `unavailable`, not a crash.
    const body = await response.json().catch(() => null);
    return parseUpcItemDbResponse(response.status, body);
  } catch {
    return { kind: "unavailable" };
  }
}
