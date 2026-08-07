import { describe, expect, it } from "vitest";

import {
  CITY_COORDINATES,
  CITY_DISPLAY_NAMES,
  cityKey,
  dictionaryCitiesFor,
  dictionaryCountries,
  graticule,
  GRATICULE_STEP,
  hairline,
  lookupCity,
  MAP_ASPECT,
  MAP_MIN_SPAN,
  mapBounds,
  markerCell,
  normalizeCityName,
  projectEquirectangular,
  viewBoxOf,
  WORLD_BOUNDS,
  type MapPoint,
} from "./geo";

const point = (lng: number, lat: number): MapPoint => projectEquirectangular({ lat, lng });

describe("normalizeCityName", () => {
  it("folds case, spacing and punctuation", () => {
    expect(normalizeCityName("  T'bilisi ")).toBe("tbilisi");
    expect(normalizeCityName("PALMA  DE   MALLORCA")).toBe("palma de mallorca");
  });

  it("strips diacritics, because the owner types on a phone", () => {
    expect(normalizeCityName("München")).toBe("munchen");
    expect(normalizeCityName("Munich")).toBe("munich");
  });

  it("survives nothing at all", () => {
    expect(normalizeCityName(null)).toBe("");
    expect(normalizeCityName(undefined)).toBe("");
    expect(normalizeCityName("   ")).toBe("");
  });
});

describe("cityKey", () => {
  it("joins a country code and a city", () => {
    expect(cityKey("IL", "Haifa")).toBe("il:haifa");
    expect(cityKey(" us ", "Los Angeles")).toBe("us:los angeles");
  });

  it("refuses anything that is not an alpha-2 country plus a city", () => {
    expect(cityKey("USA", "Los Angeles")).toBe("");
    expect(cityKey("US", "")).toBe("");
    expect(cityKey(null, "Haifa")).toBe("");
  });
});

describe("lookupCity", () => {
  it("knows every city the collection came from", () => {
    const places: [string, string][] = [
      ["IL", "Haifa"],
      ["DE", "Munich"],
      ["GE", "Tbilisi"],
      ["GE", "Batumi"],
      ["RU", "Moscow"],
      ["US", "LA"],
      ["ES", "Madrid"],
      ["ES", "Mallorca"],
      ["NL", "Amsterdam"],
    ];

    for (const [country, city] of places) {
      expect(lookupCity(country, city), `${city}, ${country}`).not.toBeNull();
    }
  });

  it("resolves the aliases to the same coordinate", () => {
    expect(lookupCity("US", "LA")).toEqual(lookupCity("US", "Los Angeles"));
    expect(lookupCity("ES", "Mallorca")).toEqual(lookupCity("ES", "Palma"));
    expect(lookupCity("DE", "München")).toEqual(lookupCity("DE", "Munich"));
  });

  it("returns null rather than guessing", () => {
    expect(lookupCity("IT", "Milan")).toBeNull();
    expect(lookupCity("XX", "Nowhere")).toBeNull();
    expect(lookupCity(null, null)).toBeNull();
  });

  it("holds only sane coordinates", () => {
    for (const [key, { lat, lng }] of Object.entries(CITY_COORDINATES)) {
      expect(Math.abs(lat), key).toBeLessThanOrEqual(90);
      expect(Math.abs(lng), key).toBeLessThanOrEqual(180);
    }
  });
});

describe("projectEquirectangular", () => {
  it("puts 0°/0° in the middle of the world", () => {
    expect(projectEquirectangular({ lat: 0, lng: 0 })).toEqual({ x: 180, y: 90 });
  });

  it("puts the corners where the corners are", () => {
    expect(projectEquirectangular({ lat: 90, lng: -180 })).toEqual({ x: 0, y: 0 });
    expect(projectEquirectangular({ lat: -90, lng: 180 })).toEqual({ x: 360, y: 180 });
  });

  it("wraps longitude and clamps latitude", () => {
    // 190°E is 170°W, which is a real place; 100°N is not.
    expect(projectEquirectangular({ lat: 0, lng: 190 }).x).toBeCloseTo(10);
    expect(projectEquirectangular({ lat: 100, lng: 0 }).y).toBe(0);
    expect(projectEquirectangular({ lat: -100, lng: 0 }).y).toBe(180);
  });
});

describe("mapBounds", () => {
  it("shows the whole world when there is nothing to show", () => {
    expect(mapBounds([])).toEqual({ ...WORLD_BOUNDS });
  });

  it("never zooms a single city to a pixel", () => {
    const bounds = mapBounds([point(37.6, 55.8)]);
    expect(bounds.width).toBeGreaterThanOrEqual(MAP_MIN_SPAN);
    expect(bounds.height).toBeGreaterThanOrEqual(MAP_MIN_SPAN);
  });

  it("holds every marker inside the crop", () => {
    const points = [point(-118.2, 34.1), point(44.8, 41.7), point(4.9, 52.4), point(35, 32.8)];
    const bounds = mapBounds(points);

    for (const { x, y } of points) {
      expect(x).toBeGreaterThanOrEqual(bounds.x);
      expect(x).toBeLessThanOrEqual(bounds.x + bounds.width);
      expect(y).toBeGreaterThanOrEqual(bounds.y);
      expect(y).toBeLessThanOrEqual(bounds.y + bounds.height);
    }
  });

  it("leaves air around the outermost markers", () => {
    const points = [point(0, 40), point(20, 50)];
    const bounds = mapBounds(points);
    expect(bounds.x).toBeLessThan(point(0, 40).x);
    expect(bounds.x + bounds.width).toBeGreaterThan(point(20, 50).x);
  });

  it("refuses to become a letterbox slit", () => {
    // Los Angeles to Tbilisi is 163° of longitude and 8° of latitude: a 20:1 strip.
    const bounds = mapBounds([point(-118.2, 34.1), point(44.8, 41.7)]);
    const aspect = bounds.width / bounds.height;
    expect(aspect).toBeLessThanOrEqual(MAP_ASPECT.max + 0.001);
    expect(aspect).toBeGreaterThanOrEqual(MAP_ASPECT.min - 0.001);
  });

  it("never runs off the edge of the world", () => {
    for (const points of [[point(-179, 89)], [point(179, -89)], [point(-179, 0), point(179, 0)]]) {
      const bounds = mapBounds(points);
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.y).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(WORLD_BOUNDS.width + 0.001);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(WORLD_BOUNDS.height + 0.001);
    }
  });
});

describe("viewBoxOf", () => {
  it("prints four numbers", () => {
    expect(viewBoxOf({ x: 55, y: 30, width: 175, height: 35 })).toBe("55 30 175 35");
  });

  it("rounds so the markup does not wobble on floating point noise", () => {
    expect(viewBoxOf({ x: 0.123456, y: 1.987654, width: 10, height: 5 })).toBe("0.12 1.99 10 5");
  });
});

describe("graticule", () => {
  it("keeps the lines on the global 30° lattice", () => {
    const { meridians, parallels } = graticule({ x: 55, y: 30, width: 175, height: 60 });
    for (const value of [...meridians, ...parallels]) {
      expect(value % GRATICULE_STEP).toBe(0);
    }
    expect(meridians[0]).toBe(60);
    expect(parallels[0]).toBe(30);
  });

  it("only returns lines the crop can actually see", () => {
    const { meridians, parallels } = graticule({ x: 61, y: 31, width: 20, height: 20 });
    expect(meridians).toEqual([]);
    expect(parallels).toEqual([]);
  });

  it("covers the whole world with the full lattice", () => {
    const { meridians, parallels } = graticule(WORLD_BOUNDS);
    expect(meridians).toEqual([0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330, 360]);
    expect(parallels).toEqual([0, 30, 60, 90, 120, 150, 180]);
  });
});

describe("marker and line sizing", () => {
  it("scales with the crop, so a marker is the same share of any panel", () => {
    const wide = { x: 0, y: 0, width: 200, height: 100 };
    const tight = { x: 0, y: 0, width: 50, height: 25 };
    expect(markerCell(wide) / wide.width).toBeCloseTo(markerCell(tight) / tight.width);
    expect(hairline(wide) / wide.width).toBeCloseTo(hairline(tight) / tight.width);
  });

  it("keeps a five-cell spider a small fraction of the map", () => {
    const bounds = { x: 0, y: 0, width: 200, height: 100 };
    expect((markerCell(bounds) * 5) / bounds.width).toBeLessThan(0.06);
    expect(hairline(bounds)).toBeLessThan(markerCell(bounds));
  });
});

describe("the display names (Phase 12) — what the CITY combobox offers", () => {
  it("names only cities the dictionary can actually pin", () => {
    for (const key of Object.keys(CITY_DISPLAY_NAMES)) {
      expect(CITY_COORDINATES[key]).toBeDefined();
    }
  });

  it("round-trips: every suggestion resolves back to its own coordinate", () => {
    for (const [key, name] of Object.entries(CITY_DISPLAY_NAMES)) {
      const [country] = key.split(":");
      expect(lookupCity(country, name)).toEqual(CITY_COORDINATES[key]);
    }
  });

  it("offers one entry per real place, never an alias — that is the point of the subset", () => {
    // `de:munchen`, `us:la`, `es:mallorca` and `es:palma` exist so the shelf's own spellings
    // resolve; suggesting them back would invite a second spelling of the same city.
    const pins = Object.keys(CITY_DISPLAY_NAMES).map((key) => {
      const point = CITY_COORDINATES[key];
      return `${point.lat},${point.lng}`;
    });
    expect(new Set(pins).size).toBe(pins.length);
  });

  it("answers one country at a time, alphabetically", () => {
    expect(dictionaryCitiesFor("GE")).toEqual(["Batumi", "Tbilisi"]);
    expect(dictionaryCitiesFor("ge")).toEqual(["Batumi", "Tbilisi"]);
    expect(dictionaryCitiesFor("IL")).toEqual(["Haifa"]);
  });

  it("has nothing to say about a country nobody has been to, and does not throw", () => {
    expect(dictionaryCitiesFor("PT")).toEqual([]);
    expect(dictionaryCitiesFor("")).toEqual([]);
    expect(dictionaryCitiesFor(null)).toEqual([]);
    expect(dictionaryCitiesFor("Georgia")).toEqual([]);
  });

  it("lists its countries uppercase, which is how the column stores them", () => {
    expect(dictionaryCountries()).toEqual(["DE", "ES", "GE", "IL", "NL", "RU", "US"]);
  });
});
