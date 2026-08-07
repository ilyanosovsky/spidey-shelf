import { describe, expect, it } from "vitest";

import {
  COORDINATE_DECIMALS,
  NOMINATIM_ENDPOINT,
  NOMINATIM_TIMEOUT_MS,
  NOMINATIM_USER_AGENT,
  nominatimUrl,
  parseNominatimResponse,
  roundToCityPrecision,
} from "./nominatim";

/**
 * The request we send and the answer we accept — argued about here rather than against a
 * public service run on donated hardware. The fixture below is the real shape of a jsonv2
 * result for Kuala Lumpur, trimmed to the fields this project reads.
 */
const KUALA_LUMPUR = [
  {
    place_id: 297512636,
    osm_type: "relation",
    osm_id: 2224045,
    lat: "3.1504726",
    lon: "101.6941732",
    category: "boundary",
    type: "administrative",
    name: "Kuala Lumpur",
    display_name: "Kuala Lumpur, Malaysia",
  },
];

describe("nominatimUrl", () => {
  it("asks a structured question — city plus a hard country filter", () => {
    const url = new URL(nominatimUrl("MY", "Kuala Lumpur")!);

    expect(`${url.origin}${url.pathname}`).toBe(NOMINATIM_ENDPOINT);
    expect(url.searchParams.get("city")).toBe("Kuala Lumpur");
    expect(url.searchParams.get("countrycodes")).toBe("my");
    expect(url.searchParams.get("format")).toBe("jsonv2");
    expect(url.searchParams.get("limit")).toBe("1");
  });

  it("never sends a free-text `q` — `LA, US` is how a city becomes a state", () => {
    const url = new URL(nominatimUrl("US", "LA")!);
    expect(url.searchParams.get("q")).toBeNull();
    expect(url.searchParams.get("city")).toBe("LA");
  });

  it("escapes what it is given rather than trusting it", () => {
    const url = new URL(nominatimUrl("ES", "Palma de Mallorca & co")!);
    expect(url.searchParams.get("city")).toBe("Palma de Mallorca & co");
  });

  it("is null when there is nothing to ask — and then nothing is ever sent", () => {
    expect(nominatimUrl("MY", "")).toBeNull();
    expect(nominatimUrl("MY", "   ")).toBeNull();
    expect(nominatimUrl("", "Kuala Lumpur")).toBeNull();
    expect(nominatimUrl("MYS", "Kuala Lumpur")).toBeNull();
    expect(nominatimUrl(null, null)).toBeNull();
  });
});

describe("roundToCityPrecision", () => {
  it("keeps two decimals — about a kilometre, and never a shop's doorstep", () => {
    expect(COORDINATE_DECIMALS).toBe(2);
    expect(roundToCityPrecision(3.1504726)).toBe(3.15);
    expect(roundToCityPrecision(101.6941732)).toBe(101.69);
  });

  it("rounds symmetrically around zero", () => {
    expect(roundToCityPrecision(-118.2437)).toBe(-118.24);
    expect(roundToCityPrecision(-118.245)).toBe(-118.25);
    expect(roundToCityPrecision(118.245)).toBe(118.25);
  });

  it("leaves an already-round number alone", () => {
    expect(roundToCityPrecision(0)).toBe(0);
    expect(roundToCityPrecision(52.37)).toBe(52.37);
  });
});

describe("parseNominatimResponse", () => {
  it("turns the documented lat/lon strings into a rounded coordinate", () => {
    expect(parseNominatimResponse(200, KUALA_LUMPUR)).toEqual({ lat: 3.15, lng: 101.69 });
  });

  it("reads `lon`, which is not what the rest of this codebase calls it", () => {
    // The one field-name trap in the whole integration: ours is `lng`, theirs is `lon`.
    expect(parseNominatimResponse(200, [{ lat: "52.3730796", lon: "4.8924534" }])).toEqual({
      lat: 52.37,
      lng: 4.89,
    });
  });

  it("tolerates numbers where the contract promises strings", () => {
    expect(parseNominatimResponse(200, [{ lat: 41.716, lon: 44.783 }])).toEqual({
      lat: 41.72,
      lng: 44.78,
    });
  });

  it("answers null for every kind of no — a rate limit is not different from a miss", () => {
    expect(parseNominatimResponse(200, [])).toBeNull();
    expect(parseNominatimResponse(429, KUALA_LUMPUR)).toBeNull();
    expect(parseNominatimResponse(403, KUALA_LUMPUR)).toBeNull();
    expect(parseNominatimResponse(500, null)).toBeNull();
    expect(parseNominatimResponse(200, null)).toBeNull();
    expect(parseNominatimResponse(200, { lat: "3.15", lon: "101.69" })).toBeNull();
    expect(parseNominatimResponse(200, "<html>rate limited</html>")).toBeNull();
  });

  it("refuses a result that is not a point on Earth", () => {
    expect(parseNominatimResponse(200, [{ lat: "abc", lon: "101.69" }])).toBeNull();
    expect(parseNominatimResponse(200, [{ lat: "3.15" }])).toBeNull();
    expect(parseNominatimResponse(200, [{ lat: "91", lon: "0" }])).toBeNull();
    expect(parseNominatimResponse(200, [{ lat: "0", lon: "181" }])).toBeNull();
    expect(parseNominatimResponse(200, [null])).toBeNull();
  });
});

describe("the OSMF usage policy, as constants", () => {
  it("identifies the project in the User-Agent — a generic one is grounds for a block", () => {
    // https://operations.osmfoundation.org/policies/nominatim/
    expect(NOMINATIM_USER_AGENT).toMatch(/^spidey-shelf\/\d+\.\d+ \(\+https:\/\/.+\)$/);
  });

  it("keeps the 5s budget every third-party call in this project has", () => {
    expect(NOMINATIM_TIMEOUT_MS).toBe(5000);
  });
});
