import "server-only";

import { isEbayConfigured } from "./config";
import {
  interpretBrowseResponse,
  parseTokenResponse,
  type BrowseOutcome,
  type EbayToken,
} from "./parse";
import {
  EBAY_BROWSE_URL,
  EBAY_MARKETPLACE,
  EBAY_SCOPE,
  EBAY_SEARCH_LIMIT,
  EBAY_TOKEN_URL,
} from "./query";

/**
 * The only file that holds the eBay secret, and the only one that opens a socket.
 *
 * Everything it decides is delegated to the pure modules next door; what lives here is the
 * plumbing that cannot be pure — the credentials, the two `fetch` calls, the timeout and the
 * in-process token cache.
 *
 * Three rules, all of them load-bearing rather than hygiene:
 *
 *   1. **It never throws.** This runs inside a server render of `/figure/[slug]`. A rejected
 *      promise would take the whole figure page down to an error boundary because a price
 *      panel could not load — so every failure comes back as an outcome instead.
 *   2. **One attempt, no retries.** The same rule the UPCitemdb client follows (ADR-006): a
 *      429 answered by trying again is how a daily quota disappears in an afternoon.
 *   3. **A 5-second budget for the whole thing**, token included. A figure page that hangs
 *      waiting on a third party has stopped being a figure page.
 *
 * ⚠️ Written against eBay's published Browse and OAuth contracts, and **never yet run against
 * the live API** — the owner has no developer keyset (see docs/wiki/Environment.md). The
 * fixtures in `parse.test.ts` are the documented shapes; one real response should be compared
 * against them the day the keys land.
 */

/** The whole budget for a refresh, token fetch included. */
export const EBAY_TIMEOUT_MS = 5000;

/**
 * The application token, cached in module scope until it expires.
 *
 * Per-instance and deliberately not in the database: a serverless instance handles many
 * requests, so this saves a round trip on every one of them after the first, and an instance
 * that dies loses nothing but a token it can ask for again. eBay's client-credentials tokens
 * last two hours; `parseTokenResponse` shaves a minute off so it cannot expire mid-request.
 */
let cachedToken: EbayToken | null = null;

/** Test seam and a safety valve — a rotated keyset should not be shadowed by an old token. */
export function resetEbayTokenCache(): void {
  cachedToken = null;
}

async function accessToken(signal: AbortSignal, now: number): Promise<string | null> {
  if (cachedToken && cachedToken.expiresAt > now) return cachedToken.accessToken;

  const id = process.env.EBAY_CLIENT_ID ?? "";
  const secret = process.env.EBAY_CLIENT_SECRET ?? "";
  // Basic auth, base64 of `id:secret` — the one place the secret is touched.
  const basic = Buffer.from(`${id}:${secret}`).toString("base64");

  const response = await fetch(EBAY_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "client_credentials", scope: EBAY_SCOPE }),
    cache: "no-store",
    signal,
  });

  if (!response.ok) {
    cachedToken = null;
    return null;
  }

  const token = parseTokenResponse(await response.json(), now);
  cachedToken = token;
  return token?.accessToken ?? null;
}

/**
 * Ask eBay what a figure is going for. Returns an outcome; never rejects.
 *
 * `filter=buyingOptions:{FIXED_PRICE}` is what makes the number comparable: an auction's
 * current bid is not a price, it is a moment in one. The marketplace is a header rather than
 * a query parameter, which is the part of the Browse contract that is easiest to get wrong.
 */
export async function fetchMarketSignal(query: string): Promise<BrowseOutcome> {
  if (!isEbayConfigured()) return { kind: "unusable" };

  const controller = AbortSignal.timeout(EBAY_TIMEOUT_MS);

  try {
    const token = await accessToken(controller, Date.now());
    if (!token) return { kind: "unauthorized" };

    const url = new URL(EBAY_BROWSE_URL);
    url.searchParams.set("q", query);
    url.searchParams.set("limit", String(EBAY_SEARCH_LIMIT));
    url.searchParams.set("filter", "buyingOptions:{FIXED_PRICE}");

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "X-EBAY-C-MARKETPLACE-ID": EBAY_MARKETPLACE,
        Accept: "application/json",
      },
      cache: "no-store",
      signal: controller,
    });

    // A 401 here means the cached token was revoked, not merely expired. Dropping it is what
    // lets the *next* page view recover on its own; retrying inside this one would not.
    if (response.status === 401 || response.status === 403) resetEbayTokenCache();

    const payload = await response.json().catch(() => undefined);
    return interpretBrowseResponse(response.status, payload);
  } catch {
    // Timeout, DNS, a captive portal, a body that is not JSON — all the same to the page.
    return { kind: "unusable" };
  }
}
