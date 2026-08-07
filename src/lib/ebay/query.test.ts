import { describe, expect, it } from "vitest";

import { EBAY_SEARCH_LIMIT, ebaySearchQuery, ebaySearchUrl } from "./query";

describe("ebaySearchQuery", () => {
  it("names the hobby, the figure and the box number", () => {
    expect(ebaySearchQuery("Spider-Man", 1450)).toBe("Funko Pop Spider-Man 1450");
  });

  it("keeps the hyphen — `Spider-Man` is the character's name, not two words", () => {
    expect(ebaySearchQuery("Peter B. Parker & Mayday", 1239)).toBe(
      "Funko Pop Peter B Parker Mayday 1239",
    );
  });

  it("strips brackets, which eBay's search reads as syntax", () => {
    expect(ebaySearchQuery("Spider-Man (Fear Itself Suit)", 1445)).toBe(
      "Funko Pop Spider-Man Fear Itself Suit 1445",
    );
  });

  it("copes with a figure that has no number", () => {
    expect(ebaySearchQuery("Spider-Man: No Way Home (3 Pack)", null)).toBe(
      "Funko Pop Spider-Man No Way Home 3 Pack",
    );
    expect(ebaySearchQuery("Venom", undefined)).toBe("Funko Pop Venom");
  });

  it("collapses whitespace so the query is stable", () => {
    expect(ebaySearchQuery("  Spider-Man   Last  Stand ", 1450)).toBe(
      "Funko Pop Spider-Man Last Stand 1450",
    );
  });
});

describe("ebaySearchUrl", () => {
  it("points at Buy It Now, the same population the median came from", () => {
    const url = new URL(ebaySearchUrl("Funko Pop Spider-Man 1450"));
    expect(url.host).toBe("www.ebay.com");
    expect(url.searchParams.get("_nkw")).toBe("Funko Pop Spider-Man 1450");
    expect(url.searchParams.get("LH_BIN")).toBe("1");
  });

  it("encodes a query that would otherwise break the URL", () => {
    const url = ebaySearchUrl("Funko Pop Spider-Man & Venom #3");
    expect(url).not.toContain(" ");
    expect(new URL(url).searchParams.get("_nkw")).toBe("Funko Pop Spider-Man & Venom #3");
  });
});

describe("the sample size", () => {
  it("is a page a human would look at, not a census", () => {
    expect(EBAY_SEARCH_LIMIT).toBeGreaterThan(9);
    expect(EBAY_SEARCH_LIMIT).toBeLessThanOrEqual(50);
  });
});
