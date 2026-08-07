import { describe, expect, it } from "vitest";

import {
  COUNTRIES,
  countryFieldValue,
  countryName,
  countryOptionLabel,
  countryOptions,
  resolveCountryCode,
} from "./countries";

describe("the table", () => {
  it("holds the whole ISO 3166-1 alpha-2 list", () => {
    // 249 officially assigned codes plus XK (Kosovo), which is user-assigned and universal.
    expect(COUNTRIES).toHaveLength(250);
  });

  it("carries no duplicate codes and no duplicate names", () => {
    expect(new Set(COUNTRIES.map((country) => country.code)).size).toBe(COUNTRIES.length);
    expect(new Set(COUNTRIES.map((country) => country.name)).size).toBe(COUNTRIES.length);
  });

  it("uses two uppercase letters throughout — that is what the column stores", () => {
    for (const country of COUNTRIES) {
      expect(country.code).toMatch(/^[A-Z]{2}$/);
      expect(country.name.length).toBeGreaterThan(1);
    }
  });

  it("is alphabetical by name, which is the order the datalist shows", () => {
    const names = COUNTRIES.map((country) => country.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, "en")));
  });

  it("names the places this collection actually came from", () => {
    expect(countryName("IL")).toBe("Israel");
    expect(countryName("de")).toBe("Germany");
    expect(countryName("GE")).toBe("Georgia");
    expect(countryName("RU")).toBe("Russia");
    expect(countryName("US")).toBe("United States");
    expect(countryName("ES")).toBe("Spain");
    expect(countryName("NL")).toBe("Netherlands");
  });

  it("has never heard of a country that does not exist", () => {
    expect(countryName("ZZ")).toBeNull();
    expect(countryName("")).toBeNull();
    expect(countryName(null)).toBeNull();
  });

  it("labels an option with both halves, so typing either one finds it", () => {
    expect(countryOptionLabel({ code: "IL", name: "Israel" })).toBe("Israel (IL)");
    expect(countryOptions()).toHaveLength(250);
    expect(countryOptions()).toContain("Georgia (GE)");
  });
});

describe("resolveCountryCode", () => {
  it("takes the datalist's own format", () => {
    expect(resolveCountryCode("Israel (IL)")).toBe("IL");
    expect(resolveCountryCode("United States (US)")).toBe("US");
    // The parenthetical wins over the words: it is the half being asked for.
    expect(resolveCountryCode("Georgia (GE)")).toBe("GE");
  });

  it("takes a bare code in any case", () => {
    expect(resolveCountryCode("IL")).toBe("IL");
    expect(resolveCountryCode("il")).toBe("IL");
    expect(resolveCountryCode("  ru  ")).toBe("RU");
  });

  it("takes a plain English name, accents and punctuation folded", () => {
    expect(resolveCountryCode("Israel")).toBe("IL");
    expect(resolveCountryCode("united kingdom")).toBe("GB");
    expect(resolveCountryCode("CÔTE D'IVOIRE")).toBe("CI");
    expect(resolveCountryCode("Cote d Ivoire")).toBe("CI");
  });

  it("takes the handful of spellings a person types but ISO does not print", () => {
    expect(resolveCountryCode("USA")).toBe("US");
    expect(resolveCountryCode("UK")).toBe("GB");
    expect(resolveCountryCode("England")).toBe("GB");
    expect(resolveCountryCode("Holland")).toBe("NL");
    expect(resolveCountryCode("Czech Republic")).toBe("CZ");
  });

  it("answers null rather than storing garbage in a two-letter column", () => {
    expect(resolveCountryCode("Narnia")).toBeNull();
    expect(resolveCountryCode("ZZ")).toBeNull();
    // Three letters used to fail on length; it fails now because it names nothing.
    expect(resolveCountryCode("ISR")).toBeNull();
    expect(resolveCountryCode("Israel (ZZ)")).toBeNull();
  });

  it("treats an empty box as no answer, not as a wrong one", () => {
    expect(resolveCountryCode("")).toBeNull();
    expect(resolveCountryCode("   ")).toBeNull();
    expect(resolveCountryCode(undefined)).toBeNull();
    expect(resolveCountryCode(null)).toBeNull();
  });

  it("resolves every option it offers — the datalist cannot suggest a rejection", () => {
    for (const option of countryOptions()) {
      expect(resolveCountryCode(option)).not.toBeNull();
    }
  });
});

describe("countryFieldValue", () => {
  it("shows a stored code as a place, and round-trips back to the code", () => {
    expect(countryFieldValue("IL")).toBe("Israel (IL)");
    expect(resolveCountryCode(countryFieldValue("IL"))).toBe("IL");
    expect(countryFieldValue("ru")).toBe("Russia (RU)");
  });

  it("leaves an unknown value alone rather than blanking what the owner typed", () => {
    expect(countryFieldValue("ZZ")).toBe("ZZ");
    expect(countryFieldValue("")).toBe("");
    expect(countryFieldValue(null)).toBe("");
  });

  it("round-trips every code in the table", () => {
    for (const country of COUNTRIES) {
      expect(resolveCountryCode(countryFieldValue(country.code))).toBe(country.code);
    }
  });
});
