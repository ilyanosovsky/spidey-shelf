import { describe, expect, it } from "vitest";

import { catalogResult } from "@/test/fixtures";

import {
  HAD_ONCE_NOTE,
  isOwnedResult,
  orderSearchResults,
  parseSearchQuery,
  PUBLIC_SEARCH_LIMIT,
  searchHrefFor,
  searchQueryValue,
  searchSummaryLine,
  searchVerdict,
  VERDICT_LABELS,
} from "./search";

describe("parseSearchQuery", () => {
  it("reads a bare box number", () => {
    expect(parseSearchQuery("1450")).toEqual({ kind: "number", popNumber: 1450, raw: "1450" });
  });

  it("reads the number the way it is printed on the box", () => {
    expect(parseSearchQuery("#1450")).toMatchObject({ kind: "number", popNumber: 1450 });
    expect(parseSearchQuery("  #1450  ")).toMatchObject({ kind: "number", popNumber: 1450 });
    expect(parseSearchQuery("# 1450")).toMatchObject({ kind: "number", popNumber: 1450 });
    expect(parseSearchQuery("0334")).toMatchObject({ kind: "number", popNumber: 334 });
  });

  it("treats anything else as a name", () => {
    expect(parseSearchQuery("miles")).toEqual({ kind: "text", text: "miles" });
    expect(parseSearchQuery("  no   way  home ")).toEqual({ kind: "text", text: "no way home" });
    // A number with a space in it is a typo, not a pop number — searched as text, not guessed.
    expect(parseSearchQuery("1 450")).toEqual({ kind: "text", text: "1 450" });
  });

  it("is empty for nothing, whitespace and a single character", () => {
    expect(parseSearchQuery(undefined)).toEqual({ kind: "empty" });
    expect(parseSearchQuery("")).toEqual({ kind: "empty" });
    expect(parseSearchQuery("   ")).toEqual({ kind: "empty" });
    expect(parseSearchQuery("m")).toEqual({ kind: "empty" });
  });

  it("takes the first value when ?q= repeats", () => {
    expect(parseSearchQuery(["1450", "334"])).toMatchObject({ popNumber: 1450 });
  });

  it("never turns an injection attempt into anything but text", () => {
    expect(parseSearchQuery("'; drop table owned_figures;--")).toEqual({
      kind: "text",
      text: "'; drop table owned_figures;--",
    });
  });
});

describe("searchQueryValue", () => {
  it("echoes the raw query back into the box", () => {
    expect(searchQueryValue(" 1450 ")).toBe("1450");
    expect(searchQueryValue(["miles", "gwen"])).toBe("miles");
    expect(searchQueryValue(undefined)).toBe("");
  });
});

describe("searchVerdict", () => {
  it("says OWNED when a copy is on the shelf", () => {
    expect(searchVerdict({ ownedCount: 1, hadOnce: false })).toBe("owned");
    expect(VERDICT_LABELS.owned).toBe("OWNED");
  });

  it("says OWNED even when one copy was given away and another stayed", () => {
    expect(searchVerdict({ ownedCount: 1, hadOnce: true })).toBe("owned");
  });

  it("says NOT OWNED with a footnote for a figure that left the shelf", () => {
    expect(searchVerdict({ ownedCount: 0, hadOnce: true })).toBe("had_once");
    expect(VERDICT_LABELS.had_once).toBe("NOT OWNED");
    expect(HAD_ONCE_NOTE).toBe("was in the collection once");
  });

  it("says NOT OWNED YET for a figure he never had", () => {
    expect(searchVerdict({ ownedCount: 0, hadOnce: false })).toBe("never");
    expect(VERDICT_LABELS.never).toBe("NOT OWNED YET");
  });
});

describe("orderSearchResults", () => {
  const owned = catalogResult({ slug: "owned-1450", ownedCount: 1 });
  const gone = catalogResult({ slug: "gone-718", ownedCount: 0, hadOnce: true });
  const never = catalogResult({ slug: "never-334", ownedCount: 0 });

  it("hoists owned matches to the top", () => {
    expect(orderSearchResults([never, gone, owned]).map((row) => row.slug)).toEqual([
      "owned-1450",
      "never-334",
      "gone-718",
    ]);
  });

  it("keeps the query's order inside each group", () => {
    const second = catalogResult({ slug: "owned-3", ownedCount: 2 });
    expect(orderSearchResults([owned, never, second]).map((row) => row.slug)).toEqual([
      "owned-1450",
      "owned-3",
      "never-334",
    ]);
  });

  it("leaves an empty result set alone", () => {
    expect(orderSearchResults([])).toEqual([]);
  });

  it("counts a had-once row as not owned", () => {
    expect(isOwnedResult(gone)).toBe(false);
    expect(isOwnedResult(owned)).toBe(true);
  });
});

describe("searchSummaryLine", () => {
  it("counts the matches", () => {
    expect(searchSummaryLine([catalogResult()])).toBe("1 MATCH");
    expect(searchSummaryLine([catalogResult({ slug: "a" }), catalogResult({ slug: "b" })])).toBe(
      "2 MATCHES",
    );
    expect(searchSummaryLine([])).toBe("0 MATCHES");
  });

  it("calls out the ones already on the shelf", () => {
    const results = [catalogResult({ slug: "a", ownedCount: 1 }), catalogResult({ slug: "b" })];
    expect(searchSummaryLine(results)).toBe("2 MATCHES · 1 ALREADY ON THE SHELF");
  });

  it("admits when the list is cut off at the limit", () => {
    const results = Array.from({ length: 4 }, (_, index) =>
      catalogResult({ slug: `figure-${index}` }),
    );
    expect(searchSummaryLine(results, 4)).toBe("FIRST 4 MATCHES");
  });

  it("has a limit big enough to hold the whole Spider-Man line", () => {
    expect(PUBLIC_SEARCH_LIMIT).toBeGreaterThanOrEqual(60);
  });
});

describe("searchHrefFor", () => {
  it("uses the box number — the canonical shareable answer", () => {
    expect(searchHrefFor({ popNumber: 334, name: "Spider-Man (White Spider)" })).toBe(
      "/search?q=334",
    );
  });

  it("falls back to the name for the numberless multi-packs", () => {
    expect(searchHrefFor({ popNumber: null, name: "Spider-Man: No Way Home (3 Pack)" })).toBe(
      "/search?q=Spider-Man%3A%20No%20Way%20Home%20(3%20Pack)",
    );
  });
});
