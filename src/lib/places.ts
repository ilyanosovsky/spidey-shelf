import { resolveCountryCode } from "./countries";
import { dictionaryCitiesFor, dictionaryCountries, lookupCity, normalizeCityName } from "./geo";
import type { SightingPlace } from "./quick-add";

/**
 * What the CITY box suggests, and why it is a suggestion rather than a choice.
 *
 * The travel log is the point of this app — a figure carries the city it was found in, and
 * new cities keep happening. So the field stays free text: a `<select>` would make the first
 * Pop bought in Lisbon impossible to log, which is exactly backwards. What the suggestions
 * buy is consistency for the places that repeat: the shelf already spells Tbilisi one way,
 * and the SIGHTINGS MAP resolves that spelling (`src/lib/geo.ts`), so offering it back beats
 * retyping it and inventing "Tblisi".
 *
 * Two sources, unioned and narrowed by the country the owner has already picked:
 *   1. **cities already on the shelf** in that country — his own spellings win;
 *   2. **the map dictionary's** canonical names for that country, so a place the map can pin
 *      is one tap away even the first time.
 *
 * Pure: the rows come from `listUsedPlaces()`, the country from the form.
 */

/**
 * Every suggestion for one country, deduped twice over, alphabetical.
 *
 * **Two dedupes, because two different things can be the same city.** The first is the map's
 * own normaliser (`Tbilisi` = `T'BILISI`), which catches how a name was typed. The second is
 * the coordinate: `geo.ts` deliberately carries aliases — `de:munchen` beside `de:munich`,
 * `us:la` beside `us:los angeles` — that fold to different strings and pin the same place. A
 * suggestion list offering both `LA` and `Los Angeles` would be inviting the owner to split
 * one city into two, which is exactly what the dictionary's aliases exist to prevent.
 *
 * The shelf goes first in both passes, so the spelling this collection actually uses is the
 * one that survives and the dictionary's canonical form is the one dropped.
 */
export function citySuggestions(
  country: string | null | undefined,
  usedPlaces: readonly SightingPlace[],
): string[] {
  const code = resolveCountryCode(country);
  if (!code) return [];

  const seenNames = new Set<string>();
  const seenPlaces = new Set<string>();
  const suggestions: string[] = [];

  const take = (raw: string | null | undefined) => {
    const city = (raw ?? "").trim();
    if (city.length === 0) return;

    const key = normalizeCityName(city);
    // A city whose name folds to nothing (punctuation, an emoji) is not a place.
    if (key.length === 0 || seenNames.has(key)) return;

    const point = lookupCity(code, city);
    const pin = point ? `${point.lat},${point.lng}` : null;
    if (pin !== null && seenPlaces.has(pin)) return;

    seenNames.add(key);
    if (pin !== null) seenPlaces.add(pin);
    suggestions.push(city);
  };

  for (const place of usedPlaces) {
    if (resolveCountryCode(place.country) === code) take(place.city);
  }
  for (const city of dictionaryCitiesFor(code)) take(city);

  return suggestions.sort((a, b) => a.localeCompare(b, "en"));
}

/**
 * The whole suggestion table, one entry per country that has any — the prop the client
 * component holds.
 *
 * Built on the server from the shelf's own rows plus the dictionary, and small by
 * construction: nine cities in seven countries today. That is what keeps the "narrow the
 * cities when the country changes" behaviour a lookup in a tiny object rather than a fetch
 * on every keystroke.
 */
export function citySuggestionIndex(
  usedPlaces: readonly SightingPlace[],
): Record<string, string[]> {
  const codes = new Set<string>(dictionaryCountries());
  for (const place of usedPlaces) {
    const code = resolveCountryCode(place.country);
    if (code) codes.add(code);
  }

  const index: Record<string, string[]> = {};
  for (const code of [...codes].sort()) {
    const cities = citySuggestions(code, usedPlaces);
    if (cities.length > 0) index[code] = cities;
  }
  return index;
}
