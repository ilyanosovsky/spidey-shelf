import type { NextRequest } from "next/server";

import { isEbayConfigured } from "@/lib/ebay/config";
import { refreshStalePrices } from "@/lib/ebay/market";
import { isCronAuthorized } from "@/lib/ebay/refresh";

/**
 * The nightly price sweep — `0 6 * * *` in `vercel.json`, and the only scheduled work this
 * project has (Phase 11).
 *
 * It exists so that no page ever has to fetch a price. The shelf grid prints a chip on
 * twenty cards and `/stats` sums nineteen figures; if either of them refreshed what it found
 * stale, one visitor would cost nineteen eBay calls. Instead they read `price_snapshots`,
 * and this endpoint is what puts something in it.
 *
 * Three gates, in this order, and the order is the point:
 *
 *   1. **Authorization.** Vercel attaches `Authorization: Bearer $CRON_SECRET` to a
 *      scheduled invocation whenever that variable exists on the project. Anything else gets
 *      401 JSON before a single row is read — the check is the first thing in the handler,
 *      not a proxy rule, for the same reason every admin action re-verifies its session
 *      (CVE-2025-29927): a check that is not in the handler is not a check.
 *   2. **The feature gate.** No keys, no work: `200 {"skipped":"ebay-not-configured"}`
 *      without touching the database. A deployment with prices switched off should not have
 *      a cron job that fails every morning at six.
 *   3. **The sweep**, which reports counts and never listings. This URL is reachable from
 *      the internet with the right header, and a price feed is not what a cron log is for.
 *
 * `force-dynamic` for the usual project reason: it reads the database, so it must never be
 * evaluated during `next build` (CI has no `DATABASE_URL`). `maxDuration` is 60s — the Hobby
 * ceiling — and the sweep stops starting calls ten seconds before it, so a slow night comes
 * back with a summary rather than being killed mid-figure.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest): Promise<Response> {
  if (!isCronAuthorized(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return Response.json({ error: "Not the scheduler." }, { status: 401 });
  }

  if (!isEbayConfigured()) {
    return Response.json({ skipped: "ebay-not-configured" });
  }

  return Response.json(await refreshStalePrices());
}
