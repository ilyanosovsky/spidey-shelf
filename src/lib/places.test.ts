import { describe, expect, it } from "vitest";

import { citySuggestionIndex, citySuggestions } from "./places";

/** The shelf's own places, in the shape `listUsedPlaces()` returns. */
const SHELF = [
  { city: "Haifa", country: "IL" },
  { city: "Tbilisi", country: "GE" },
  { city: "LA", country: "US" },
  { city: "Lisbon", country: "PT" },
];

describe("citySuggestions", () => {
  it("unions the shelf's own cities with the map dictionary's, for one country", () => {
    expect(citySuggestions("GE", SHELF)).toEqual(["Batumi", "Tbilisi"]);
  });

  it("offers a dictionary city in a country the shelf has never visited", () => {
    expect(citySuggestions("NL", SHELF)).toEqual(["Amsterdam"]);
    expect(citySuggestions("ES", SHELF)).toEqual(["Madrid", "Palma de Mallorca"]);
  });

  it("keeps a city the map cannot place — a new place is the point of a travel log", () => {
    expect(citySuggestions("PT", SHELF)).toEqual(["Lisbon"]);
  });

  it("prefers the owner's own spelling over the dictionary's canonical one", () => {
    // `LA` is how this collection spells Los Angeles, and `geo.ts` resolves it; offering
    // both would invite a second spelling of a place that is already on the map.
    expect(citySuggestions("US", SHELF)).toEqual(["LA"]);
  });

  it("dedupes on the map's own normaliser, so a case change cannot double an entry", () => {
    const shelf = [
      { city: "Tbilisi", country: "GE" },
      { city: "T'BILISI", country: "GE" },
    ];
    expect(citySuggestions("GE", shelf)).toEqual(["Batumi", "Tbilisi"]);
  });

  it("dedupes on the COORDINATE too, so an alias cannot split one city into two", () => {
    // `de:munchen` and `de:munich` are the same pin in `geo.ts`, spelled two ways.
    expect(citySuggestions("DE", [{ city: "München", country: "DE" }])).toEqual(["München"]);
    // Same rule, and it is why `LA` alone comes back for the United States.
    expect(citySuggestions("US", [{ city: "LA", country: "US" }])).toEqual(["LA"]);
  });

  it("takes the country in any spelling the field accepts", () => {
    expect(citySuggestions("Georgia (GE)", SHELF)).toEqual(["Batumi", "Tbilisi"]);
    expect(citySuggestions("ge", SHELF)).toEqual(["Batumi", "Tbilisi"]);
  });

  it("offers nothing for a country nobody can name", () => {
    expect(citySuggestions("Narnia", SHELF)).toEqual([]);
    expect(citySuggestions("", SHELF)).toEqual([]);
    expect(citySuggestions(null, SHELF)).toEqual([]);
  });

  it("ignores rows whose city is blank, or is punctuation pretending to be one", () => {
    const shelf = [
      { city: "  ", country: "IL" },
      { city: "…", country: "IL" },
      { city: null, country: "IL" },
    ];
    expect(citySuggestions("IL", shelf)).toEqual(["Haifa"]);
  });
});

describe("citySuggestionIndex", () => {
  it("covers every country the dictionary knows plus every country the shelf names", () => {
    const index = citySuggestionIndex(SHELF);

    // The dictionary's seven, plus Portugal, which only the shelf has heard of.
    expect(Object.keys(index).sort()).toEqual(["DE", "ES", "GE", "IL", "NL", "PT", "RU", "US"]);
    expect(index.PT).toEqual(["Lisbon"]);
    expect(index.GE).toEqual(["Batumi", "Tbilisi"]);
  });

  it("still answers with the dictionary when the shelf is empty", () => {
    const index = citySuggestionIndex([]);

    expect(index.IL).toEqual(["Haifa"]);
    expect(index.US).toEqual(["Los Angeles"]);
    expect(index.PT).toBeUndefined();
  });

  it("never carries an empty list — a country with nothing to offer is simply absent", () => {
    for (const cities of Object.values(citySuggestionIndex(SHELF))) {
      expect(cities.length).toBeGreaterThan(0);
    }
  });

  it("drops a row whose country cannot be resolved rather than inventing a key", () => {
    const index = citySuggestionIndex([{ city: "Somewhere", country: "ZZ" }]);
    expect(index.ZZ).toBeUndefined();
  });
});
