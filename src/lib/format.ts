/**
 * Display formatters for the public showcase.
 *
 * Pure on purpose: the gadget's wording is a product decision, so it is unit-tested here
 * instead of being retyped inside components. Nothing in this file touches the database,
 * the request or `Intl` — a locale-aware month name would drift with the server locale, and
 * the LCD is supposed to read the same everywhere.
 */

/** Uppercase 3-letter months, index 0 = January. The LCD alphabet, not a locale. */
const MONTHS = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
] as const;

/**
 * `2025-04-12` → `APR 2025`.
 *
 * The day is dropped everywhere on the public pages: the story of a figure is "spring 2025
 * in Los Angeles", not a timestamp, and the exact day is the owner's business.
 * Anything that is not a real `YYYY-MM-DD` returns the placeholder instead of `Invalid Date`.
 */
export function formatSightingDate(value: string | null | undefined, fallback = "—"): string {
  const month = sightingMonth(value);
  return month ?? fallback;
}

function sightingMonth(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{4})-(\d{2})-\d{2}/.exec(value.trim());
  if (!match) return null;

  const monthIndex = Number.parseInt(match[2], 10) - 1;
  if (monthIndex < 0 || monthIndex > 11) return null;

  return `${MONTHS[monthIndex]} ${match[1]}`;
}

/** Distance from `A` to the regional indicator symbol `🇦` in the Unicode table. */
const REGIONAL_INDICATOR_OFFSET = 0x1f1e6 - 0x41;

/**
 * `US` → `🇺🇸`. An ISO 3166-1 alpha-2 code is two regional indicator symbols, nothing more.
 *
 * No flag image assets, no lookup table of 250 countries: the emoji font already has them,
 * and a code the font does not know degrades to two harmless letter-boxes rather than a
 * broken image. Anything that is not exactly two ASCII letters returns "" — the caller
 * decides what an unknown place looks like.
 */
export function countryFlagEmoji(code: string | null | undefined): string {
  if (typeof code !== "string") return "";
  const upper = code.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(upper)) return "";

  return String.fromCodePoint(
    upper.charCodeAt(0) + REGIONAL_INDICATOR_OFFSET,
    upper.charCodeAt(1) + REGIONAL_INDICATOR_OFFSET,
  );
}

/** `1450` → `#1450`; a figure without a number gets `#—`, never `#null`. */
export function formatPopNumber(popNumber: number | null | undefined): string {
  return typeof popNumber === "number" && Number.isFinite(popNumber) ? `#${popNumber}` : "#—";
}

/**
 * `Haifa` + `IL` → `🇮🇱 HAIFA`. Uppercase because it sits in the pixel font next to the
 * flag; a missing city falls back to the bare flag, and a missing everything to `—`.
 */
export function formatPlace(
  city: string | null | undefined,
  country: string | null | undefined,
): string {
  const flag = countryFlagEmoji(country);
  const name = (city ?? "").trim().toUpperCase();
  return [flag, name].filter(Boolean).join(" ") || "—";
}
