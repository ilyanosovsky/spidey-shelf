/**
 * Reading UPCitemdb's answer, and guessing a Funko out of a retailer's product title.
 *
 * Both halves are pure on purpose. The network call lives in `./lookup.ts` behind
 * `server-only`; everything that decides what the answer MEANS is here, so the four
 * outcomes that matter (a product, no such barcode, the daily limit, and "the internet
 * happened") are argued about in a unit test rather than against a live API we are only
 * allowed to call a hundred times a day.
 *
 * The service is the free trial tier: no key, 100 requests/day per IP, and it will answer
 * 429 long before it answers politely. None of that may ever reach the owner as an
 * exception — a scanner that throws a stack trace at somebody standing in a shop is worse
 * than one that says TYPE THE NUMBER.
 */

/** The free trial endpoint. No key, no auth header, 100 calls/day per IP. */
export const UPCITEMDB_ENDPOINT = "https://api.upcitemdb.com/prod/trial/lookup";

/** How long we wait before deciding the lookup is not coming. */
export const UPCITEMDB_TIMEOUT_MS = 5000;

export function upcItemDbUrl(upc: string): string {
  return `${UPCITEMDB_ENDPOINT}?upc=${encodeURIComponent(upc)}`;
}

/**
 * What the lookup came back with. Four cases, and three of them are "no product".
 *
 * They are kept apart because the screen says something different for each: a miss offers
 * ADD AS NEW FIGURE, a rate limit offers the keyboard and promises nothing, and an
 * unavailable service is the same promise with a different reason.
 */
export type UpcLookupOutcome =
  | { kind: "hit"; title: string; brand: string | null }
  | { kind: "not_found" }
  | { kind: "rate_limited" }
  | { kind: "unavailable" };

interface UpcItemDbItem {
  title?: unknown;
  brand?: unknown;
}

interface UpcItemDbBody {
  code?: unknown;
  items?: unknown;
}

function text(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.replace(/\s+/g, " ").trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * The HTTP status and the parsed JSON body → one of four outcomes.
 *
 * Both signals are read because UPCitemdb uses both and they disagree: a rate limit is a
 * 429 with `EXCEED_LIMIT` or `TOO_FAST`, but an unknown barcode has been observed as a 404
 * AND as a 200 with an empty `items` array. The rule is the union — if either channel says
 * "slow down" it is a rate limit, and a body with no usable title is a miss whatever the
 * status line claims.
 *
 * Anything unrecognised (HTML from a captive portal, a truncated body, `null`) lands on
 * `unavailable`, never on an exception.
 */
export function parseUpcItemDbResponse(status: number, body: unknown): UpcLookupOutcome {
  const parsed: UpcItemDbBody = typeof body === "object" && body !== null ? body : {};
  const code = text(parsed.code)?.toUpperCase() ?? "";

  if (status === 429 || code === "EXCEED_LIMIT" || code === "TOO_FAST") {
    return { kind: "rate_limited" };
  }

  if (
    status === 404 ||
    code === "NOT_FOUND" ||
    code === "INVALID_UPC" ||
    code === "INVALID_QUERY"
  ) {
    return { kind: "not_found" };
  }

  // 5xx, a proxy's HTML error page, a body that is not an object at all.
  if (status < 200 || status >= 300) return { kind: "unavailable" };
  if (typeof body !== "object" || body === null) return { kind: "unavailable" };

  const items = Array.isArray(parsed.items) ? parsed.items : null;
  if (items === null) return { kind: "unavailable" };

  for (const raw of items) {
    const item: UpcItemDbItem = typeof raw === "object" && raw !== null ? raw : {};
    const title = text(item.title);
    // The first item WITH a title wins: the array is ordered by their own confidence, and
    // an entry that only carries offers and no name tells us nothing to match on.
    if (title) return { kind: "hit", title, brand: text(item.brand) };
  }

  return { kind: "not_found" };
}

/* ------------------------------------------------------------------ the title heuristic */

/** What a retailer's title is worth once the packaging words are taken off it. */
export interface ParsedProductTitle {
  /** The best guess at the figure's name, or `null` when nothing survived. */
  name: string | null;
  /** `#1450` if the title printed one. */
  popNumber: number | null;
}

/**
 * Words that describe the packaging or the shelf it sits on, not the figure. Stripped from
 * the front of a title and from the back of it, **never from the middle** — otherwise
 * "Spider-Man vs. Venom" would lose its middle and stop being a name.
 *
 * Deliberately short. Every word added here is a word no Funko figure may be called, and
 * the list has already lost "new", "brand" and "the" for failing that test: dropping them
 * turned `Spider-Man: Brand New Day` into `Day`.
 */
const NOISE_TOKENS = new Set([
  "funko",
  "pop",
  "pop!",
  "pops",
  "pops!",
  "vinyl",
  "figure",
  "figures",
  "bobble",
  "bobblehead",
  "bobble-head",
  "collectible",
  "collectibles",
  "toy",
  "toys",
  "multicolor",
  "multicolour",
  "marvel",
  "disney",
  "comics",
  "amazon",
  "walmart",
  "target",
  "gamestop",
]);

/** Phrases dropped wherever they appear — they are never part of a figure's name. */
const NOISE_PHRASES = [
  /\bvinyl\s+(?:bobble[-\s]?head|figure|collectible)s?\b/gi,
  /\bbobble[-\s]?head\b/gi,
  /\bcollectible\s+figure\b/gi,
  /\baction\s+figure\b/gi,
  /\bstyles?\s+may\s+vary\b/gi,
  /\b\d+(?:\.\d+)?\s*(?:inch(?:es)?|in\.|")/gi,
  /\bmulti[-\s]?colou?r\b/gi,
];

/** A pop number as titles print it: `#1450`, `# 1450`, `No. 1450`, `Number 1450`. */
const POP_NUMBER_PATTERN = /(?:#|\bno\.?\s*|\bnumber\s+)\s*(\d{1,5})\b/i;

function stripNoiseTokens(value: string): string {
  let tokens = value.split(" ").filter((token) => token.length > 0);

  const isNoise = (token: string) => NOISE_TOKENS.has(token.toLowerCase().replace(/[.,:;!]+$/, ""));

  // Never strip to nothing: a title that is ALL packaging words has no name in it, and
  // returning its last accidental word would be worse than returning null.
  while (tokens.length > 1 && isNoise(tokens[0])) tokens = tokens.slice(1);
  while (tokens.length > 1 && isNoise(tokens[tokens.length - 1])) tokens = tokens.slice(0, -1);
  if (tokens.length === 1 && isNoise(tokens[0])) tokens = [];

  return tokens.join(" ");
}

/**
 * `Funko POP! Marvel Spider-Man Last Stand #1450 Vinyl Figure` → `Spider-Man Last Stand`, 1450.
 *
 * A heuristic, and it says so: this is the input to a fuzzy catalog search and to a
 * prefilled form the owner is looking at, never to a write. Getting it slightly wrong
 * costs him one edit; refusing to guess costs him the whole typed entry.
 *
 * Three moves, in order:
 *   1. **the number first**, because `#1450` is the most precise thing in the string and
 *      pulling it out early stops it polluting the name;
 *   2. **the last segment wins** — retailers write `<brand>: <line> - <figure>`, so what
 *      is behind the final separator is the figure, and everything before it is shelf
 *      taxonomy we already have in `product_line`;
 *   3. **packaging words off both ends**, never out of the middle.
 */
export function parseProductTitle(rawTitle: string | null | undefined): ParsedProductTitle {
  const title = (rawTitle ?? "").replace(/\s+/g, " ").trim();
  if (title.length === 0) return { name: null, popNumber: null };

  const numberMatch = title.match(POP_NUMBER_PATTERN);
  const popNumber = numberMatch ? Number.parseInt(numberMatch[1], 10) : null;

  let working = numberMatch ? title.replace(POP_NUMBER_PATTERN, " ") : title;
  for (const phrase of NOISE_PHRASES) working = working.replace(phrase, " ");

  const segments = working
    .split(/\s+[-–—]\s+|:\s+|\s*\|\s*/)
    .map((segment) => stripNoiseTokens(segment.replace(/\s+/g, " ").trim()))
    .filter((segment) => segment.length > 0);

  const name = segments.length > 0 ? tidy(segments[segments.length - 1]) : null;

  return {
    name: name && name.length > 0 ? name : null,
    // A four-digit "number" that is really a year is still a number the owner can delete.
    popNumber: popNumber !== null && popNumber > 0 ? popNumber : null,
  };
}

/** Leftover punctuation from the words that were just removed. */
function tidy(value: string): string {
  return value
    .replace(/\s*[,;:]\s*$/, "")
    .replace(/^\s*[,;:]\s*/, "")
    .replace(/\(\s*\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
