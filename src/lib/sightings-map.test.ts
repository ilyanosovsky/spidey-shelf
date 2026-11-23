import { describe, expect, it } from "vitest";

import { shelfEntry, SHELF_FIXTURE } from "@/test/fixtures";

import { lookupCity, projectEquirectangular } from "./geo";
import { type PublicShelfEntry } from "./showcase";
import {
  buildSightingsMap,
  dominantCategory,
  sightingCoordinate,
  sightingIconKind,
  sightingIconOffsets,
  sightingIconsLabel,
  sightingIcons,
  sightingsMapCaption,
} from "./sightings-map";

describe("dominantCategory", () => {
  it("picks the most common bucket", () => {
    expect(dominantCategory(["other", "peter", "other"])).toBe("other");
  });

  it("breaks ties by taxonomy order, so the answer never wobbles", () => {
    expect(dominantCategory(["other", "peter"])).toBe("peter");
    expect(dominantCategory(["peter", "other"])).toBe("peter");
    expect(dominantCategory(["friends_foes", "spider_verse"])).toBe("spider_verse");
  });

  it("has an answer for an empty city — all-zero is a tie, and ties go to `peter`", () => {
    expect(dominantCategory([])).toBe("peter");
  });
});

describe("buildSightingsMap", () => {
  it("clusters the shelf by city, busiest first", () => {
    const { markers } = buildSightingsMap(SHELF_FIXTURE);

    expect(markers.map((marker) => [marker.city, marker.count])).toEqual([
      ["MOSCOW", 2],
      ["BATUMI", 1],
      ["HAIFA", 1],
      ["LA", 1],
    ]);
  });

  it("never shows a staged figure — the fixture hides one in Munich", () => {
    const { markers, uncharted } = buildSightingsMap(SHELF_FIXTURE);
    expect(markers.some((marker) => marker.city === "MUNICH")).toBe(false);
    expect(uncharted).toEqual([]);
  });

  it("puts each marker where the dictionary says the city is", () => {
    const { markers } = buildSightingsMap(SHELF_FIXTURE);
    const moscow = markers.find((marker) => marker.city === "MOSCOW");
    expect(moscow?.point).toEqual(projectEquirectangular(lookupCity("RU", "Moscow")!));
  });

  it("colours a city by what most of it is", () => {
    const { markers } = buildSightingsMap([
      shelfEntry({ slug: "a", acquiredCity: "Moscow", acquiredCountry: "RU", category: "other" }),
      shelfEntry({ slug: "b", acquiredCity: "Moscow", acquiredCountry: "RU", category: "other" }),
      shelfEntry({ slug: "c", acquiredCity: "Moscow", acquiredCountry: "RU", category: "peter" }),
    ]);
    expect(markers[0].category).toBe("other");
  });

  it("still pins a figure that left the shelf — giving it away does not un-visit Batumi", () => {
    const { markers } = buildSightingsMap(SHELF_FIXTURE);
    expect(markers.find((marker) => marker.city === "BATUMI")?.count).toBe(1);
  });

  it("carries the flag for the legend", () => {
    const { markers } = buildSightingsMap(SHELF_FIXTURE);
    expect(markers.find((marker) => marker.city === "MOSCOW")?.flag).toBe("🇷🇺");
  });

  it("lists an unknown city under UNCHARTED instead of crashing", () => {
    const { markers, uncharted } = buildSightingsMap([
      shelfEntry({
        slug: "milan",
        name: "Spider-Man",
        acquiredCity: "Milan",
        acquiredCountry: "IT",
      }),
      shelfEntry({ slug: "nowhere", name: "Venom", acquiredCity: null, acquiredCountry: null }),
    ]);

    expect(markers).toEqual([]);
    expect(uncharted).toEqual([
      { slug: "milan", name: "Spider-Man", place: "MILAN, IT" },
      { slug: "nowhere", name: "Venom", place: "SOMEWHERE" },
    ]);
  });

  it("handles an empty shelf", () => {
    expect(buildSightingsMap([])).toEqual({ markers: [], uncharted: [] });
  });
});

/**
 * Phase 13 — the map reads the dictionary ∪ the columns the write path now fills (ADR-012).
 * Kuala Lumpur is the real case: bought from a phone in August 2026, and an UNCHARTED
 * SECTORS line until the row learned where it was.
 */
const KUALA_LUMPUR = { lat: 3.15, lng: 101.69 };

const klEntry = (overrides: Partial<PublicShelfEntry> = {}) =>
  shelfEntry({
    slug: "pop-marvel-spider-man-kl",
    name: "Spider-Man",
    acquiredCity: "Kuala Lumpur",
    acquiredCountry: "MY",
    acquiredLat: "3.15",
    acquiredLng: "101.69",
    ...overrides,
  });

describe("sightingCoordinate — the DB column, then the dictionary", () => {
  it("places a city the dictionary has never heard of", () => {
    expect(sightingCoordinate(klEntry())).toEqual(KUALA_LUMPUR);
  });

  it("falls back to the dictionary when the columns are NULL", () => {
    expect(sightingCoordinate(shelfEntry())).toEqual(lookupCity("IL", "Haifa"));
  });

  it("prefers the row's own columns over the dictionary", () => {
    const moved = shelfEntry({ acquiredLat: "1", acquiredLng: "2" });
    expect(sightingCoordinate(moved)).toEqual({ lat: 1, lng: 2 });
  });

  it("falls back rather than trusting half a coordinate or a bad one", () => {
    expect(sightingCoordinate(shelfEntry({ acquiredLat: "32.79", acquiredLng: null }))).toEqual(
      lookupCity("IL", "Haifa"),
    );
    expect(sightingCoordinate(shelfEntry({ acquiredLat: "abc", acquiredLng: "34.99" }))).toEqual(
      lookupCity("IL", "Haifa"),
    );
  });

  it("is null when neither source knows the place", () => {
    expect(sightingCoordinate(shelfEntry({ acquiredCity: "Milan", acquiredCountry: "IT" }))).toBe(
      null,
    );
  });
});

describe("buildSightingsMap with stored coordinates (Phase 13)", () => {
  it("pins a geocoded city that used to be an UNCHARTED line", () => {
    const { markers, uncharted } = buildSightingsMap([klEntry()]);

    expect(uncharted).toEqual([]);
    expect(markers).toHaveLength(1);
    expect(markers[0].city).toBe("KUALA LUMPUR");
    expect(markers[0].flag).toBe("🇲🇾");
    expect(markers[0].point).toEqual(projectEquirectangular(KUALA_LUMPUR));
  });

  it("adds it to the dictionary's cities rather than replacing them", () => {
    const { markers } = buildSightingsMap([...SHELF_FIXTURE, klEntry()]);

    expect(markers.map((marker) => marker.city)).toEqual([
      "MOSCOW",
      "BATUMI",
      "HAIFA",
      "KUALA LUMPUR",
      "LA",
    ]);
    expect(markers.find((marker) => marker.city === "HAIFA")?.point).toEqual(
      projectEquirectangular(lookupCity("IL", "Haifa")!),
    );
  });

  it("clusters one city even when only some of its rows carry coordinates", () => {
    // The state the shelf is genuinely in after a backfill: rows written before Phase 13
    // have NULL columns, and the city is placed by whichever row knows where it is.
    const { markers, uncharted } = buildSightingsMap([
      klEntry({ slug: "kl-old", acquiredLat: null, acquiredLng: null }),
      klEntry({ slug: "kl-new" }),
      klEntry({ slug: "kl-older", acquiredLat: null, acquiredLng: null }),
    ]);

    expect(uncharted).toEqual([]);
    expect(markers).toHaveLength(1);
    expect(markers[0].count).toBe(3);
    expect(markers[0].point).toEqual(projectEquirectangular(KUALA_LUMPUR));
  });

  it("takes the FIRST known coordinate, in shelf order", () => {
    const { markers } = buildSightingsMap([
      klEntry({ slug: "kl-a", acquiredLat: "3.15", acquiredLng: "101.69" }),
      klEntry({ slug: "kl-b", acquiredLat: "3.99", acquiredLng: "101.99" }),
    ]);

    expect(markers[0].point).toEqual(projectEquirectangular(KUALA_LUMPUR));
  });

  it("leaves a city UNCHARTED while none of its rows can be placed", () => {
    const { markers, uncharted } = buildSightingsMap([
      shelfEntry({
        slug: "milan-1",
        name: "Spider-Man",
        acquiredCity: "Milan",
        acquiredCountry: "IT",
      }),
      shelfEntry({ slug: "milan-2", name: "Venom", acquiredCity: "Milan", acquiredCountry: "IT" }),
    ]);

    expect(markers).toEqual([]);
    expect(uncharted.map((entry) => entry.slug)).toEqual(["milan-1", "milan-2"]);
  });

  it("never counts a staged row's coordinate — is_public is checked first", () => {
    const { markers, uncharted } = buildSightingsMap([
      klEntry({ slug: "kl-private", isPublic: false }),
    ]);

    expect(markers).toEqual([]);
    expect(uncharted).toEqual([]);
  });
});

/** Phase 14 — Veronika's two lines get their own icon beside the owner's spider. */
describe("sighting icons", () => {
  const amsterdam = (slug: string, category: PublicShelfEntry["category"]) =>
    shelfEntry({ slug, acquiredCity: "Amsterdam", acquiredCountry: "NL", category });

  it("maps a category to its kind", () => {
    expect(sightingIconKind("stitch")).toBe("stitch");
    expect(sightingIconKind("grogu")).toBe("grogu");
    expect(sightingIconKind("peter")).toBe("spider");
    expect(sightingIconKind("other")).toBe("spider");
    expect(sightingIconKind(null)).toBe("spider");
  });

  it("gives a mixed city three icons, in spider → stitch → grogu order, with their counts", () => {
    const { markers } = buildSightingsMap([
      amsterdam("g", "grogu"),
      amsterdam("s", "stitch"),
      amsterdam("p1", "peter"),
      amsterdam("v", "spider_verse"),
      amsterdam("p2", "peter"),
    ]);

    expect(markers).toHaveLength(1);
    expect(markers[0].count).toBe(5);
    expect(markers[0].icons).toEqual([
      { kind: "spider", count: 3, category: "peter" },
      { kind: "stitch", count: 1, category: "stitch" },
      { kind: "grogu", count: 1, category: "grogu" },
    ]);
  });

  it("gives a spider-only city exactly one icon, coloured as the whole city always was", () => {
    const { markers } = buildSightingsMap(SHELF_FIXTURE);
    const moscow = markers.find((marker) => marker.city === "MOSCOW");
    expect(moscow?.icons).toEqual([{ kind: "spider", count: 2, category: moscow?.category }]);
    for (const marker of markers) expect(marker.icons).toHaveLength(1);
  });

  it("never lists a kind that is absent", () => {
    expect(sightingIcons(["stitch", "stitch"])).toEqual([
      { kind: "stitch", count: 2, category: "stitch" },
    ]);
    expect(sightingIcons([])).toEqual([]);
  });

  it("colours the spider by the owner's figures only", () => {
    expect(sightingIcons(["other", "stitch", "stitch", "stitch"])[0]).toEqual({
      kind: "spider",
      count: 1,
      category: "other",
    });
  });

  it("reads naturally for a screen reader", () => {
    expect(
      sightingIconsLabel([
        { kind: "spider", count: 3, category: "peter" },
        { kind: "stitch", count: 1, category: "stitch" },
        { kind: "grogu", count: 1, category: "grogu" },
      ]),
    ).toBe("3 spiders, 1 Stitch, 1 Grogu");
    expect(
      sightingIconsLabel([
        { kind: "spider", count: 1, category: "peter" },
        { kind: "stitch", count: 2, category: "stitch" },
        { kind: "grogu", count: 4, category: "grogu" },
      ]),
    ).toBe("1 spider, 2 Stitches, 4 Grogus");
  });

  it("centres the icon group on the city — one icon sits exactly on it", () => {
    expect(sightingIconOffsets(1)).toEqual([0]);
    const [left, middle, right] = sightingIconOffsets(3);
    expect(middle).toBe(0);
    expect(left).toBe(-right);
    expect(right - middle).toBeGreaterThan(5.8); // wider than a plate: icons never overlap
  });
});

describe("sightingsMapCaption", () => {
  it("counts cities and sightings", () => {
    expect(sightingsMapCaption(buildSightingsMap(SHELF_FIXTURE))).toBe("4 CITIES · 5 SIGHTINGS");
  });

  it("gets the singulars right", () => {
    const one = buildSightingsMap([shelfEntry()]);
    expect(sightingsMapCaption(one)).toBe("1 CITY · 1 SIGHTING");
  });

  it("says nothing rather than `0 CITIES`", () => {
    expect(sightingsMapCaption({ markers: [], uncharted: [] })).toBe("NO PLACES LOGGED YET");
  });
});
