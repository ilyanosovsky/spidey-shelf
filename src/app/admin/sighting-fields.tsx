"use client";

import { useState } from "react";

import { countryFieldValue, countryOptions, resolveCountryCode } from "@/lib/countries";

import { dateFieldClass, fieldClass, labelClass } from "./ui";

/**
 * WHERE and WHEN — the three fields Quick Add's details step and the collection edit form
 * both ask for, in one component so they can never disagree.
 *
 * They were duplicated before Phase 12, and the duplication had already drifted: Quick Add
 * put CITY and COUNTRY side by side in a two-column grid, the edit form stacked them, and
 * only one of the two carried a `pattern` on the country box. Now both call this.
 *
 * **COUNTRY is a combobox, not a quiz.** It used to be a two-letter text field with
 * `maxlength=2` — which is a fine thing to *store* and a terrible thing to *ask*: the owner
 * logs sightings on a phone in a shop, and `GE` versus `GB` is not a distinction to make from
 * memory while a shop assistant waits. A pixel `<input>` plus a native `<datalist>` gets the
 * whole ISO 3166 list with the browser's own type-to-filter, no JavaScript of ours, and free
 * typing still allowed — the server resolves whatever comes back (`resolveCountryCode`) and
 * refuses what it cannot place rather than storing garbage.
 *
 * **CITY is narrowed by COUNTRY, and that is the only thing this component needs state for.**
 * The suggestions are the cities already on the shelf in that country plus the ones the
 * SIGHTINGS MAP dictionary can pin there (`src/lib/places.ts`), so the spelling that is
 * already on the map is one tap away and a new city is still just typing — a `<select>` here
 * would make the first Pop bought in Lisbon impossible to log, which is backwards for a
 * travel log.
 *
 * That is the entire client-side surface: one `useState` holding what is in the country box.
 * Everything else is plain HTML that works before hydration, which is the rule the whole
 * Quick Add flow is built on.
 */

export interface SightingFieldsProps {
  /** ISO date, `YYYY-MM-DD`. Today, on a fresh Quick Add. */
  date: string;
  city: string;
  /** The stored two-letter code; shown to the owner as `Israel (IL)`. */
  country: string;
  /** `CITY` suggestions per country code — built on the server by `citySuggestionIndex()`. */
  citiesByCountry: Readonly<Record<string, readonly string[]>>;
  /** Rendered but disabled while a submit is in flight (the edit form's `pending`). */
  disabled?: boolean;
}

const COUNTRY_LIST_ID = "sighting-country-options";
const CITY_LIST_ID = "sighting-city-options";

export function SightingFields({
  date,
  city,
  country,
  citiesByCountry,
  disabled = false,
}: SightingFieldsProps) {
  const [countryValue, setCountryValue] = useState(() => countryFieldValue(country));

  // An unresolvable box (mid-typing, or a country nobody has been to) offers no cities at
  // all rather than the previous country's — a stale suggestion list is worse than none.
  const code = resolveCountryCode(countryValue);
  const cities = (code ? citiesByCountry[code] : undefined) ?? [];

  return (
    <>
      <div className="flex min-w-0 flex-col gap-2">
        <label htmlFor="acquiredAt" className={labelClass}>
          DATE
        </label>
        <input
          id="acquiredAt"
          name="acquiredAt"
          type="date"
          required
          disabled={disabled}
          defaultValue={date}
          className={dateFieldClass}
        />
      </div>

      <div className="flex min-w-0 flex-col gap-2">
        <label htmlFor="acquiredCountry" className={labelClass}>
          COUNTRY
        </label>
        <input
          id="acquiredCountry"
          name="acquiredCountry"
          type="text"
          list={COUNTRY_LIST_ID}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          disabled={disabled}
          placeholder="Israel (IL)"
          value={countryValue}
          onChange={(event) => setCountryValue(event.target.value)}
          className={fieldClass}
        />
        <datalist id={COUNTRY_LIST_ID}>
          {countryOptions().map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>
      </div>

      <div className="flex min-w-0 flex-col gap-2">
        <label htmlFor="acquiredCity" className={labelClass}>
          CITY
        </label>
        <input
          id="acquiredCity"
          name="acquiredCity"
          type="text"
          list={CITY_LIST_ID}
          autoComplete="off"
          autoCorrect="off"
          disabled={disabled}
          defaultValue={city}
          placeholder="Haifa"
          className={fieldClass}
        />
        <datalist id={CITY_LIST_ID}>
          {cities.map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>
      </div>
    </>
  );
}
