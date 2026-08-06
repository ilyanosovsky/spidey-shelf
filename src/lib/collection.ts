import { CsvParseError, parseCsvWithHeader } from "./csv";

/**
 * The owner's shelf: CSV → validated `owned_figures` rows, plus the pure matching logic
 * that ties each row to a catalog figure.
 *
 * `data/collection/owned.csv` is a transcription of the owner's Notion table — 19 figures
 * with the place and date he picked each one up. It exists so the collection can be rebuilt
 * from the repo instead of retyped, and so the admin CRUD has real data to be tested against.
 *
 * Everything here is pure (text and plain objects in, rows out); the database work lives in
 * `scripts/seed-owned.ts`.
 */

/** Repo-relative path of the collection CSV — shared by the seed script and its tests. */
export const OWNED_CSV_PATH = "data/collection/owned.csv";

/** Columns the CSV must declare, in any order. `notes` is prose for the human, not a column. */
export const OWNED_CSV_COLUMNS = [
  "pop_number",
  "name",
  "status",
  "acquired_at",
  "acquired_city",
  "acquired_country",
  "notes",
] as const;

/** Notion's two states. A figure that left the shelf keeps its row and its story. */
export const OWNED_STATUSES = ["mine", "not_mine_anymore"] as const;

export type OwnedStatus = (typeof OWNED_STATUSES)[number];

/** One row of the collection CSV, already validated. */
export interface OwnedSeedRow {
  /** The number printed on the box — the first half of the catalog lookup. */
  popNumber: number;
  /** The owner's own wording; matched fuzzily against the catalog name. */
  name: string;
  status: OwnedStatus;
  /** ISO `YYYY-MM-DD`. */
  acquiredAt: string;
  acquiredCity: string;
  /** ISO 3166-1 alpha-2, uppercase. */
  acquiredCountry: string;
  /** 1-based line in the CSV — quoted back when a row cannot be matched. */
  line: number;
}

function required(value: string, column: string, line: number): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new CsvParseError(`\`${column}\` is required`, line);
  }
  return trimmed;
}

function parsePopNumber(value: string, line: number): number {
  const trimmed = required(value, "pop_number", line);
  if (!/^\d+$/.test(trimmed)) {
    throw new CsvParseError(`\`pop_number\` must be a whole number, found \`${trimmed}\``, line);
  }
  return Number.parseInt(trimmed, 10);
}

function parseStatus(value: string, line: number): OwnedStatus {
  const trimmed = required(value, "status", line).toLowerCase();
  const match = OWNED_STATUSES.find((status) => status === trimmed);
  if (!match) {
    throw new CsvParseError(
      `\`status\` must be one of ${OWNED_STATUSES.join(", ")}, found \`${trimmed}\``,
      line,
    );
  }
  return match;
}

/** `YYYY-MM-DD` in shape only — says nothing about February 30th. */
export function looksLikeIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/**
 * A date that exists. The shape check alone happily accepts `2025-02-30`, which Postgres
 * then rejects halfway through a seed (or a form submit).
 */
export function isRealIsoDate(value: string): boolean {
  if (!looksLikeIsoDate(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function parseIsoDate(value: string, line: number): string {
  const trimmed = required(value, "acquired_at", line);
  if (!looksLikeIsoDate(trimmed)) {
    throw new CsvParseError(`\`acquired_at\` must be YYYY-MM-DD, found \`${trimmed}\``, line);
  }
  if (!isRealIsoDate(trimmed)) {
    throw new CsvParseError(`\`acquired_at\` is not a real date: \`${trimmed}\``, line);
  }
  return trimmed;
}

function parseCountry(value: string, line: number): string {
  const trimmed = required(value, "acquired_country", line).toUpperCase();
  if (!/^[A-Z]{2}$/.test(trimmed)) {
    throw new CsvParseError(
      `\`acquired_country\` must be a 2-letter ISO code, found \`${trimmed}\``,
      line,
    );
  }
  return trimmed;
}

/** Parses the collection CSV. Throws {@link CsvParseError} rather than seed a broken shelf. */
export function parseOwnedCsv(text: string): OwnedSeedRow[] {
  const { header, rows, lines } = parseCsvWithHeader(text);

  for (const column of OWNED_CSV_COLUMNS) {
    if (!header.includes(column)) {
      throw new CsvParseError(`missing required column \`${column}\``, 1);
    }
  }

  return rows.map((row, index) => {
    const line = lines[index];
    return {
      popNumber: parsePopNumber(row.pop_number, line),
      name: required(row.name, "name", line),
      status: parseStatus(row.status, line),
      acquiredAt: parseIsoDate(row.acquired_at, line),
      acquiredCity: required(row.acquired_city, "acquired_city", line),
      acquiredCountry: parseCountry(row.acquired_country, line),
      line,
    };
  });
}

/** The slice of a catalog row the matcher needs — so it can run against a test fixture. */
export interface ReferenceCandidate {
  id: string;
  popNumber: number | null;
  name: string;
}

export interface OwnedMatch {
  row: OwnedSeedRow;
  reference: ReferenceCandidate;
  /** 1 = the names are the same string once normalized. */
  score: number;
}

export interface OwnedMiss {
  row: OwnedSeedRow;
  reason: string;
}

export interface OwnedResolution {
  matches: OwnedMatch[];
  misses: OwnedMiss[];
}

/** A match must clear this, so a wrong number never drags in an unrelated figure. */
export const MIN_NAME_SCORE = 0.5;

/** Lowercase, punctuation → spaces. `Peter Parker (Advanced Suit 2.0)` → `peter parker advanced suit 2 0`. */
function normalizeName(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokens(value: string): Set<string> {
  return new Set(value.split(" ").filter(Boolean));
}

/**
 * How close two figure names are, in `[0, 1]`.
 *
 * The owner types what is on his shelf ("Spider-Man Amazon Exclusive"), the catalog carries
 * the checklist wording ("Spider-Man", exclusivity `Amazon`), so this cannot be an equality
 * test. Only an exact normalized match scores 1; word order does not matter
 * ("Deadpool Sleepover" = "Sleepover Deadpool"); and one name being fully contained in the
 * other ("Deadpool" ⊂ "Deadpool (Hearts Wolverine)") scores high but never top, so a real
 * exact match always wins a tie.
 */
export function nameScore(a: string, b: string): number {
  const left = normalizeName(a);
  const right = normalizeName(b);
  if (left.length === 0 || right.length === 0) return 0;
  if (left === right) return 1;

  const leftTokens = tokens(left);
  const rightTokens = tokens(right);
  let shared = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) shared += 1;
  }
  if (shared === 0) return 0;

  const union = leftTokens.size + rightTokens.size - shared;
  const jaccard = shared / union;
  const containment = shared / Math.min(leftTokens.size, rightTokens.size);
  return Math.max(jaccard, containment * 0.9);
}

/**
 * Resolves one shelf row to a catalog figure: exact `pop_number`, then the best name.
 *
 * `pop_number` is not unique (#3 alone has four Spider-Man variants), so the number only
 * narrows the field and the name decides. A tie between two equally-good candidates is a
 * miss, not a coin flip — the seeder would otherwise pick a variant at random and the owner
 * would never know which one his figure became.
 */
export function matchOwnedRow(
  row: OwnedSeedRow,
  references: readonly ReferenceCandidate[],
): OwnedMatch | OwnedMiss {
  const candidates = references.filter((reference) => reference.popNumber === row.popNumber);
  if (candidates.length === 0) {
    return { row, reason: `no catalog figure with pop_number ${row.popNumber}` };
  }

  const scored = candidates
    .map((reference) => ({ reference, score: nameScore(row.name, reference.name) }))
    .sort((a, b) => b.score - a.score);

  const best = scored[0];

  // A single candidate is the answer even when the wording differs a lot — the number was
  // read off the box, and nothing else claims it.
  if (candidates.length === 1) {
    return { row, reference: best.reference, score: best.score };
  }

  if (best.score < MIN_NAME_SCORE) {
    return {
      row,
      reason: `#${row.popNumber} has ${candidates.length} catalog rows and none matches the name "${row.name}"`,
    };
  }

  if (scored[1]?.score === best.score) {
    const tied = scored
      .filter((entry) => entry.score === best.score)
      .map((entry) => entry.reference.name)
      .join(" / ");
    return { row, reason: `#${row.popNumber} "${row.name}" is ambiguous between: ${tied}` };
  }

  return { row, reference: best.reference, score: best.score };
}

/** Runs {@link matchOwnedRow} over the whole shelf and splits the result in two. */
export function resolveOwnedRows(
  rows: readonly OwnedSeedRow[],
  references: readonly ReferenceCandidate[],
): OwnedResolution {
  const matches: OwnedMatch[] = [];
  const misses: OwnedMiss[] = [];

  for (const row of rows) {
    const result = matchOwnedRow(row, references);
    if ("reference" in result) matches.push(result);
    else misses.push(result);
  }

  return { matches, misses };
}
