import { describe, expect, it } from "vitest";

import {
  decideMarketFetch,
  formatMoney,
  formatSnapshotAge,
  isSnapshotFresh,
  marketSignalLine,
  mayShowPriceChip,
  PRICE_SNAPSHOT_TTL_MS,
  snapshotAgeMs,
  type StoredSnapshot,
} from "./snapshot";

const NOW = Date.UTC(2026, 7, 7, 12, 0, 0);
const HOUR = 60 * 60 * 1000;

function snapshot(ageMs: number, overrides: Partial<StoredSnapshot> = {}): StoredSnapshot {
  return {
    listingCount: 25,
    minCents: 1899,
    medianCents: 2450,
    currency: "USD",
    fetchedAt: new Date(NOW - ageMs),
    ...overrides,
  };
}

describe("snapshotAgeMs", () => {
  it("measures backwards from now", () => {
    expect(snapshotAgeMs(snapshot(3 * HOUR), NOW)).toBe(3 * HOUR);
  });

  it("clamps a snapshot from the future to zero rather than going negative", () => {
    expect(snapshotAgeMs(snapshot(-HOUR), NOW)).toBe(0);
  });
});

describe("isSnapshotFresh", () => {
  it("is fresh inside the 24-hour window", () => {
    expect(isSnapshotFresh(snapshot(HOUR), NOW)).toBe(true);
    expect(isSnapshotFresh(snapshot(PRICE_SNAPSHOT_TTL_MS - 1), NOW)).toBe(true);
  });

  it("is stale at the window's edge and beyond", () => {
    expect(isSnapshotFresh(snapshot(PRICE_SNAPSHOT_TTL_MS), NOW)).toBe(false);
    expect(isSnapshotFresh(snapshot(9 * PRICE_SNAPSHOT_TTL_MS), NOW)).toBe(false);
  });

  it("treats nothing as stale", () => {
    expect(isSnapshotFresh(null, NOW)).toBe(false);
    expect(isSnapshotFresh(undefined, NOW)).toBe(false);
  });
});

describe("decideMarketFetch", () => {
  it("does nothing at all without keys — not even for a stale snapshot", () => {
    expect(
      decideMarketFetch({ configured: false, snapshot: snapshot(9 * HOUR), now: NOW }),
    ).toEqual({
      refresh: false,
      serveStored: false,
    });
  });

  it("serves a fresh snapshot without spending a call", () => {
    expect(decideMarketFetch({ configured: true, snapshot: snapshot(HOUR), now: NOW })).toEqual({
      refresh: false,
      serveStored: true,
    });
  });

  it("refreshes when there is nothing cached, and has nothing to fall back on", () => {
    expect(decideMarketFetch({ configured: true, snapshot: null, now: NOW })).toEqual({
      refresh: true,
      serveStored: false,
    });
  });

  it("refreshes a stale snapshot but keeps it as the fallback", () => {
    expect(
      decideMarketFetch({ configured: true, snapshot: snapshot(30 * HOUR), now: NOW }),
    ).toEqual({
      refresh: true,
      serveStored: true,
    });
  });

  it("respects a custom TTL", () => {
    const decision = decideMarketFetch({
      configured: true,
      snapshot: snapshot(2 * HOUR),
      now: NOW,
      ttl: HOUR,
    });
    expect(decision.refresh).toBe(true);
  });
});

describe("mayShowPriceChip", () => {
  it("shows a chip only for a snapshot somebody else already paid for", () => {
    expect(mayShowPriceChip(snapshot(HOUR), NOW)).toBe(true);
    expect(mayShowPriceChip(snapshot(30 * HOUR), NOW)).toBe(false);
    expect(mayShowPriceChip(null, NOW)).toBe(false);
  });
});

describe("formatMoney", () => {
  it("rounds to whole units, because the number is a median of asking prices", () => {
    expect(formatMoney(2450, "USD")).toBe("$25");
    expect(formatMoney(1899, "USD")).toBe("$19");
    expect(formatMoney(2000, "EUR")).toBe("€20");
    expect(formatMoney(1250, "GBP")).toBe("£13");
  });

  it("prints an unfamiliar currency rather than guessing a symbol", () => {
    expect(formatMoney(3400, "AUD")).toBe("AUD 34");
    expect(formatMoney(90000, "jpy")).toBe("JPY 900");
  });
});

describe("formatSnapshotAge", () => {
  it("is coarse on purpose", () => {
    expect(formatSnapshotAge(0)).toBe("CHECKED JUST NOW");
    expect(formatSnapshotAge(59 * 60 * 1000)).toBe("CHECKED JUST NOW");
    expect(formatSnapshotAge(6 * HOUR)).toBe("CHECKED 6H AGO");
    expect(formatSnapshotAge(23 * HOUR)).toBe("CHECKED 23H AGO");
    expect(formatSnapshotAge(3 * 24 * HOUR)).toBe("CHECKED 3D AGO");
  });
});

describe("marketSignalLine", () => {
  it("is a price and a sample size, in that order", () => {
    expect(
      marketSignalLine({ listingCount: 25, minCents: 1899, medianCents: 2450, currency: "USD" }),
    ).toBe("~$25 · 25 LISTINGS");
  });

  it("gets the singular right", () => {
    expect(
      marketSignalLine({ listingCount: 1, minCents: 1899, medianCents: 1899, currency: "USD" }),
    ).toBe("~$19 · 1 LISTING");
  });
});
