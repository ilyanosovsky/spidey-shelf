import { describe, expect, it } from "vitest";

import { catalogFigure, WISHLIST_FIXTURE } from "@/test/fixtures";

import {
  DEFAULT_WISHLIST_FILTER,
  filterWishlist,
  orderWishlist,
  parseWishlistFilter,
  wantedHeadline,
  wishlistHref,
  wishlistTabs,
} from "./wishlist";

describe("parseWishlistFilter", () => {
  it("lands on PETER PARKER, not ALL", () => {
    expect(DEFAULT_WISHLIST_FILTER).toBe("peter");
    expect(parseWishlistFilter(undefined)).toBe("peter");
    expect(parseWishlistFilter("")).toBe("peter");
    expect(parseWishlistFilter("villains")).toBe("peter");
  });

  it("reads the known tabs", () => {
    expect(parseWishlistFilter("all")).toBe("all");
    expect(parseWishlistFilter("spider_verse")).toBe("spider_verse");
    expect(parseWishlistFilter(" FRIENDS_FOES ")).toBe("friends_foes");
  });

  it("takes the first value when the param repeats", () => {
    expect(parseWishlistFilter(["other", "peter"])).toBe("other");
  });
});

describe("wishlistHref", () => {
  it("keeps the default tab out of the address bar", () => {
    expect(wishlistHref("peter")).toBe("/wishlist");
    expect(wishlistHref("all")).toBe("/wishlist?cat=all");
    expect(wishlistHref("other")).toBe("/wishlist?cat=other");
  });
});

describe("filterWishlist", () => {
  it("filters by bucket", () => {
    expect(filterWishlist(WISHLIST_FIXTURE, "spider_verse")).toHaveLength(2);
    expect(filterWishlist(WISHLIST_FIXTURE, "other")).toHaveLength(1);
    expect(filterWishlist(WISHLIST_FIXTURE, "all")).toHaveLength(WISHLIST_FIXTURE.length);
  });

  it("defaults to the peter bucket", () => {
    expect(filterWishlist(WISHLIST_FIXTURE).map((figure) => figure.popNumber)).toEqual([null, 334]);
  });
});

describe("orderWishlist", () => {
  it("sorts by box number, low to high", () => {
    expect(orderWishlist(WISHLIST_FIXTURE).map((figure) => figure.popNumber)).toEqual([
      334,
      363,
      402,
      402,
      1572,
      null,
    ]);
  });

  it("breaks a shared number by name", () => {
    const shared = orderWishlist(WISHLIST_FIXTURE).filter((figure) => figure.popNumber === 402);
    expect(shared.map((figure) => figure.name)).toEqual([
      "Miles Morales",
      "Miles Morales Translucent",
    ]);
  });

  it("puts the numberless multi-packs last, sorted among themselves", () => {
    const packs = [
      catalogFigure({ slug: "z-pack", name: "Zebra Pack", popNumber: null }),
      catalogFigure({ slug: "a-pack", name: "Alpha Pack", popNumber: null }),
      catalogFigure({ slug: "three", name: "Spider-Man", popNumber: 3 }),
    ];
    expect(orderWishlist(packs).map((figure) => figure.name)).toEqual([
      "Spider-Man",
      "Alpha Pack",
      "Zebra Pack",
    ]);
  });

  it("does not mutate the input", () => {
    const input = [...WISHLIST_FIXTURE];
    orderWishlist(input);
    expect(input).toEqual(WISHLIST_FIXTURE);
  });
});

describe("wishlistTabs", () => {
  it("is ALL plus every bucket with its count, minus Veronika's empty lines", () => {
    expect(wishlistTabs(WISHLIST_FIXTURE)).toEqual([
      { value: "all", label: "ALL", count: 6 },
      { value: "peter", label: "PETER PARKER", count: 2 },
      { value: "spider_verse", label: "SPIDER-VERSE", count: 2 },
      { value: "friends_foes", label: "FRIENDS & FOES", count: 1 },
      { value: "other", label: "OTHER", count: 1 },
    ]);
  });

  it("keeps a Spidey bucket at zero but drops a STITCH or GROGU tab with nothing in it", () => {
    // Her lines have no hunt catalog — only what is already on the shelf is catalogued — so
    // an always-zero tab would be noise. An empty PETER PARKER tab is a brag; it stays.
    const tabs = wishlistTabs([]);
    expect(tabs.map((tab) => tab.value)).toEqual([
      "all",
      "peter",
      "spider_verse",
      "friends_foes",
      "other",
    ]);
    expect(tabs.every((tab) => tab.count === 0)).toBe(true);
  });

  it("shows a STITCH or GROGU tab as soon as an unowned one is catalogued", () => {
    const tabs = wishlistTabs([
      ...WISHLIST_FIXTURE,
      catalogFigure({ slug: "stitch-x", name: "Stitch", category: "stitch" }),
      catalogFigure({ slug: "grogu-x", name: "Grogu", category: "grogu" }),
      catalogFigure({ slug: "grogu-y", name: "Grogu (Cookie)", category: "grogu" }),
    ]);

    expect(tabs.find((tab) => tab.value === "stitch")).toEqual({
      value: "stitch",
      label: "STITCH",
      count: 1,
    });
    expect(tabs.find((tab) => tab.value === "grogu")).toEqual({
      value: "grogu",
      label: "GROGU",
      count: 2,
    });
    // Still in taxonomy order: her lines sit between FRIENDS & FOES and OTHER.
    expect(tabs.map((tab) => tab.value)).toEqual([
      "all",
      "peter",
      "spider_verse",
      "friends_foes",
      "stitch",
      "grogu",
      "other",
    ]);
  });
});

describe("wantedHeadline", () => {
  it("counts the peter bucket, whatever tab is open", () => {
    expect(wantedHeadline(WISHLIST_FIXTURE)).toBe("WANTED: 2 SPIDERS STILL OUT THERE");
    expect(wantedHeadline([])).toBe("WANTED: 0 SPIDERS STILL OUT THERE");
  });
});
