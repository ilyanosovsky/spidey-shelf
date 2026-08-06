import { describe, expect, it } from "vitest";

import { SHELF_FIXTURE, shelfEntry } from "@/test/fixtures";

import {
  DEFAULT_SHELF_FILTER,
  SHELF_TABS,
  filterShelf,
  findShelfNeighbours,
  hasLeftTheShelf,
  isNewSighting,
  latestSightingLine,
  newSightings,
  parseShelfFilter,
  shelfHref,
} from "./showcase";

describe("parseShelfFilter", () => {
  it("reads a known category", () => {
    expect(parseShelfFilter("peter")).toBe("peter");
    expect(parseShelfFilter("spider_verse")).toBe("spider_verse");
    expect(parseShelfFilter("friends_foes")).toBe("friends_foes");
    expect(parseShelfFilter("other")).toBe("other");
    expect(parseShelfFilter("all")).toBe("all");
  });

  it("is forgiving about case and padding", () => {
    expect(parseShelfFilter(" PETER ")).toBe("peter");
  });

  it("falls back to ALL for anything else", () => {
    expect(parseShelfFilter(undefined)).toBe(DEFAULT_SHELF_FILTER);
    expect(parseShelfFilter("")).toBe("all");
    expect(parseShelfFilter("villains")).toBe("all");
    expect(parseShelfFilter("'; drop table owned_figures;--")).toBe("all");
  });

  it("takes the first value when the param repeats", () => {
    expect(parseShelfFilter(["other", "peter"])).toBe("other");
  });
});

describe("SHELF_TABS", () => {
  it("is ALL plus the four buckets, in taxonomy order", () => {
    expect(SHELF_TABS.map((tab) => tab.value)).toEqual([
      "all",
      "peter",
      "spider_verse",
      "friends_foes",
      "other",
    ]);
    expect(SHELF_TABS.map((tab) => tab.label)).toEqual([
      "ALL",
      "PETER PARKER",
      "SPIDER-VERSE",
      "FRIENDS & FOES",
      "OTHER",
    ]);
  });
});

describe("shelfHref", () => {
  it("keeps the default out of the URL", () => {
    expect(shelfHref("all")).toBe("/");
    expect(shelfHref("peter")).toBe("/?cat=peter");
  });
});

describe("filterShelf", () => {
  it("never returns a row the owner staged as private", () => {
    const slugs = filterShelf(SHELF_FIXTURE).map((entry) => entry.slug);
    expect(slugs).not.toContain("pop-marvel-spider-man-hidden-1111");
    expect(slugs).toHaveLength(SHELF_FIXTURE.length - 1);
  });

  it("hides private rows inside a category too", () => {
    const peter = filterShelf(SHELF_FIXTURE, "peter");
    expect(peter.every((entry) => entry.isPublic)).toBe(true);
    expect(peter.map((entry) => entry.popNumber)).toEqual([1239, 1450, 3]);
  });

  it("filters by category", () => {
    expect(filterShelf(SHELF_FIXTURE, "spider_verse").map((entry) => entry.popNumber)).toEqual([
      1412,
    ]);
    expect(filterShelf(SHELF_FIXTURE, "other").map((entry) => entry.popNumber)).toEqual([1570]);
    expect(filterShelf(SHELF_FIXTURE, "friends_foes")).toEqual([]);
  });

  it("defaults to the whole shelf", () => {
    expect(filterShelf(SHELF_FIXTURE)).toEqual(filterShelf(SHELF_FIXTURE, "all"));
  });

  it("keeps the incoming order", () => {
    expect(filterShelf(SHELF_FIXTURE).map((entry) => entry.acquiredAt)).toEqual([
      "2026-01-05",
      "2025-12-31",
      "2025-04-12",
      "2025-03-06",
      "2023-12-28",
    ]);
  });
});

describe("newSightings", () => {
  it("takes the head of the shelf and skips private rows", () => {
    expect(newSightings(SHELF_FIXTURE, 3).map((entry) => entry.popNumber)).toEqual([
      1239, 1570, 1450,
    ]);
  });

  it("never asks for more than there is", () => {
    expect(newSightings([], 5)).toEqual([]);
    expect(newSightings(SHELF_FIXTURE, 0)).toEqual([]);
    expect(newSightings(SHELF_FIXTURE, 99)).toHaveLength(5);
  });

  it("marks exactly the entries it returned", () => {
    const [newest] = newSightings(SHELF_FIXTURE, 2);
    const oldest = SHELF_FIXTURE[SHELF_FIXTURE.length - 1];
    expect(isNewSighting(newest, SHELF_FIXTURE, 2)).toBe(true);
    expect(isNewSighting(oldest, SHELF_FIXTURE, 2)).toBe(false);
  });
});

describe("hasLeftTheShelf", () => {
  it("is true only for not_mine_anymore", () => {
    expect(hasLeftTheShelf(shelfEntry({ status: "not_mine_anymore" }))).toBe(true);
    expect(hasLeftTheShelf(shelfEntry({ status: "mine" }))).toBe(false);
    expect(hasLeftTheShelf(shelfEntry({ status: null }))).toBe(false);
  });
});

describe("findShelfNeighbours", () => {
  it("walks the shelf in acquisition order", () => {
    const found = findShelfNeighbours(SHELF_FIXTURE, "pop-marvel-spider-man-last-stand-1450");
    expect(found?.current.popNumber).toBe(1450);
    expect(found?.previous.popNumber).toBe(1570);
    expect(found?.next.popNumber).toBe(1412);
  });

  it("wraps around at both ends", () => {
    const newest = findShelfNeighbours(SHELF_FIXTURE, "pop-marvel-peter-b-parker-mayday-1239");
    expect(newest?.previous.popNumber).toBe(3);

    const oldest = findShelfNeighbours(SHELF_FIXTURE, "pop-marvel-spider-man-3");
    expect(oldest?.next.popNumber).toBe(1239);
  });

  it("makes a lone figure its own neighbour", () => {
    const only = shelfEntry({ slug: "only" });
    const found = findShelfNeighbours([only], "only");
    expect(found?.previous.slug).toBe("only");
    expect(found?.next.slug).toBe("only");
  });

  it("does not find a private row or an unknown slug", () => {
    expect(findShelfNeighbours(SHELF_FIXTURE, "pop-marvel-spider-man-hidden-1111")).toBeNull();
    expect(findShelfNeighbours(SHELF_FIXTURE, "nope")).toBeNull();
  });
});

describe("latestSightingLine", () => {
  it("reads the newest acquisition", () => {
    expect(latestSightingLine(SHELF_FIXTURE)).toBe(
      "LATEST SIGHTING: PETER B. PARKER & MAYDAY #1239 · \u{1F1F7}\u{1F1FA} MOSCOW · JAN 2026",
    );
  });

  it("drops the parts a row does not have", () => {
    expect(
      latestSightingLine([
        shelfEntry({ name: "Spider-Man", popNumber: 3, acquiredCity: null, acquiredCountry: null }),
      ]),
    ).toBe("LATEST SIGHTING: SPIDER-MAN #3 · DEC 2023");
  });

  it("has something to say about an empty shelf", () => {
    expect(latestSightingLine([])).toMatch(/NO SIGHTINGS LOGGED YET/);
  });
});
