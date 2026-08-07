/**
 * ISO 3166-1 alpha-2 — the whole world, as a table.
 *
 * The COUNTRY field used to be a bare two-letter box with `pattern="[A-Za-z]{2}"`, which is a
 * quiz rather than a field: the owner types sightings on a phone, in a shop, and "what is the
 * code for Georgia" is not a question a form should ask. So the input is a combobox now
 * (a pixel `<input>` + a native `<datalist>`), and this file is what it offers.
 *
 * **Pure data and pure functions.** No React, no request, no database — the same rule
 * `src/lib/geo.ts` follows, and for the same reason: the resolution rules are argued about in
 * a unit test rather than in a component.
 *
 * The names are ICU's English display names (Node's `Intl.DisplayNames`), normalised once at
 * authoring time — `&` spelled out, `St.` expanded, the typographic apostrophe folded to an
 * ASCII one so a phone keyboard can type what it sees. 249 officially assigned codes plus
 * `XK` (Kosovo, user-assigned but universally used), which is the ~250 the field offers.
 */

/** One row of the table: the code that gets stored, and the name a human reads. */
export interface Country {
  code: string;
  name: string;
}

const COUNTRY_ROWS: readonly (readonly [string, string])[] = [
  ["AD", "Andorra"],
  ["AE", "United Arab Emirates"],
  ["AF", "Afghanistan"],
  ["AG", "Antigua and Barbuda"],
  ["AI", "Anguilla"],
  ["AL", "Albania"],
  ["AM", "Armenia"],
  ["AO", "Angola"],
  ["AQ", "Antarctica"],
  ["AR", "Argentina"],
  ["AS", "American Samoa"],
  ["AT", "Austria"],
  ["AU", "Australia"],
  ["AW", "Aruba"],
  ["AX", "Åland Islands"],
  ["AZ", "Azerbaijan"],
  ["BA", "Bosnia and Herzegovina"],
  ["BB", "Barbados"],
  ["BD", "Bangladesh"],
  ["BE", "Belgium"],
  ["BF", "Burkina Faso"],
  ["BG", "Bulgaria"],
  ["BH", "Bahrain"],
  ["BI", "Burundi"],
  ["BJ", "Benin"],
  ["BL", "Saint Barthélemy"],
  ["BM", "Bermuda"],
  ["BN", "Brunei"],
  ["BO", "Bolivia"],
  ["BQ", "Caribbean Netherlands"],
  ["BR", "Brazil"],
  ["BS", "Bahamas"],
  ["BT", "Bhutan"],
  ["BV", "Bouvet Island"],
  ["BW", "Botswana"],
  ["BY", "Belarus"],
  ["BZ", "Belize"],
  ["CA", "Canada"],
  ["CC", "Cocos (Keeling) Islands"],
  ["CD", "Congo (Democratic Republic)"],
  ["CF", "Central African Republic"],
  ["CG", "Congo (Republic)"],
  ["CH", "Switzerland"],
  ["CI", "Côte d'Ivoire"],
  ["CK", "Cook Islands"],
  ["CL", "Chile"],
  ["CM", "Cameroon"],
  ["CN", "China"],
  ["CO", "Colombia"],
  ["CR", "Costa Rica"],
  ["CU", "Cuba"],
  ["CV", "Cape Verde"],
  ["CW", "Curaçao"],
  ["CX", "Christmas Island"],
  ["CY", "Cyprus"],
  ["CZ", "Czechia"],
  ["DE", "Germany"],
  ["DJ", "Djibouti"],
  ["DK", "Denmark"],
  ["DM", "Dominica"],
  ["DO", "Dominican Republic"],
  ["DZ", "Algeria"],
  ["EC", "Ecuador"],
  ["EE", "Estonia"],
  ["EG", "Egypt"],
  ["EH", "Western Sahara"],
  ["ER", "Eritrea"],
  ["ES", "Spain"],
  ["ET", "Ethiopia"],
  ["FI", "Finland"],
  ["FJ", "Fiji"],
  ["FK", "Falkland Islands"],
  ["FM", "Micronesia"],
  ["FO", "Faroe Islands"],
  ["FR", "France"],
  ["GA", "Gabon"],
  ["GB", "United Kingdom"],
  ["GD", "Grenada"],
  ["GE", "Georgia"],
  ["GF", "French Guiana"],
  ["GG", "Guernsey"],
  ["GH", "Ghana"],
  ["GI", "Gibraltar"],
  ["GL", "Greenland"],
  ["GM", "Gambia"],
  ["GN", "Guinea"],
  ["GP", "Guadeloupe"],
  ["GQ", "Equatorial Guinea"],
  ["GR", "Greece"],
  ["GS", "South Georgia and South Sandwich Islands"],
  ["GT", "Guatemala"],
  ["GU", "Guam"],
  ["GW", "Guinea-Bissau"],
  ["GY", "Guyana"],
  ["HK", "Hong Kong"],
  ["HM", "Heard and McDonald Islands"],
  ["HN", "Honduras"],
  ["HR", "Croatia"],
  ["HT", "Haiti"],
  ["HU", "Hungary"],
  ["ID", "Indonesia"],
  ["IE", "Ireland"],
  ["IL", "Israel"],
  ["IM", "Isle of Man"],
  ["IN", "India"],
  ["IO", "British Indian Ocean Territory"],
  ["IQ", "Iraq"],
  ["IR", "Iran"],
  ["IS", "Iceland"],
  ["IT", "Italy"],
  ["JE", "Jersey"],
  ["JM", "Jamaica"],
  ["JO", "Jordan"],
  ["JP", "Japan"],
  ["KE", "Kenya"],
  ["KG", "Kyrgyzstan"],
  ["KH", "Cambodia"],
  ["KI", "Kiribati"],
  ["KM", "Comoros"],
  ["KN", "Saint Kitts and Nevis"],
  ["KP", "North Korea"],
  ["KR", "South Korea"],
  ["KW", "Kuwait"],
  ["KY", "Cayman Islands"],
  ["KZ", "Kazakhstan"],
  ["LA", "Laos"],
  ["LB", "Lebanon"],
  ["LC", "Saint Lucia"],
  ["LI", "Liechtenstein"],
  ["LK", "Sri Lanka"],
  ["LR", "Liberia"],
  ["LS", "Lesotho"],
  ["LT", "Lithuania"],
  ["LU", "Luxembourg"],
  ["LV", "Latvia"],
  ["LY", "Libya"],
  ["MA", "Morocco"],
  ["MC", "Monaco"],
  ["MD", "Moldova"],
  ["ME", "Montenegro"],
  ["MF", "Saint Martin"],
  ["MG", "Madagascar"],
  ["MH", "Marshall Islands"],
  ["MK", "North Macedonia"],
  ["ML", "Mali"],
  ["MM", "Myanmar"],
  ["MN", "Mongolia"],
  ["MO", "Macao"],
  ["MP", "Northern Mariana Islands"],
  ["MQ", "Martinique"],
  ["MR", "Mauritania"],
  ["MS", "Montserrat"],
  ["MT", "Malta"],
  ["MU", "Mauritius"],
  ["MV", "Maldives"],
  ["MW", "Malawi"],
  ["MX", "Mexico"],
  ["MY", "Malaysia"],
  ["MZ", "Mozambique"],
  ["NA", "Namibia"],
  ["NC", "New Caledonia"],
  ["NE", "Niger"],
  ["NF", "Norfolk Island"],
  ["NG", "Nigeria"],
  ["NI", "Nicaragua"],
  ["NL", "Netherlands"],
  ["NO", "Norway"],
  ["NP", "Nepal"],
  ["NR", "Nauru"],
  ["NU", "Niue"],
  ["NZ", "New Zealand"],
  ["OM", "Oman"],
  ["PA", "Panama"],
  ["PE", "Peru"],
  ["PF", "French Polynesia"],
  ["PG", "Papua New Guinea"],
  ["PH", "Philippines"],
  ["PK", "Pakistan"],
  ["PL", "Poland"],
  ["PM", "Saint Pierre and Miquelon"],
  ["PN", "Pitcairn Islands"],
  ["PR", "Puerto Rico"],
  ["PS", "Palestinian Territories"],
  ["PT", "Portugal"],
  ["PW", "Palau"],
  ["PY", "Paraguay"],
  ["QA", "Qatar"],
  ["RE", "Réunion"],
  ["RO", "Romania"],
  ["RS", "Serbia"],
  ["RU", "Russia"],
  ["RW", "Rwanda"],
  ["SA", "Saudi Arabia"],
  ["SB", "Solomon Islands"],
  ["SC", "Seychelles"],
  ["SD", "Sudan"],
  ["SE", "Sweden"],
  ["SG", "Singapore"],
  ["SH", "Saint Helena"],
  ["SI", "Slovenia"],
  ["SJ", "Svalbard and Jan Mayen"],
  ["SK", "Slovakia"],
  ["SL", "Sierra Leone"],
  ["SM", "San Marino"],
  ["SN", "Senegal"],
  ["SO", "Somalia"],
  ["SR", "Suriname"],
  ["SS", "South Sudan"],
  ["ST", "São Tomé and Príncipe"],
  ["SV", "El Salvador"],
  ["SX", "Sint Maarten"],
  ["SY", "Syria"],
  ["SZ", "Eswatini"],
  ["TC", "Turks and Caicos Islands"],
  ["TD", "Chad"],
  ["TF", "French Southern Territories"],
  ["TG", "Togo"],
  ["TH", "Thailand"],
  ["TJ", "Tajikistan"],
  ["TK", "Tokelau"],
  ["TL", "Timor-Leste"],
  ["TM", "Turkmenistan"],
  ["TN", "Tunisia"],
  ["TO", "Tonga"],
  ["TR", "Türkiye"],
  ["TT", "Trinidad and Tobago"],
  ["TV", "Tuvalu"],
  ["TW", "Taiwan"],
  ["TZ", "Tanzania"],
  ["UA", "Ukraine"],
  ["UG", "Uganda"],
  ["UM", "United States Outlying Islands"],
  ["US", "United States"],
  ["UY", "Uruguay"],
  ["UZ", "Uzbekistan"],
  ["VA", "Vatican City"],
  ["VC", "Saint Vincent and Grenadines"],
  ["VE", "Venezuela"],
  ["VG", "British Virgin Islands"],
  ["VI", "U.S. Virgin Islands"],
  ["VN", "Vietnam"],
  ["VU", "Vanuatu"],
  ["WF", "Wallis and Futuna"],
  ["WS", "Samoa"],
  ["XK", "Kosovo"],
  ["YE", "Yemen"],
  ["YT", "Mayotte"],
  ["ZA", "South Africa"],
  ["ZM", "Zambia"],
  ["ZW", "Zimbabwe"],
];

/** The table, alphabetical by name — the order the datalist shows them in. */
export const COUNTRIES: readonly Country[] = COUNTRY_ROWS.map(([code, name]) => ({
  code,
  name,
})).sort((a, b) => a.name.localeCompare(b.name, "en"));

/** `"US"` → `"United States"`, or `null` for anything not in the table. */
export function countryName(code: string | null | undefined): string | null {
  const upper = (code ?? "").trim().toUpperCase();
  return COUNTRY_ROWS.find(([candidate]) => candidate === upper)?.[1] ?? null;
}

/**
 * What one `<option>` says: `United States (US)`.
 *
 * Both halves on purpose. A native datalist filters on the whole string, so typing `US`
 * finds the United States and typing `united` finds it too — and the code stays visible, so
 * the owner can see what is about to be stored in a two-letter column.
 */
export function countryOptionLabel(country: Country): string {
  return `${country.name} (${country.code})`;
}

/** Every option the COUNTRY combobox offers, in one array — server-rendered, never fetched. */
export function countryOptions(): string[] {
  return COUNTRIES.map(countryOptionLabel);
}

/** Case, accents, punctuation and doubled spaces folded — the comparison form for a name. */
function fold(value: string): string {
  return (
    value
      .normalize("NFD")
      // The combining marks NFD just split off, spelled in escapes — a literal range is
      // invisible in a diff and one bad paste from silently changing (same as `geo.ts`).
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
  );
}

const BY_FOLDED_NAME: ReadonlyMap<string, string> = new Map(
  COUNTRY_ROWS.map(([code, name]) => [fold(name), code] as const),
);

/**
 * A handful of spellings the table does not carry but a person types anyway.
 *
 * Deliberately short and explicit rather than fuzzy: a country is a fact stored in a
 * two-letter column, and "close enough" is how a figure ends up filed on the wrong continent
 * (the same rule `src/lib/geo.ts` applies to city aliases).
 */
const NAME_ALIASES: Readonly<Record<string, string>> = {
  usa: "US",
  "united states of america": "US",
  america: "US",
  uk: "GB",
  "great britain": "GB",
  england: "GB",
  scotland: "GB",
  wales: "GB",
  holland: "NL",
  "the netherlands": "NL",
  "russian federation": "RU",
  "south korea": "KR",
  "north korea": "KP",
  uae: "AE",
  "czech republic": "CZ",
  "ivory coast": "CI",
  "vatican city state": "VA",
  "hong kong sar china": "HK",
  "macao sar china": "MO",
};

/**
 * Whatever is in the box → a stored country code, or `null`.
 *
 * Four accepted spellings, because the field is free text with suggestions rather than a
 * `<select>`: the datalist's own `United States (US)`, a bare `US`, the plain name
 * `United States`, and the short list of aliases above. Anything else is `null`, and the
 * caller turns that into a form error — the one thing this must never do is quietly store
 * garbage in a column the SIGHTINGS MAP reads as a fact.
 */
export function resolveCountryCode(raw: string | null | undefined): string | null {
  const value = (raw ?? "").trim();
  if (value.length === 0) return null;

  // `United States (US)` — the datalist's own format. The parenthetical wins, because it is
  // the half this function is trying to produce.
  const parenthesised = /\(([A-Za-z]{2})\)\s*$/.exec(value);
  if (parenthesised) {
    const code = parenthesised[1].toUpperCase();
    if (countryName(code)) return code;
  }

  if (/^[A-Za-z]{2}$/.test(value)) {
    const code = value.toUpperCase();
    if (countryName(code)) return code;
  }

  const folded = fold(value);
  return BY_FOLDED_NAME.get(folded) ?? NAME_ALIASES[folded] ?? null;
}

/**
 * What the field should be pre-filled with: the datalist format for a known code.
 *
 * A stored `IL` shows up as `Israel (IL)` rather than as `IL`, so the owner reads a place
 * instead of decoding one — and re-submitting the form unchanged resolves straight back to
 * `IL`, which is what makes the round trip lossless.
 */
export function countryFieldValue(code: string | null | undefined): string {
  const upper = (code ?? "").trim().toUpperCase();
  const name = countryName(upper);
  return name ? `${name} (${upper})` : (code ?? "").trim();
}
