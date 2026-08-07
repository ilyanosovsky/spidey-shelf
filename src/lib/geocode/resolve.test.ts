import { describe, expect, it, vi } from "vitest";

import { lookupCity } from "../geo";
import {
  coordinateColumns,
  knownCityCoordinate,
  resolveCityCoordinate,
  type KnownPlace,
} from "./resolve";

/**
 * The budget, as tests. Every case here is really one assertion — **was the network touched?**
 * — because that is the promise ADR-012 makes to the OSM Foundation's usage policy: one
 * request per city the collection has never been to, and nothing at all otherwise.
 */

const KUALA_LUMPUR = { lat: 3.15, lng: 101.69 };

/** A geocoder that answers, so "it was not called" is never a false pass. */
function geocoder(answer: { lat: number; lng: number } | null = KUALA_LUMPUR) {
  return vi.fn(async () => answer);
}

const SHELF: KnownPlace[] = [
  { country: "MY", city: "Kuala Lumpur", lat: "3.15", lng: "101.69" },
  { country: "IT", city: "Milan", lat: null, lng: null },
];

describe("knownCityCoordinate", () => {
  it("answers from the dictionary first — the founding nine are hand-checked", () => {
    expect(knownCityCoordinate("IL", "Haifa", [])).toEqual(lookupCity("IL", "Haifa"));
  });

  it("prefers the dictionary over a row that disagrees with it", () => {
    const wrong: KnownPlace[] = [{ country: "IL", city: "Haifa", lat: "0", lng: "0" }];
    expect(knownCityCoordinate("IL", "Haifa", wrong)).toEqual(lookupCity("IL", "Haifa"));
  });

  it("falls back to a row already on the shelf", () => {
    expect(knownCityCoordinate("MY", "Kuala Lumpur", SHELF)).toEqual(KUALA_LUMPUR);
  });

  it("matches a shelf row on the map's own normaliser, not on the raw string", () => {
    expect(knownCityCoordinate("my", "  KUALA LUMPUR ", SHELF)).toEqual(KUALA_LUMPUR);
  });

  it("ignores a row whose coordinates are null — that is the row we are here to fill", () => {
    expect(knownCityCoordinate("IT", "Milan", SHELF)).toBeNull();
  });

  it("is null for a place nobody has been to", () => {
    expect(knownCityCoordinate("PT", "Lisbon", SHELF)).toBeNull();
  });

  it("is null when there is no place at all", () => {
    expect(knownCityCoordinate(null, null, SHELF)).toBeNull();
    expect(knownCityCoordinate("MY", "", SHELF)).toBeNull();
  });
});

describe("resolveCityCoordinate — the skip logic, in order", () => {
  it("a dictionary hit makes ZERO network calls", async () => {
    const geocode = geocoder();

    await expect(resolveCityCoordinate("IL", "Haifa", SHELF, geocode)).resolves.toEqual(
      lookupCity("IL", "Haifa"),
    );
    expect(geocode).not.toHaveBeenCalled();
  });

  it("a dictionary ALIAS hit makes zero calls too — `München` is `Munich`", async () => {
    const geocode = geocoder();

    await expect(resolveCityCoordinate("DE", "München", [], geocode)).resolves.toEqual(
      lookupCity("DE", "Munich"),
    );
    expect(geocode).not.toHaveBeenCalled();
  });

  it("a prior row hit makes zero network calls — the second figure from a city is free", async () => {
    const geocode = geocoder();

    await expect(resolveCityCoordinate("MY", "Kuala Lumpur", SHELF, geocode)).resolves.toEqual(
      KUALA_LUMPUR,
    );
    expect(geocode).not.toHaveBeenCalled();
  });

  it("a miss geocodes ONCE, with the alpha-2 code and the owner's own spelling", async () => {
    const geocode = geocoder({ lat: 38.72, lng: -9.14 });

    await expect(resolveCityCoordinate("PT", " Lisbon ", SHELF, geocode)).resolves.toEqual({
      lat: 38.72,
      lng: -9.14,
    });
    expect(geocode).toHaveBeenCalledOnce();
    expect(geocode).toHaveBeenCalledWith("pt", "Lisbon");
  });

  it("never geocodes a row with no city — that is not a question a gazetteer can answer", async () => {
    const geocode = geocoder();

    await expect(resolveCityCoordinate("MY", null, SHELF, geocode)).resolves.toBeNull();
    await expect(resolveCityCoordinate(null, "Kuala Lumpur", SHELF, geocode)).resolves.toBeNull();
    await expect(resolveCityCoordinate(null, null, SHELF, geocode)).resolves.toBeNull();
    expect(geocode).not.toHaveBeenCalled();
  });

  it("a geocoder that found nothing is a null coordinate, not an error", async () => {
    await expect(resolveCityCoordinate("PT", "Lisbon", SHELF, geocoder(null))).resolves.toBeNull();
  });

  it("a geocoder that THREW is a null coordinate too — the save must not fail", async () => {
    const geocode = vi.fn(async () => {
      throw new Error("ECONNRESET");
    });

    await expect(resolveCityCoordinate("PT", "Lisbon", SHELF, geocode)).resolves.toBeNull();
  });
});

describe("coordinateColumns", () => {
  it("writes strings, because the columns are `numeric` and a float would round", () => {
    expect(coordinateColumns(KUALA_LUMPUR)).toEqual({ acquiredLat: "3.15", acquiredLng: "101.69" });
  });

  it("keeps a dictionary value at its own precision — rounding happens at the geocoder", () => {
    expect(coordinateColumns(lookupCity("IL", "Haifa"))).toEqual({
      acquiredLat: "32.794",
      acquiredLng: "34.99",
    });
  });

  it("is two NULLs when there is no coordinate — the state every row had before Phase 13", () => {
    expect(coordinateColumns(null)).toEqual({ acquiredLat: null, acquiredLng: null });
  });
});
