import { describe, expect, it } from "vitest";

import { countryFlagEmoji, formatPlace, formatPopNumber, formatSightingDate } from "./format";

describe("formatSightingDate", () => {
  it("renders the LCD month + year", () => {
    expect(formatSightingDate("2025-04-12")).toBe("APR 2025");
    expect(formatSightingDate("2023-12-28")).toBe("DEC 2023");
    expect(formatSightingDate("2026-01-05")).toBe("JAN 2026");
  });

  it("covers every month", () => {
    const months = Array.from({ length: 12 }, (_, index) =>
      formatSightingDate(`2025-${String(index + 1).padStart(2, "0")}-01`),
    );
    expect(months).toEqual([
      "JAN 2025",
      "FEB 2025",
      "MAR 2025",
      "APR 2025",
      "MAY 2025",
      "JUN 2025",
      "JUL 2025",
      "AUG 2025",
      "SEP 2025",
      "OCT 2025",
      "NOV 2025",
      "DEC 2025",
    ]);
  });

  it("accepts a timestamp prefix", () => {
    expect(formatSightingDate("2025-10-05T00:00:00.000Z")).toBe("OCT 2025");
  });

  it("never renders an invalid date", () => {
    expect(formatSightingDate(null)).toBe("—");
    expect(formatSightingDate(undefined)).toBe("—");
    expect(formatSightingDate("")).toBe("—");
    expect(formatSightingDate("12.04.2025")).toBe("—");
    expect(formatSightingDate("2025-13-01")).toBe("—");
    expect(formatSightingDate("2025-00-01")).toBe("—");
  });

  it("takes a caller-chosen fallback", () => {
    expect(formatSightingDate(null, "UNKNOWN")).toBe("UNKNOWN");
  });
});

describe("countryFlagEmoji", () => {
  it("maps a 2-letter code to regional indicators", () => {
    expect(countryFlagEmoji("US")).toBe("\u{1F1FA}\u{1F1F8}");
    expect(countryFlagEmoji("IL")).toBe("\u{1F1EE}\u{1F1F1}");
    expect(countryFlagEmoji("NL")).toBe("\u{1F1F3}\u{1F1F1}");
    expect(countryFlagEmoji("GE")).toBe("\u{1F1EC}\u{1F1EA}");
  });

  it("is case- and whitespace-insensitive", () => {
    expect(countryFlagEmoji("de")).toBe(countryFlagEmoji("DE"));
    expect(countryFlagEmoji(" es ")).toBe(countryFlagEmoji("ES"));
  });

  it("returns nothing for what is not a country code", () => {
    expect(countryFlagEmoji(null)).toBe("");
    expect(countryFlagEmoji(undefined)).toBe("");
    expect(countryFlagEmoji("")).toBe("");
    expect(countryFlagEmoji("USA")).toBe("");
    expect(countryFlagEmoji("1L")).toBe("");
  });

  it("emits exactly two code points", () => {
    expect([...countryFlagEmoji("RU")]).toHaveLength(2);
  });
});

describe("formatPopNumber", () => {
  it("prefixes the box number", () => {
    expect(formatPopNumber(1450)).toBe("#1450");
    expect(formatPopNumber(3)).toBe("#3");
  });

  it("never prints null", () => {
    expect(formatPopNumber(null)).toBe("#—");
    expect(formatPopNumber(undefined)).toBe("#—");
    expect(formatPopNumber(Number.NaN)).toBe("#—");
  });
});

describe("formatPlace", () => {
  it("puts the flag before the uppercase city", () => {
    expect(formatPlace("Haifa", "IL")).toBe("\u{1F1EE}\u{1F1F1} HAIFA");
    expect(formatPlace("LA", "US")).toBe("\u{1F1FA}\u{1F1F8} LA");
  });

  it("degrades gracefully", () => {
    expect(formatPlace(null, "DE")).toBe("\u{1F1E9}\u{1F1EA}");
    expect(formatPlace("Moscow", null)).toBe("MOSCOW");
    expect(formatPlace(null, null)).toBe("—");
  });
});
