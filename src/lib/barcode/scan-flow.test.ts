import { describe, expect, it } from "vitest";

import {
  chooseScanTarget,
  mergeScanCandidates,
  parseScanOrigin,
  scanFallbackRoute,
  scanNoticeMessage,
} from "./scan-flow";
import { type UpcLookupOutcome } from "./upcitemdb";

/** The graded routing between a decoded number and a screen. */

const hit: UpcLookupOutcome = { kind: "hit", title: "Funko Pop Spider-Man #1450", brand: "Funko" };
const missing: UpcLookupOutcome = { kind: "not_found" };
const busy: UpcLookupOutcome = { kind: "rate_limited" };
const down: UpcLookupOutcome = { kind: "unavailable" };

describe("chooseScanTarget", () => {
  it("has nothing to open when the catalog does not know the code", () => {
    expect(chooseScanTarget([])).toBeNull();
  });

  it("opens the only match", () => {
    expect(chooseScanTarget([{ id: "a", popNumber: 1450, name: "Spider-Man" }])).toBe("a");
  });

  it("opens the lowest number when exclusives share a code, deterministically", () => {
    const matches = [
      { id: "high", popNumber: 1450, name: "Spider-Man (Chase)" },
      { id: "low", popNumber: 3, name: "Spider-Man" },
    ];

    expect(chooseScanTarget(matches)).toBe("low");
    expect(chooseScanTarget([...matches].reverse())).toBe("low");
  });

  it("sinks the numberless rows and breaks ties on the name", () => {
    expect(
      chooseScanTarget([
        { id: "pack", popNumber: null, name: "3-Pack" },
        { id: "b", popNumber: 3, name: "Zebra" },
        { id: "a", popNumber: 3, name: "Alpha" },
      ]),
    ).toBe("a");
  });
});

describe("scanFallbackRoute", () => {
  it("shows the candidates when the lookup named something we can match", () => {
    expect(scanFallbackRoute(hit, 3)).toEqual({ kind: "candidates", notice: "FOUND_IT" });
  });

  it("goes to the new-figure form when the lookup named something we have never heard of", () => {
    expect(scanFallbackRoute(hit, 0)).toEqual({ kind: "new", notice: "NOT_IN_CATALOG" });
  });

  it("says which kind of nothing happened", () => {
    expect(scanFallbackRoute(missing, 0)).toEqual({ kind: "new", notice: "NOT_FOUND" });
    expect(scanFallbackRoute(busy, 0)).toEqual({ kind: "new", notice: "LOOKUP_BUSY" });
    expect(scanFallbackRoute(down, 0)).toEqual({ kind: "new", notice: "LOOKUP_DOWN" });
  });

  it("never shows candidates it did not get from a hit", () => {
    // Defensive: a rate limit with stale candidates in hand is still a rate limit.
    expect(scanFallbackRoute(busy, 5).kind).toBe("new");
    expect(scanFallbackRoute(missing, 5).kind).toBe("new");
  });

  it("has a sentence for every notice it can return", () => {
    for (const lookup of [hit, missing, busy, down]) {
      for (const count of [0, 3]) {
        expect(scanNoticeMessage(scanFallbackRoute(lookup, count).notice).length).toBeGreaterThan(
          0,
        );
      }
    }
  });
});

describe("mergeScanCandidates", () => {
  const number = [{ id: "n1" }, { id: "n2" }];
  const name = [{ id: "n2" }, { id: "t1" }];

  it("puts the exact number matches first and never repeats a row", () => {
    expect(mergeScanCandidates(number, name)).toEqual([{ id: "n1" }, { id: "n2" }, { id: "t1" }]);
  });

  it("works when only one search ran", () => {
    expect(mergeScanCandidates([], name)).toEqual([{ id: "n2" }, { id: "t1" }]);
    expect(mergeScanCandidates(number, [])).toEqual(number);
    expect(mergeScanCandidates([], [])).toEqual([]);
  });

  it("caps the list so the screen stays one thumb-scroll", () => {
    const many = Array.from({ length: 30 }, (_, index) => ({ id: `x${index}` }));
    expect(mergeScanCandidates(many, [], 8)).toHaveLength(8);
    expect(mergeScanCandidates(many, [], 0)).toHaveLength(0);
  });
});

describe("parseScanOrigin", () => {
  it("reads the two origins the confirm step distinguishes", () => {
    expect(parseScanOrigin("barcode")).toBe("barcode");
    expect(parseScanOrigin(" LOOKUP ")).toBe("lookup");
    expect(parseScanOrigin(["barcode", "lookup"])).toBe("barcode");
  });

  it("drops anything else, so nothing renders out of the address bar", () => {
    for (const raw of ["", "  ", "matched", "<b>", undefined]) {
      expect(parseScanOrigin(raw)).toBeNull();
    }
  });
});
