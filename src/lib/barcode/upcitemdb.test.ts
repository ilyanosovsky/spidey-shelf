import { describe, expect, it } from "vitest";

import { parseProductTitle, parseUpcItemDbResponse, upcItemDbUrl } from "./upcitemdb";

/**
 * The lookup's answers, as fixtures.
 *
 * These are the four shapes the free trial tier actually returns — a product, an unknown
 * barcode, the daily ceiling, and whatever a proxy felt like sending. The point of testing
 * them here is that the live service may only be called a hundred times a day, so the
 * decision "what does this mean" has to be provable without calling it at all.
 */

const HIT = {
  code: "OK",
  total: 1,
  offset: 0,
  items: [
    {
      ean: "0889698636759",
      title: "Funko POP! Marvel Spider-Man Last Stand #1450 Vinyl Figure",
      description: "From Spider-Man, Last Stand, as a stylized POP vinyl from Funko!",
      upc: "889698636759",
      brand: "Funko",
      category: "Toys & Games > Toys > Action Figures",
      images: ["https://example.invalid/1.jpg"],
      offers: [],
    },
  ],
};

const NOT_FOUND = { code: "NOT_FOUND", message: "", total: 0, items: [] };
const RATE_LIMITED = { code: "EXCEED_LIMIT", message: "Exceeded the daily quota." };
const TOO_FAST = { code: "TOO_FAST", message: "Too many requests." };

describe("upcItemDbUrl", () => {
  it("asks about exactly one barcode, escaped", () => {
    expect(upcItemDbUrl("889698636759")).toBe(
      "https://api.upcitemdb.com/prod/trial/lookup?upc=889698636759",
    );
    expect(upcItemDbUrl("a b&c=1")).toContain("upc=a%20b%26c%3D1");
  });
});

describe("parseUpcItemDbResponse", () => {
  it("reads a product out of a hit", () => {
    expect(parseUpcItemDbResponse(200, HIT)).toEqual({
      kind: "hit",
      title: "Funko POP! Marvel Spider-Man Last Stand #1450 Vinyl Figure",
      brand: "Funko",
    });
  });

  it("takes the first item that actually has a name", () => {
    const body = { code: "OK", items: [{ brand: "Funko" }, { title: "Venom #363" }] };
    expect(parseUpcItemDbResponse(200, body)).toMatchObject({ kind: "hit", title: "Venom #363" });
  });

  it("calls a 404 and an empty result set the same thing: not found", () => {
    expect(parseUpcItemDbResponse(404, NOT_FOUND)).toEqual({ kind: "not_found" });
    expect(parseUpcItemDbResponse(200, { code: "OK", total: 0, items: [] })).toEqual({
      kind: "not_found",
    });
    expect(parseUpcItemDbResponse(400, { code: "INVALID_UPC" })).toEqual({ kind: "not_found" });
  });

  it("recognises the daily ceiling from the status OR the body", () => {
    expect(parseUpcItemDbResponse(429, RATE_LIMITED)).toEqual({ kind: "rate_limited" });
    expect(parseUpcItemDbResponse(429, null)).toEqual({ kind: "rate_limited" });
    expect(parseUpcItemDbResponse(200, TOO_FAST)).toEqual({ kind: "rate_limited" });
  });

  it("never mistakes garbage for an answer", () => {
    for (const body of [null, undefined, "<html>502</html>", 42, [], { items: "soon" }]) {
      expect(parseUpcItemDbResponse(200, body)).toEqual({ kind: "unavailable" });
    }
    expect(parseUpcItemDbResponse(500, { code: "SERVER_ERR" })).toEqual({ kind: "unavailable" });
    expect(parseUpcItemDbResponse(503, null)).toEqual({ kind: "unavailable" });
  });

  it("treats a titleless item list as a miss, not as a product", () => {
    expect(parseUpcItemDbResponse(200, { code: "OK", items: [{ brand: "Funko" }] })).toEqual({
      kind: "not_found",
    });
  });
});

describe("parseProductTitle", () => {
  it("pulls the figure and the box number out of the research fixture", () => {
    expect(parseProductTitle("Funko POP! Marvel Spider-Man Last Stand #1450 Vinyl Figure")).toEqual(
      { name: "Spider-Man Last Stand", popNumber: 1450 },
    );
  });

  it("handles the title the LIVE service actually returned for 889698636759", () => {
    // Recorded from the Phase 7 smoke, not invented: their catalogue titles are messier
    // than the tidy example above, and this is the shape the heuristic really meets.
    expect(parseProductTitle("Funko Pop! Marvel: M.A.Wish - Spider-Man Vinyl Bobblehead")).toEqual({
      name: "Spider-Man",
      popNumber: null,
    });
  });

  it("takes the segment behind the last separator — that is where the figure is", () => {
    expect(
      parseProductTitle("Funko Pop! Marvel: Spider-Man - Spider-Man (Last Stand) #1450"),
    ).toEqual({ name: "Spider-Man (Last Stand)", popNumber: 1450 });
  });

  it("reads the other spellings of a number", () => {
    expect(parseProductTitle("Funko Pop Venom No. 363").popNumber).toBe(363);
    expect(parseProductTitle("Funko Pop Venom Number 363").popNumber).toBe(363);
    expect(parseProductTitle("Funko Pop Venom # 363").popNumber).toBe(363);
  });

  it("keeps a name that only looks like packaging in the middle", () => {
    // "New" and "Brand" used to be stripped, which turned this title into "Day".
    expect(parseProductTitle("Funko Pop! Marvel: Spider-Man - Brand New Day").name).toBe(
      "Brand New Day",
    );
  });

  it("drops the measurements and the marketing", () => {
    expect(
      parseProductTitle('Funko Pop! Miles Morales 3.75" Vinyl Bobble-Head, Multicolor'),
    ).toEqual({ name: "Miles Morales", popNumber: null });
    expect(parseProductTitle("Funko Pop! Spider-Gwen (Styles May Vary)").name).toBe("Spider-Gwen");
  });

  it("gives up rather than inventing a name out of packaging words", () => {
    expect(parseProductTitle("Funko Pop! Vinyl Figure")).toEqual({ name: null, popNumber: null });
    expect(parseProductTitle("")).toEqual({ name: null, popNumber: null });
    expect(parseProductTitle(null)).toEqual({ name: null, popNumber: null });
  });

  it("survives a title that is nothing but a number", () => {
    expect(parseProductTitle("#1450")).toEqual({ name: null, popNumber: 1450 });
  });

  it("leaves a title it does not understand mostly intact", () => {
    expect(parseProductTitle("Spider-Man vs. Venom 2-Pack").name).toBe(
      "Spider-Man vs. Venom 2-Pack",
    );
  });
});
