import { FIGURE_CATEGORIES, type FigureCategory } from "./categories";
import { countryFlagEmoji } from "./format";
import { cityKey, lookupCity, projectEquirectangular, type MapPoint } from "./geo";
import { filterShelf, type PublicShelfEntry } from "./showcase";

/**
 * The shelf as a set of pins — everything the SIGHTINGS MAP draws, minus the drawing.
 *
 * Pure over `PublicShelfEntry[]`, like the rest of `src/lib/*`: the component turns these
 * rows into `<rect>`s and text and decides nothing. Two outputs, because a travel map has two
 * honest answers:
 *   · **markers** — the cities the dictionary knows, one pin per city with a count;
 *   · **uncharted** — the figures whose place it does not, listed by name underneath rather
 *     than dropped. A map that silently loses a figure is worse than a map that admits it
 *     does not know where Milan is.
 */

/** One pin: a city, everything found there, and where it lands on the map. */
export interface CitySighting {
  /** `il:haifa` — the dictionary key, and a stable React key. */
  key: string;
  /** The owner's own spelling, uppercased: `HAIFA`, `LA`, `MALLORCA`. */
  city: string;
  /** ISO 3166-1 alpha-2, uppercase. */
  country: string;
  flag: string;
  count: number;
  /** The bucket most of this city's figures belong to — the pin's colour. */
  category: FigureCategory;
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

function unchartedPlace(entry: PublicShelfEntry): string {
  const city = (entry.acquiredCity ?? "").trim().toUpperCase();
  const country = (entry.acquiredCountry ?? "").trim().toUpperCase();
  return [city, country].filter(Boolean).join(", ") || "SOMEWHERE";
}

/**
 * Group the public shelf by city, busiest first.
 *
 * Ties break on the city name so the legend's order never wobbles between two requests —
 * the same rule the flags row already follows. Figures that left the shelf are still pinned:
 * the map is a record of where things were found, and giving a Pop away does not un-visit
 * Amsterdam.
 */
export function buildSightingsMap(entries: readonly PublicShelfEntry[]): SightingsMapData {
  const grouped = new Map<string, { entries: PublicShelfEntry[]; point: MapPoint }>();
  const uncharted: UnchartedSighting[] = [];

  for (const entry of filterShelf(entries)) {
    const key = cityKey(entry.acquiredCountry, entry.acquiredCity);
    const coordinate = lookupCity(entry.acquiredCountry, entry.acquiredCity);

    if (key === "" || coordinate === null) {
      uncharted.push({ slug: entry.slug, name: entry.name, place: unchartedPlace(entry) });
      continue;
    }

    const bucket = grouped.get(key);
    if (bucket) bucket.entries.push(entry);
    else grouped.set(key, { entries: [entry], point: projectEquirectangular(coordinate) });
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
