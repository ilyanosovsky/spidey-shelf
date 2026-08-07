// @vitest-environment node
// The route handler deals in web `Request`/`Response`; jsdom's copies are not the ones Next
// hands it, and the header casing differs.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { NextRequest } from "next/server";

/**
 * The door of the nightly sweep.
 *
 * Everything expensive behind it is mocked, because what this file is about is the three
 * things that happen *before* an eBay call: the bearer check, the keys-unconfigured skip,
 * and the shape of the summary. The loop itself is `refresh.test.ts`.
 *
 * The failure this guards against is specific: an endpoint that spends the day's Browse
 * allowance for anyone who finds the URL. So the assertions are as much about `refreshStalePrices`
 * NOT being called as about the status code.
 */

const SECRET = "cron-secret-for-the-test";

const refreshStalePrices = vi.fn(async () => ({
  checked: 19,
  refreshed: 4,
  failed: 1,
  skippedFresh: 14,
}));

vi.mock("@/lib/ebay/market", () => ({ refreshStalePrices }));

const { GET } = await import("./route");

function request(headers: Record<string, string> = {}): NextRequest {
  return new Request("https://spidey.example.com/api/cron/refresh-prices", {
    headers,
  }) as unknown as NextRequest;
}

beforeEach(() => {
  refreshStalePrices.mockClear();
  process.env.CRON_SECRET = SECRET;
  process.env.EBAY_CLIENT_ID = "test-id";
  process.env.EBAY_CLIENT_SECRET = "test-secret";
});

afterEach(() => {
  delete process.env.CRON_SECRET;
  delete process.env.EBAY_CLIENT_ID;
  delete process.env.EBAY_CLIENT_SECRET;
});

describe("GET /api/cron/refresh-prices", () => {
  it("runs the sweep for Vercel's scheduler and answers with counts", async () => {
    const response = await GET(request({ authorization: `Bearer ${SECRET}` }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      checked: 19,
      refreshed: 4,
      failed: 1,
      skippedFresh: 14,
    });
    expect(refreshStalePrices).toHaveBeenCalledTimes(1);
  });

  it("answers 401 JSON to a request with no bearer token, and does no work", async () => {
    const response = await GET(request());

    expect(response.status).toBe(401);
    expect(response.headers.get("content-type")).toContain("application/json");
    await expect(response.json()).resolves.toHaveProperty("error");
    expect(refreshStalePrices).not.toHaveBeenCalled();
  });

  it("answers 401 to the wrong token", async () => {
    const response = await GET(request({ authorization: "Bearer not-the-secret" }));

    expect(response.status).toBe(401);
    expect(refreshStalePrices).not.toHaveBeenCalled();
  });

  it("answers 401 when CRON_SECRET is not configured at all", async () => {
    delete process.env.CRON_SECRET;

    const response = await GET(request({ authorization: "Bearer anything" }));

    expect(response.status).toBe(401);
    expect(refreshStalePrices).not.toHaveBeenCalled();
  });

  it("skips without eBay keys instead of failing every morning at six", async () => {
    delete process.env.EBAY_CLIENT_ID;
    delete process.env.EBAY_CLIENT_SECRET;

    const response = await GET(request({ authorization: `Bearer ${SECRET}` }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ skipped: "ebay-not-configured" });
    // Not one query, let alone one call: the gate is checked before the database is touched.
    expect(refreshStalePrices).not.toHaveBeenCalled();
  });

  it("treats a half-configured keyset as unconfigured", async () => {
    delete process.env.EBAY_CLIENT_SECRET;

    const response = await GET(request({ authorization: `Bearer ${SECRET}` }));

    await expect(response.json()).resolves.toEqual({ skipped: "ebay-not-configured" });
    expect(refreshStalePrices).not.toHaveBeenCalled();
  });

  it("never puts a listing, a price or the secret in its answer", async () => {
    const response = await GET(request({ authorization: `Bearer ${SECRET}` }));
    const body = await response.text();

    expect(body).not.toContain(SECRET);
    expect(body).not.toMatch(/cents|itemSummaries|ebay/i);
  });
});
