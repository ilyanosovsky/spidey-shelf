import { describe, expect, it, vi } from "vitest";

import { type BrowseOutcome, type MarketSignal } from "./parse";
import { isCronAuthorized, refreshTargets, type RefreshTarget } from "./refresh";
import { PRICE_REFRESH_AFTER_MS, type StoredSnapshot } from "./snapshot";

/**
 * The nightly sweep, with the network and the database replaced by two functions.
 *
 * The rules being asserted here are the ones that cost money when they are wrong: a door
 * that opens without the secret, a retry on a 429, a refresh of something that was already
 * fresh, and a run that spends its whole budget on the first figure and reports nothing.
 */

const NOW = Date.UTC(2026, 7, 7, 6, 0, 0);
const HOUR = 60 * 60 * 1000;
const SECRET = "s3cr3t-value";

function snapshot(ageMs: number): StoredSnapshot {
  return {
    listingCount: 25,
    minCents: 1899,
    medianCents: 2450,
    currency: "USD",
    fetchedAt: new Date(NOW - ageMs),
  };
}

function target(overrides: Partial<RefreshTarget> = {}): RefreshTarget {
  return {
    figureId: "11111111-1111-4111-8111-111111111111",
    slug: "pop-marvel-spider-man-3",
    name: "Spider-Man",
    popNumber: 3,
    snapshot: null,
    ...overrides,
  };
}

const SIGNAL: MarketSignal = {
  listingCount: 25,
  minCents: 500,
  medianCents: 1599,
  currency: "USD",
};

/** One outcome for every call, or a queue of them when a run needs to go wrong midway. */
function deps(outcomes: BrowseOutcome[] | BrowseOutcome = { kind: "ok", signal: SIGNAL }) {
  const queue = Array.isArray(outcomes) ? [...outcomes] : null;
  const fetch = vi.fn(async (): Promise<BrowseOutcome> =>
    queue ? (queue.shift() ?? { kind: "unusable" }) : (outcomes as BrowseOutcome),
  );
  const save = vi.fn(async (): Promise<void> => undefined);
  return { fetch, save, now: () => NOW };
}

describe("isCronAuthorized", () => {
  it("opens for Vercel's own bearer header", () => {
    expect(isCronAuthorized(`Bearer ${SECRET}`, SECRET)).toBe(true);
    // The scheme is case-insensitive on the wire; the secret is not.
    expect(isCronAuthorized(`bearer ${SECRET}`, SECRET)).toBe(true);
    expect(isCronAuthorized(`Bearer  ${SECRET} `, SECRET)).toBe(true);
  });

  it("refuses a wrong, missing or malformed header", () => {
    expect(isCronAuthorized(`Bearer ${SECRET.toUpperCase()}`, SECRET)).toBe(false);
    expect(isCronAuthorized("Bearer nope", SECRET)).toBe(false);
    expect(isCronAuthorized(SECRET, SECRET)).toBe(false);
    expect(isCronAuthorized("Basic Zm9vOmJhcg==", SECRET)).toBe(false);
    expect(isCronAuthorized(null, SECRET)).toBe(false);
    expect(isCronAuthorized(undefined, SECRET)).toBe(false);
    expect(isCronAuthorized("", SECRET)).toBe(false);
  });

  it("authorizes NOBODY when the secret is missing — a forgotten env var is not a key", () => {
    expect(isCronAuthorized("Bearer anything", undefined)).toBe(false);
    expect(isCronAuthorized("Bearer anything", "")).toBe(false);
    expect(isCronAuthorized("Bearer anything", "   ")).toBe(false);
    expect(isCronAuthorized("Bearer  ", "")).toBe(false);
  });
});

describe("refreshTargets", () => {
  it("refreshes what is stale and reports it", async () => {
    const d = deps();
    const summary = await refreshTargets(
      [target({ slug: "a" }), target({ slug: "b", snapshot: snapshot(20 * HOUR) })],
      d,
    );

    expect(summary).toEqual({ checked: 2, refreshed: 2, failed: 0, skippedFresh: 0 });
    expect(d.fetch).toHaveBeenCalledTimes(2);
    expect(d.save).toHaveBeenCalledTimes(2);
  });

  it("asks eBay the same question the figure page asks", async () => {
    const d = deps();
    await refreshTargets([target({ name: "Spider-Man (Last Stand)", popNumber: 1450 })], d);

    expect(d.fetch).toHaveBeenCalledWith("Funko Pop Spider-Man Last Stand 1450");
  });

  it("writes the snapshot against the figure id and the run's clock", async () => {
    const d = deps();
    await refreshTargets([target({ figureId: "fig-1" })], d);

    expect(d.save).toHaveBeenCalledWith("fig-1", SIGNAL, new Date(NOW));
  });

  it("leaves a young snapshot alone — the sweep is idempotent inside its own TTL", async () => {
    const d = deps();
    const summary = await refreshTargets(
      [target({ snapshot: snapshot(PRICE_REFRESH_AFTER_MS - HOUR) })],
      d,
    );

    expect(summary).toEqual({ checked: 1, refreshed: 0, failed: 0, skippedFresh: 1 });
    expect(d.fetch).not.toHaveBeenCalled();
  });

  it("refreshes at half a day, so a daily cron never finds anything already expired", async () => {
    const d = deps();
    const summary = await refreshTargets(
      [target({ snapshot: snapshot(PRICE_REFRESH_AFTER_MS + 1) })],
      d,
    );

    expect(summary.refreshed).toBe(1);
  });

  it("counts a rate limit as a failure and never asks twice", async () => {
    const d = deps([{ kind: "rate-limited" }, { kind: "unauthorized" }, { kind: "empty" }]);
    const summary = await refreshTargets(
      [target({ slug: "a" }), target({ slug: "b" }), target({ slug: "c" })],
      d,
    );

    expect(summary).toEqual({ checked: 3, refreshed: 0, failed: 3, skippedFresh: 0 });
    expect(d.fetch).toHaveBeenCalledTimes(3);
    expect(d.save).not.toHaveBeenCalled();
  });

  it("keeps going after a failure — one bad figure is not a bad night", async () => {
    const d = deps([{ kind: "rate-limited" }, { kind: "ok", signal: SIGNAL }]);
    const summary = await refreshTargets([target({ slug: "a" }), target({ slug: "b" })], d);

    expect(summary).toEqual({ checked: 2, refreshed: 1, failed: 1, skippedFresh: 0 });
  });

  it("survives a cache that will not take the write", async () => {
    const d = deps();
    d.save.mockRejectedValueOnce(new Error("connection reset"));

    const summary = await refreshTargets([target()], d);

    // A failed write costs the next sweep one call. It is not a failed refresh, and it is
    // certainly not an unhandled rejection inside a scheduled function.
    expect(summary.refreshed).toBe(1);
  });

  it("is sequential, so nineteen figures are not nineteen simultaneous calls", async () => {
    let open = 0;
    let peak = 0;
    const fetch = vi.fn(async () => {
      open += 1;
      peak = Math.max(peak, open);
      await Promise.resolve();
      open -= 1;
      return { kind: "ok", signal: SIGNAL } as BrowseOutcome;
    });

    await refreshTargets([target({ slug: "a" }), target({ slug: "b" }), target({ slug: "c" })], {
      fetch,
      save: async () => undefined,
      now: () => NOW,
    });

    expect(peak).toBe(1);
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("stops starting calls when the budget is spent, and still reports what it did", async () => {
    let clock = NOW;
    const fetch = vi.fn(async () => {
      clock += 20_000;
      return { kind: "ok", signal: SIGNAL } as BrowseOutcome;
    });

    const summary = await refreshTargets(
      [target({ slug: "a" }), target({ slug: "b" }), target({ slug: "c" }), target({ slug: "d" })],
      { fetch, save: async () => undefined, now: () => clock },
      { budgetMs: 50_000 },
    );

    // Three calls fit inside fifty seconds; the fourth figure is never looked at, and the
    // summary says so rather than the function being killed with nothing to report.
    expect(summary).toEqual({ checked: 3, refreshed: 3, failed: 0, skippedFresh: 0 });
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("does nothing at all with nothing to do", async () => {
    const d = deps();
    const summary = await refreshTargets([], d);

    expect(summary).toEqual({ checked: 0, refreshed: 0, failed: 0, skippedFresh: 0 });
    expect(d.fetch).not.toHaveBeenCalled();
  });
});
