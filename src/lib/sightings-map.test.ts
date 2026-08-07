import { describe, expect, it } from "vitest";

import { shelfEntry, SHELF_FIXTURE } from "@/test/fixtures";

import { lookupCity, projectEquirectangular } from "./geo";
import { buildSightingsMap, dominantCategory, sightingsMapCaption } from "./sightings-map";

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
