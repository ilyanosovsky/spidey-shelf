import { describe, expect, it } from "vitest";

import {
  interpretBrowseResponse,
  medianCents,
  parseBrowseResponse,
  parseTokenResponse,
  priceToCents,
} from "./parse";

/**
 * Fixtures shaped from **eBay's published Browse responses**, not from captured traffic.
 *
 * The owner has no developer keyset yet, so nothing in this project has ever seen a real
 * `item_summary/search` body (see docs/wiki/Environment.md). These are the documented shapes
 * — `itemSummaries[].price.{value,currency}` as decimal strings — and they are the contract
 * the parser is written against. When the keys land, one real response should be pasted in
 * here and this file should still pass; if it does not, the parser is what changes.
 */
const hit = {
  href: "https://api.ebay.com/buy/browse/v1/item_summary/search?q=Funko+Pop+Spider-Man+1450",
  total: 312,
  limit: 25,
  itemSummaries: [
    {
      itemId: "v1|1|0",
      title: "Funko Pop Marvel Spider-Man Last Stand 1450",
      price: { value: "18.99", currency: "USD" },
      buyingOptions: ["FIXED_PRICE"],
    },
    {
      itemId: "v1|2|0",
      title: "Funko Pop! Spider-Man (Last Stand) #1450 Mint",
      price: { value: "24.50", currency: "USD" },
      buyingOptions: ["FIXED_PRICE"],
    },
    {
      itemId: "v1|3|0",
      title: "Spider-Man Last Stand Pop 1450 - sealed",
      price: { value: "31.00", currency: "USD" },
      buyingOptions: ["FIXED_PRICE"],
    },
  ],
};

const empty = {
  href: "https://api.ebay.com/buy/browse/v1/item_summary/search",
  total: 0,
  limit: 25,
};

const unauthorized = {
  errors: [
    {
      errorId: 1001,
      domain: "OAuth",
      category: "REQUEST",
      message: "Invalid access token",
    },
  ],
};

const rateLimited = {
  errors: [{ errorId: 10001, domain: "API_BROWSE", message: "Application request limit reached" }],
};

describe("priceToCents", () => {
  it("reads eBay's decimal strings", () => {
    expect(priceToCents("18.99")).toBe(1899);
    expect(priceToCents("24.5")).toBe(2450);
    expect(priceToCents("1,299.00")).toBe(129900);
    expect(priceToCents(31)).toBe(3100);
  });

  it("rounds rather than truncates", () => {
    expect(priceToCents("19.999")).toBe(2000);
  });

  it("refuses anything that is not a positive number", () => {
    for (const value of [null, undefined, "", "free", "-4.00", "0", 0, NaN, {}, []]) {
      expect(priceToCents(value), String(value)).toBeNull();
    }
  });
});

describe("medianCents", () => {
  it("takes the middle of an odd list", () => {
    expect(medianCents([300, 100, 200])).toBe(200);
  });

  it("averages the middle pair of an even list", () => {
    expect(medianCents([100, 200, 300, 500])).toBe(250);
  });

  it("does not mutate its input", () => {
    const values = [300, 100, 200];
    medianCents(values);
    expect(values).toEqual([300, 100, 200]);
  });

  it("has an answer for nothing", () => {
    expect(medianCents([])).toBe(0);
  });
});

describe("parseBrowseResponse", () => {
  it("reads a real-shaped hit", () => {
    expect(parseBrowseResponse(hit)).toEqual({
      listingCount: 3,
      minCents: 1899,
      medianCents: 2450,
      currency: "USD",
    });
  });

  it("returns null when nothing is priced", () => {
    expect(parseBrowseResponse(empty)).toBeNull();
    expect(parseBrowseResponse({ itemSummaries: [{ title: "no price here" }] })).toBeNull();
  });

  it("never averages across currencies — the majority wins and the rest are dropped", () => {
    const mixed = {
      itemSummaries: [
        { price: { value: "10.00", currency: "USD" } },
        { price: { value: "20.00", currency: "USD" } },
        { price: { value: "900.00", currency: "JPY" } },
      ],
    };

    expect(parseBrowseResponse(mixed)).toEqual({
      listingCount: 2,
      minCents: 1000,
      medianCents: 1500,
      currency: "USD",
    });
  });

  it("is deterministic when two currencies tie", () => {
    const tied = {
      itemSummaries: [
        { price: { value: "10.00", currency: "USD" } },
        { price: { value: "9.00", currency: "EUR" } },
      ],
    };
    expect(parseBrowseResponse(tied)?.currency).toBe("EUR");
    expect(parseBrowseResponse(tied)?.currency).toBe(parseBrowseResponse(tied)?.currency);
  });

  it("skips a listing rather than throwing on it", () => {
    const ragged = {
      itemSummaries: [
        null,
        "nonsense",
        { price: null },
        { price: { value: "12.00", currency: "usd" } },
        { price: { value: "12.00", currency: "DOLLARS" } },
      ],
    };
    expect(parseBrowseResponse(ragged)).toEqual({
      listingCount: 1,
      minCents: 1200,
      medianCents: 1200,
      currency: "USD",
    });
  });

  it("survives garbage", () => {
    for (const payload of [
      null,
      undefined,
      42,
      "<html>captive portal</html>",
      [],
      { itemSummaries: 3 },
    ]) {
      expect(parseBrowseResponse(payload), String(payload)).toBeNull();
    }
  });
});

describe("interpretBrowseResponse", () => {
  it("classifies a hit", () => {
    expect(interpretBrowseResponse(200, hit)).toEqual({
      kind: "ok",
      signal: { listingCount: 3, minCents: 1899, medianCents: 2450, currency: "USD" },
    });
  });

  it("classifies a valid but empty answer", () => {
    expect(interpretBrowseResponse(200, empty)).toEqual({ kind: "empty" });
  });

  it("classifies 401 and 403 as unauthorized", () => {
    expect(interpretBrowseResponse(401, unauthorized)).toEqual({ kind: "unauthorized" });
    expect(interpretBrowseResponse(403, unauthorized)).toEqual({ kind: "unauthorized" });
  });

  it("classifies 429 as rate-limited — and it is never retried", () => {
    expect(interpretBrowseResponse(429, rateLimited)).toEqual({ kind: "rate-limited" });
  });

  it("classifies everything else as unusable", () => {
    expect(interpretBrowseResponse(500, { errors: [] })).toEqual({ kind: "unusable" });
    expect(interpretBrowseResponse(200, undefined)).toEqual({ kind: "unusable" });
    expect(interpretBrowseResponse(200, "<html>login</html>")).toEqual({ kind: "unusable" });
  });

  it("never reads a price out of an error body", () => {
    // A 429 whose body happens to look like a result set must still be a 429.
    expect(interpretBrowseResponse(429, hit)).toEqual({ kind: "rate-limited" });
  });
});

describe("parseTokenResponse", () => {
  const now = 1_700_000_000_000;

  it("reads the documented client-credentials response", () => {
    const token = parseTokenResponse(
      { access_token: "v^1.1#abc", expires_in: 7200, token_type: "Application Access Token" },
      now,
    );
    // A minute is shaved off, so a token cannot expire between the check and the request.
    expect(token).toEqual({ accessToken: "v^1.1#abc", expiresAt: now + 7140 * 1000 });
  });

  it("never returns a token it cannot expire", () => {
    for (const payload of [
      null,
      {},
      { access_token: "" },
      { access_token: "abc" },
      { access_token: "abc", expires_in: 0 },
      { access_token: "abc", expires_in: "7200" },
      { expires_in: 7200 },
    ]) {
      expect(parseTokenResponse(payload, now), JSON.stringify(payload)).toBeNull();
    }
  });

  it("clamps a lifetime shorter than the safety margin instead of going backwards", () => {
    expect(parseTokenResponse({ access_token: "a", expires_in: 10 }, now)?.expiresAt).toBe(now);
  });
});
