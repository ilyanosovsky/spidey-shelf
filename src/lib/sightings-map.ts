import { FIGURE_CATEGORIES, type FigureCategory } from "./categories";
import { FIGURE_SPRITE_KINDS, figureSpriteKind, type FigureSpriteKind } from "./figure-sprites";
import { countryFlagEmoji } from "./format";
import {
  cityKey,
  lookupCity,
  projectEquirectangular,
  storedCoordinate,
  type Coordinate,
  type MapPoint,
} from "./geo";
import { filterShelf, type PublicShelfEntry } from "./showcase";

/**
 * The shelf as a set of pins — everything the SIGHTINGS MAP draws, minus the drawing.
 *
 * Pure over `PublicShelfEntry[]`, like the rest of `src/lib/*`: the component turns these
 * rows into `<rect>`s and text and decides nothing. Two outputs, because a travel map has two
 * honest answers:
 *   · **markers** — the cities it can place, one pin per city with a count;
 *   · **uncharted** — the figures whose place it cannot, listed by name underneath rather
 *     than dropped. A map that silently loses a figure is worse than a map that admits it
 *     does not know where Milan is.
 *
 * Since Phase 13 a place can be placed two ways — the row's own `acquired_lat` /
 * `acquired_lng`, geocoded once when it was written (ADR-012), or the hand-written dictionary
 * in `src/lib/geo.ts`. Reading is still pure and still free: this file never fetches
 * anything, and neither does the page that calls it.
 */

/**
 * Which sprite a figure is pinned with (Phase 14): the spider for the owner's lines, a
 * sprite of their own for each of Veronika's two. Same mapping as the placeholder box art, so a figure wears
 * the same picture on its card and on the map — it is defined once, in `figure-sprites.ts`.
 */
export type SightingIconKind = FigureSpriteKind;

/** Display order of a city's icons, left to right: always spider, then stitch, then grogu. */
export const SIGHTING_ICON_KINDS: readonly SightingIconKind[] = FIGURE_SPRITE_KINDS;

export function sightingIconKind(category: FigureCategory | null | undefined): SightingIconKind {
  return figureSpriteKind(category);
}

/** One sprite at a city: a kind that is present there, and how many of the city's figures. */
export interface SightingIcon {
  kind: SightingIconKind;
  count: number;
  /**
   * The icon's colour: the dominant bucket among THIS kind's figures. For the spider that is
   * the old whole-city rule applied to the owner's figures only; for her two lines it is simply
   * their own line.
   */
  category: FigureCategory;
}

/** One pin: a city, everything found there, and where it lands on the map. */
export interface CitySighting {
  /** `il:haifa` — the dictionary key, and a stable React key. */
  key: string;
  /** The owner's own spelling, uppercased: `HAIFA`, `LA`, `MALLORCA`. */
  city: string;
  /** ISO 3166-1 alpha-2, uppercase. */
  country: string;
  flag: string;
  /** Every figure found there, whoever's it is — the legend's total and the caption's sum. */
  count: number;
  /** The bucket most of this city's figures belong to — the legend chip's border. */
  category: FigureCategory;
  /**
   * One entry per kind PRESENT, in {@link SIGHTING_ICON_KINDS} order — never an entry with a
   * zero count. One city is still one cluster with one coordinate; the component draws these
   * side by side around it.
   */
  icons: SightingIcon[];
  point: MapPoint;
}

/** A figure the map cannot place: a city that is not in the dictionary, or no city at all. */
export interface UnchartedSighting {
  slug: string;
  name: string;
  /** `MILAN, IT` — or `SOMEWHERE` when the row has no place at all. */
  place: string;
}

export interface SightingsMapData {
  markers: CitySighting[];
  uncharted: UnchartedSighting[];
}

/**
 * The bucket that gives a city its colour: the most common one, ties broken by taxonomy order.
 *
 * A pin is one dot for what may be five different figures, so its colour has to be a summary
 * rather than a fact about a row. Taxonomy order as the tiebreak keeps it deterministic —
 * `peter` wins a tie with `other`, which is also the right answer for a Spider-Man shelf.
 */
export function dominantCategory(categories: readonly FigureCategory[]): FigureCategory {
  const counts = new Map<FigureCategory, number>();
  for (const category of categories) counts.set(category, (counts.get(category) ?? 0) + 1);

  let best: FigureCategory = FIGURE_CATEGORIES[0];
  let bestCount = -1;
  for (const category of FIGURE_CATEGORIES) {
    const count = counts.get(category) ?? 0;
    if (count > bestCount) {
      best = category;
      bestCount = count;
    }
  }
  return best;
}

/**
 * A city's figures split by sprite kind, in display order, empty kinds dropped.
 *
 * Separate icons rather than one mixed pin because the owner asked for exactly that: his
 * spiders and her lines are two collections on one shelf, and a single coral spider over
 * Amsterdam would hide that one of the three figures found there is hers.
 */
export function sightingIcons(categories: readonly FigureCategory[]): SightingIcon[] {
  return SIGHTING_ICON_KINDS.flatMap((kind): SightingIcon[] => {
    const own = categories.filter((category) => sightingIconKind(category) === kind);
    return own.length === 0 ? [] : [{ kind, count: own.length, category: dominantCategory(own) }];
  });
}

/**
 * Horizontal centres of a city's icons, in marker cells, relative to the city's point.
 *
 * The group is centred on the city, so one icon sits exactly where the lone spider always
 * has (offset 0). The pitch is the 5.8-cell plate plus a one-cell gap: that gap is what keeps
 * a single-digit count badge — which hangs off an icon's top-right shoulder — clear of the
 * next icon's sprite.
 */
export const SIGHTING_ICON_PITCH = 6.8;

export function sightingIconOffsets(count: number): number[] {
  return Array.from(
    { length: count },
    (_, index) => (index - (count - 1) / 2) * SIGHTING_ICON_PITCH,
  );
}

/** Singular and plural for the legend's spoken line — the owner's own words for the lines. */
const SIGHTING_ICON_NOUNS: Record<SightingIconKind, readonly [string, string]> = {
  spider: ["spider", "spiders"],
  stitch: ["Stitch", "Stitches"],
  grogu: ["Grogu", "Grogus"],
};

/**
 * `3 spiders, 1 Stitch, 1 Grogu` — what a screen reader hears for a legend chip, where a
 * sighted visitor sees three mini sprites and three numbers.
 */
export function sightingIconsLabel(icons: readonly SightingIcon[]): string {
  return icons
    .map(({ kind, count }) => `${count} ${SIGHTING_ICON_NOUNS[kind][count === 1 ? 0 : 1]}`)
    .join(", ");
}

function unchartedPlace(entry: PublicShelfEntry): string {
  const city = (entry.acquiredCity ?? "").trim().toUpperCase();
  const country = (entry.acquiredCountry ?? "").trim().toUpperCase();
  return [city, country].filter(Boolean).join(", ") || "SOMEWHERE";
}

/**
 * Where one row is: **its own columns first, the dictionary second.**
 *
 * That order and not the other one. The columns are the specific answer — this sighting, in
 * this city, resolved when it was saved — and the dictionary is the general one. In practice
 * the two never disagree, because the founding nine cities are NULL in the database on
 * purpose (no backfill: their coordinates were checked by hand and a gazetteer would only
 * move them by metres). The fallback is what keeps every row written before Phase 13, and
 * every row the geocoder could not place, exactly as placeable as it was.
 */
export function sightingCoordinate(entry: PublicShelfEntry): Coordinate | null {
  return (
    storedCoordinate(entry.acquiredLat, entry.acquiredLng) ??
    lookupCity(entry.acquiredCountry, entry.acquiredCity)
  );
}

/**
 * Group the public shelf by city, busiest first.
 *
 * Ties break on the city name so the legend's order never wobbles between two requests —
 * the same rule the flags row already follows. Figures that left the shelf are still pinned:
 * the map is a record of where things were found, and giving a Pop away does not un-visit
 * Amsterdam.
 *
 * **A city is placed if ANY of its rows can be placed**, which is why the coordinates are
 * collected in a pass of their own before anything is grouped. Two sources per row means a
 * city can be half-filled — four Kuala Lumpur figures added before Phase 13 and one after,
 * or one row whose lookup timed out beside one whose lookup worked — and a marker per
 * coordinate-bearing row would split one city into a pin and an UNCHARTED line. The cluster
 * is keyed by `(country, city)` exactly as before and takes the first coordinate any of its
 * rows knows, in shelf order.
 */
export function buildSightingsMap(entries: readonly PublicShelfEntry[]): SightingsMapData {
  const visible = filterShelf(entries);

  const coordinates = new Map<string, MapPoint>();
  for (const entry of visible) {
    const key = cityKey(entry.acquiredCountry, entry.acquiredCity);
    if (key === "" || coordinates.has(key)) continue;

    const coordinate = sightingCoordinate(entry);
    if (coordinate !== null) coordinates.set(key, projectEquirectangular(coordinate));
  }

  const grouped = new Map<string, { entries: PublicShelfEntry[]; point: MapPoint }>();
  const uncharted: UnchartedSighting[] = [];

  for (const entry of visible) {
    const key = cityKey(entry.acquiredCountry, entry.acquiredCity);
    const point = key === "" ? undefined : coordinates.get(key);

    if (point === undefined) {
      uncharted.push({ slug: entry.slug, name: entry.name, place: unchartedPlace(entry) });
      continue;
    }

    const bucket = grouped.get(key);
    if (bucket) bucket.entries.push(entry);
    else grouped.set(key, { entries: [entry], point });
  }

  const markers = [...grouped.entries()]
    .map(([key, { entries: found, point }]): CitySighting => {
      const [first] = found;
      return {
        key,
        city: (first.acquiredCity ?? "").trim().toUpperCase(),
        country: (first.acquiredCountry ?? "").trim().toUpperCase(),
        flag: countryFlagEmoji(first.acquiredCountry),
        count: found.length,
        category: dominantCategory(found.map((entry) => entry.category)),
        icons: sightingIcons(found.map((entry) => entry.category)),
        point,
      };
    })
    .sort((a, b) => b.count - a.count || a.city.localeCompare(b.city));

  return { markers, uncharted };
}

/** `9 CITIES · 19 SIGHTINGS` — the map's caption, or the gadget's idle line. */
export function sightingsMapCaption(data: SightingsMapData): string {
  const sightings = data.markers.reduce((sum, marker) => sum + marker.count, 0);
  if (sightings === 0) return "NO PLACES LOGGED YET";

  const cities = `${data.markers.length} ${data.markers.length === 1 ? "CITY" : "CITIES"}`;
  const found = `${sightings} ${sightings === 1 ? "SIGHTING" : "SIGHTINGS"}`;
  return `${cities} · ${found}`;
}
