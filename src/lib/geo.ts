/**
 * Where the collection was found, in coordinates — the geography behind the SIGHTINGS MAP.
 *
 * **The coordinates are a dictionary in code, not columns in the database.** `owned_figures`
 * has had `acquired_lat` / `acquired_lng` since Phase 1 and they are still NULL on all 19
 * rows, because filling them would mean either a backfill pass over the owner's Notion export
 * or a geocoder in the admin flow — a second thing to type on a phone, for data that is
 * already implied by "Haifa, IL". A table of nine cities is retroactive by construction: it
 * fixes every existing row at once, it needs no migration, and a city that is not in it is a
 * line of copy rather than a crash. See docs/wiki/Data-Model.md.
 *
 * Everything here is pure and unit-tested. The projection is equirectangular, chosen because
 * it is *linear* in longitude and latitude: the map's coordinate space IS degree space
 * (`x = lng + 180`, `y = 90 - lat`), so cropping to a region is a narrower viewBox and
 * nothing else — no re-projection of the landmass, no second copy of the path data.
 */

/** A point on the globe, in degrees. */
export interface Coordinate {
  lat: number;
  lng: number;
}

/** A point in the map's own space: `x` 0…360 (west→east), `y` 0…180 (north→south). */
export interface MapPoint {
  x: number;
  y: number;
}

/** The whole world, in map space. Everything below is a sub-rectangle of this. */
export const WORLD_BOUNDS = { x: 0, y: 0, width: 360, height: 180 } as const;

export interface MapBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * The nine cities this collection came from, plus the spellings the data actually uses.
 *
 * Keys are `<ISO 3166-1 alpha-2>:<normalised city>`; the normaliser folds case, accents and
 * punctuation, so `Tbilisi`, `TBILISI` and `T'bilisi` are one entry. Aliases are listed
 * explicitly rather than fuzzy-matched — a map is a factual claim, and "close enough" is how
 * a figure ends up pinned to the wrong continent.
 *
 * Two of them are judgement calls, both worth stating out loud:
 *   · `US:la` — the shelf spells Los Angeles "LA", and the two-letter form is also a US state
 *     code. It resolves to Los Angeles here because that is where the figure was bought.
 *   · `ES:mallorca` — an island, not a city. It is pinned to Palma, its capital and the only
 *     place on it with a Funko shop.
 */
export const CITY_COORDINATES: Readonly<Record<string, Coordinate>> = {
  "il:haifa": { lat: 32.794, lng: 34.99 },
  "de:munich": { lat: 48.137, lng: 11.575 },
  "de:munchen": { lat: 48.137, lng: 11.575 },
  "ge:tbilisi": { lat: 41.716, lng: 44.783 },
  "ge:batumi": { lat: 41.643, lng: 41.64 },
  "ru:moscow": { lat: 55.756, lng: 37.617 },
  "us:los angeles": { lat: 34.052, lng: -118.244 },
  "us:la": { lat: 34.052, lng: -118.244 },
  "es:madrid": { lat: 40.417, lng: -3.703 },
  "es:mallorca": { lat: 39.57, lng: 2.65 },
  "es:palma": { lat: 39.57, lng: 2.65 },
  "es:palma de mallorca": { lat: 39.57, lng: 2.65 },
  "nl:amsterdam": { lat: 52.37, lng: 4.895 },
};

/**
 * The dictionary's CANONICAL spelling per city — what the CITY combobox offers (Phase 12).
 *
 * A subset of {@link CITY_COORDINATES}' keys on purpose: the aliases above exist so the data
 * already on the shelf resolves (`munchen`, `la`, `mallorca`), and offering them as
 * suggestions would invite the owner to type a second spelling of a place he already has.
 * One entry per real place, spelled the way the map's legend spells it.
 *
 * The pairing is checked by a test rather than by convention — every key here must exist in
 * `CITY_COORDINATES`, and every value must resolve back through `lookupCity()`, so a renamed
 * city cannot leave a suggestion pointing at nothing.
 */
export const CITY_DISPLAY_NAMES: Readonly<Record<string, string>> = {
  "il:haifa": "Haifa",
  "de:munich": "Munich",
  "ge:tbilisi": "Tbilisi",
  "ge:batumi": "Batumi",
  "ru:moscow": "Moscow",
  "us:los angeles": "Los Angeles",
  "es:madrid": "Madrid",
  "es:palma de mallorca": "Palma de Mallorca",
  "nl:amsterdam": "Amsterdam",
};

/** The countries the dictionary can place anything in, uppercase — `["DE", "ES", …]`. */
export function dictionaryCountries(): string[] {
  const codes = new Set(Object.keys(CITY_DISPLAY_NAMES).map((key) => key.split(":")[0]));
  return [...codes].map((code) => code.toUpperCase()).sort();
}

/**
 * Every city the dictionary knows in one country, alphabetically — `("GE")` → Batumi, Tbilisi.
 *
 * The seed of the CITY suggestions: a country the owner has never bought a figure in still
 * offers whatever the map can already place, and a country the dictionary has never heard of
 * simply offers nothing, which is not an error — free text is the point (see `places.ts`).
 */
export function dictionaryCitiesFor(country: string | null | undefined): string[] {
  const code = (country ?? "").trim().toLowerCase();
  if (!/^[a-z]{2}$/.test(code)) return [];

  return Object.entries(CITY_DISPLAY_NAMES)
    .filter(([key]) => key.startsWith(`${code}:`))
    .map(([, name]) => name)
    .sort((a, b) => a.localeCompare(b, "en"));
}

/**
 * `"  T'bilisi "` → `tbilisi`. Case, accents, apostrophes and doubled spaces all folded.
 *
 * `NFD` + stripping the combining marks is what turns `München` into `munchen` — the owner
 * types city names on a phone keyboard, and half the time the umlaut is not there.
 */
export function normalizeCityName(city: string | null | undefined): string {
  if (typeof city !== "string") return "";
  return (
    city
      .normalize("NFD")
      // The combining marks NFD just split off, spelled in escapes: a literal U+0300…U+036F
      // range in source is invisible in a diff and one bad paste from silently changing.
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      // Apostrophes and full stops are DELETED, not turned into a separator: `T'bilisi` is one
      // word, and folding it to `t bilisi` would miss the dictionary entry it is spelled from.
      .replace(/['\u2019.]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
  );
}

/** `("IL", "Haifa")` → `il:haifa`. The dictionary's key, and the identity of a marker. */
export function cityKey(
  country: string | null | undefined,
  city: string | null | undefined,
): string {
  const code = (country ?? "").trim().toLowerCase();
  const name = normalizeCityName(city);
  if (!/^[a-z]{2}$/.test(code) || name === "") return "";
  return `${code}:${name}`;
}

/** The coordinate of a place, or `null` when the dictionary has never heard of it. */
export function lookupCity(
  country: string | null | undefined,
  city: string | null | undefined,
): Coordinate | null {
  const key = cityKey(country, city);
  return key === "" ? null : (CITY_COORDINATES[key] ?? null);
}

/**
 * Equirectangular: `x = lng + 180`, `y = 90 - lat`. That is the entire projection.
 *
 * Longitude wraps rather than clamps (a `lng` of 190 is 170°W, not the right edge), latitude
 * clamps (there is no such place as 100°N). Both guards exist because this takes numbers
 * from a dictionary a human maintains.
 *
 * In-range longitudes skip the wrap entirely, which is not an optimisation: `180 % 360` is
 * `0`, so a modulo applied unconditionally would fold the right edge of the map onto the
 * left one. On a globe those are the same meridian; on a rectangle they are opposite sides.
 */
export function projectEquirectangular({ lat, lng }: Coordinate): MapPoint {
  const wrapped = lng >= -180 && lng <= 180 ? lng + 180 : (((lng + 180) % 360) + 360) % 360;
  const clamped = Math.min(90, Math.max(-90, lat));
  return { x: wrapped, y: 90 - clamped };
}

/** How much air to leave around the outermost markers, as a share of their own span. */
export const MAP_PADDING = 0.18;
/** A single city must not zoom the map to a pixel: never crop tighter than this, in degrees. */
export const MAP_MIN_SPAN = 26;
/** Widest and narrowest the crop may get. Beyond these the panel is a letterbox slit. */
export const MAP_ASPECT = { min: 1.3, max: 2.6 } as const;

function centeredSpan(
  centre: number,
  span: number,
  limit: number,
): { start: number; size: number } {
  // A window wider than the world is the world; otherwise it slides back inside the edges.
  const size = Math.min(span, limit);
  const start = Math.min(Math.max(centre - size / 2, 0), limit - size);
  return { start, size };
}

/**
 * The viewBox that holds every marker: the smallest honest crop, then made presentable.
 *
 * Three guards, in this order, and each one exists because of a picture it would otherwise
 * produce:
 *   1. **padding** — markers on the frame's edge read as cut off;
 *   2. **min span** — one city on its own would zoom to a pixel of coastline, which tells a
 *      visitor nothing about where in the world it is;
 *   3. **aspect** — Los Angeles and Tbilisi are 163° apart and 20° of latitude, a 7:1 slit.
 *      The crop is grown on its short side until it lands inside `MAP_ASPECT`, so the panel
 *      is a map rather than a bar.
 *
 * Everything is finally clamped to the world: a crop that would run off the antimeridian or
 * past the pole slides back inside instead of showing empty space.
 */
export function mapBounds(points: readonly MapPoint[]): MapBounds {
  if (points.length === 0) return { ...WORLD_BOUNDS };

  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const rawWidth = Math.max(...xs) - Math.min(...xs);
  const rawHeight = Math.max(...ys) - Math.min(...ys);

  const centreX = (Math.max(...xs) + Math.min(...xs)) / 2;
  const centreY = (Math.max(...ys) + Math.min(...ys)) / 2;

  let width = Math.max(rawWidth * (1 + 2 * MAP_PADDING), MAP_MIN_SPAN);
  let height = Math.max(rawHeight * (1 + 2 * MAP_PADDING), MAP_MIN_SPAN);

  if (width / height > MAP_ASPECT.max) height = width / MAP_ASPECT.max;
  if (width / height < MAP_ASPECT.min) width = height * MAP_ASPECT.min;

  const horizontal = centeredSpan(centreX, width, WORLD_BOUNDS.width);
  const vertical = centeredSpan(centreY, height, WORLD_BOUNDS.height);

  return {
    x: horizontal.start,
    y: vertical.start,
    width: horizontal.size,
    height: vertical.size,
  };
}

/** `"55 30 175 35"` — a `MapBounds` as an SVG `viewBox` attribute. */
export function viewBoxOf(bounds: MapBounds): string {
  const round = (value: number) => Math.round(value * 100) / 100;
  return `${round(bounds.x)} ${round(bounds.y)} ${round(bounds.width)} ${round(bounds.height)}`;
}

/** Degrees between graticule lines. 30° is the reference gadget's grid. */
export const GRATICULE_STEP = 30;

export interface Graticule {
  /** Vertical lines (meridians), as `x` in map space. */
  meridians: number[];
  /** Horizontal lines (parallels), as `y` in map space. */
  parallels: number[];
}

/**
 * The thin grid under the landmass, only where the crop can actually see it.
 *
 * The lines are on the global 30° lattice, not on the crop's own edges — a graticule that
 * re-spaced itself per crop would be decoration pretending to be coordinates. A crop
 * narrower than one step still gets the lines that fall inside it, which may be none.
 */
export function graticule(bounds: MapBounds, step: number = GRATICULE_STEP): Graticule {
  const lines = (start: number, size: number): number[] => {
    const first = Math.ceil(start / step) * step;
    const result: number[] = [];
    for (let value = first; value <= start + size; value += step) result.push(value);
    return result;
  };

  return {
    meridians: lines(bounds.x, bounds.width),
    parallels: lines(bounds.y, bounds.height),
  };
}

/**
 * The pixel spider's cell size, in degrees, for a given crop.
 *
 * Markers are sized in map space rather than pixels on purpose: the SVG has no fixed width
 * (it takes its aspect ratio from the viewBox and fills its column), so a marker measured in
 * degrees stays the same fraction of the panel on a 375px phone and on a desktop.
 *
 * Five cells across is ~3.5% of the map's width — about 24px on a desktop panel and 12px on
 * a 375px phone. Bigger was tried and thrown out: Tbilisi and Batumi are 250 km apart on a
 * map that spans 20,000, so any marker large enough to be comfortable buries its neighbour.
 * The pins are a shape of the story; the legend under the map is where the counts are read.
 */
export function markerCell(bounds: MapBounds): number {
  return bounds.width / 150;
}

/** Hairlines — graticule, coastline — in degrees, so they stay hairlines at any crop. */
export function hairline(bounds: MapBounds): number {
  return bounds.width / 400;
}
