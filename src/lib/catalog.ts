import { FIGURE_CATEGORIES, type FigureCategory } from "./categories";
import { CsvParseError, parseCsvWithHeader } from "./csv";
import { figureSlug, slugify } from "./slug";

/**
 * The curated catalog: CSV → validated `reference_figures` rows.
 *
 * `data/catalog/spiderman.csv` is our own compilation of checklist facts (pop numbers,
 * names, product lines, exclusivity) with a `source_url` on every row — see ADR-008 in
 * docs/wiki/Decisions.md. `data/catalog/others-manual.csv` holds the handful of non
 * Spider-Man figures the owner actually owns, so his shelf can be entered against a real
 * catalog row instead of a free-text name.
 *
 * The seeder loads **every** `data/catalog/*.csv`, in the order of {@link CATALOG_CSV_PATHS},
 * as one file: slugs are deduped across the whole set, so a row can never silently take a
 * slug that another file already claimed.
 *
 * This module is pure (text in, rows out) so the seed script and the tests agree on exactly
 * one interpretation of the files.
 */

/**
 * Repo-relative paths of the catalog CSVs — shared by the seed script and its tests.
 * Order is load order, and load order decides who wins a contested slug: the Spider-Man
 * catalog was seeded first in Phase 2 and must keep every slug it already has.
 */
export const CATALOG_CSV_PATHS = [
  "data/catalog/spiderman.csv",
  "data/catalog/others-manual.csv",
] as const;

/** The Spider-Man catalog on its own — the file the `counts_toward_total` rules apply to. */
export const CATALOG_CSV_PATH = CATALOG_CSV_PATHS[0];

/** Columns the CSV must declare, in any order. `notes` is triage prose, not a DB column. */
export const CATALOG_CSV_COLUMNS = [
  "pop_number",
  "name",
  "character",
  "category",
  "product_line",
  "release_year",
  "exclusivity",
  "variant_flags",
  "counts_toward_total",
  "source",
  "source_url",
  "needs_review",
  "notes",
] as const;

/** One catalog row, shaped for `db.insert(referenceFigures)`. */
export interface CatalogSeedRow {
  /** Natural key. Unique across the whole file — see {@link parseCatalogCsv}. */
  slug: string;
  popNumber: number | null;
  name: string;
  character: string | null;
  /** ADR-009 bucket. Required in the CSV — a blank cell is a parse error, never a default. */
  category: FigureCategory;
  productLine: string | null;
  releaseYear: number | null;
  exclusivity: string | null;
  variantFlags: string[];
  countsTowardTotal: boolean;
  source: string | null;
  sourceUrl: string | null;
  needsReview: boolean;
}

function textOrNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseIntegerOrNull(value: string, column: string, line: number): number | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  if (!/^\d+$/.test(trimmed)) {
    throw new CsvParseError(`\`${column}\` must be a whole number, found \`${trimmed}\``, line);
  }
  return Number.parseInt(trimmed, 10);
}

function parseBoolean(value: string, column: string, line: number, fallback: boolean): boolean {
  const trimmed = value.trim().toLowerCase();
  if (trimmed.length === 0) return fallback;
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  throw new CsvParseError(`\`${column}\` must be true or false, found \`${value}\``, line);
}

/**
 * The taxonomy bucket. Deliberately has no fallback: the column's DB default (`other`) is
 * there for rows written by the admin UI, but a curated CSV row with a blank or unknown
 * category is a mistake in the file, and a silent `other` would hide it forever.
 */
function parseCategory(value: string, line: number): FigureCategory {
  const trimmed = value.trim().toLowerCase();
  if (trimmed.length === 0) {
    throw new CsvParseError("`category` is required", line);
  }
  const match = FIGURE_CATEGORIES.find((category) => category === trimmed);
  if (!match) {
    throw new CsvParseError(
      `\`category\` must be one of ${FIGURE_CATEGORIES.join(", ")}, found \`${value.trim()}\``,
      line,
    );
  }
  return match;
}

/** `chase|glow` → `["chase", "glow"]`; empty → `[]` (never null, so queries need no guard). */
function parseVariantFlags(value: string): string[] {
  return value
    .split("|")
    .map((flag) => flag.trim())
    .filter((flag) => flag.length > 0);
}

/** True when `token` already appears as a whole dash-delimited segment run inside `slug`. */
function slugContains(slug: string, token: string): boolean {
  return `-${slug}-`.includes(`-${token}-`);
}

/**
 * Deterministic slug for a catalog row.
 *
 * Base is `figureSlug(product_line, name, pop_number)`. When that is already taken — the
 * same figure listed twice under different exclusives — the row falls through a fixed
 * ladder of suffixes: variant flags, then exclusivity, then a numeric tail. Suffix parts
 * that the base already spells out (a name like "Spider-Man Metallic" with the `metallic`
 * flag) are skipped so slugs do not stutter.
 *
 * Order matters: the first row in the file to claim a slug keeps it, so appending rows to
 * the CSV never rewrites the slug of an existing figure (and therefore never orphans a URL
 * or an `owned_figures` FK).
 */
export function catalogSlug(
  row: Pick<CatalogSeedRow, "name" | "productLine" | "popNumber" | "variantFlags" | "exclusivity">,
  taken: ReadonlySet<string>,
): string {
  const base = figureSlug(row.productLine ?? "", row.name, row.popNumber);
  const suffixes = [row.variantFlags.join(" "), row.exclusivity ?? ""]
    .map((part) => slugify(part))
    .filter((part) => part.length > 0 && !slugContains(base, part));

  let candidate = base;
  if (!taken.has(candidate)) return candidate;

  for (const suffix of suffixes) {
    candidate = `${candidate}-${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }

  let counter = 2;
  while (taken.has(`${candidate}-${counter}`)) counter += 1;
  return `${candidate}-${counter}`;
}

/**
 * Parses one catalog CSV into insert-ready rows with unique slugs.
 *
 * Throws {@link CsvParseError} on a missing column, a malformed number, a malformed boolean
 * or an unknown category — the seeder must refuse a broken file rather than write half a
 * catalog.
 *
 * `taken` lets several files share one slug namespace; see {@link parseCatalogCsvFiles}.
 */
export function parseCatalogCsv(text: string, taken: Set<string> = new Set()): CatalogSeedRow[] {
  const { header, rows, lines } = parseCsvWithHeader(text);

  for (const column of CATALOG_CSV_COLUMNS) {
    if (!header.includes(column)) {
      throw new CsvParseError(`missing required column \`${column}\``, 1);
    }
  }

  return rows.map((row, index) => {
    const line = lines[index];
    const name = row.name.trim();
    if (name.length === 0) {
      throw new CsvParseError("`name` is required", line);
    }

    const parsed = {
      popNumber: parseIntegerOrNull(row.pop_number, "pop_number", line),
      name,
      character: textOrNull(row.character),
      category: parseCategory(row.category, line),
      productLine: textOrNull(row.product_line),
      releaseYear: parseIntegerOrNull(row.release_year, "release_year", line),
      exclusivity: textOrNull(row.exclusivity),
      variantFlags: parseVariantFlags(row.variant_flags),
      countsTowardTotal: parseBoolean(row.counts_toward_total, "counts_toward_total", line, true),
      source: textOrNull(row.source),
      sourceUrl: textOrNull(row.source_url),
      needsReview: parseBoolean(row.needs_review, "needs_review", line, false),
    };

    const slug = catalogSlug(parsed, taken);
    taken.add(slug);
    return { slug, ...parsed };
  });
}

/** One catalog file, already read off disk by the caller. */
export interface CatalogCsvFile {
  /** Repo-relative path — only used to name the file in error messages. */
  path: string;
  text: string;
}

/**
 * Parses every catalog CSV as one catalog, with a single shared slug namespace.
 *
 * A `CsvParseError` from any file is re-thrown with the file name in front of it, because
 * "CSV line 42" is useless once there is more than one CSV.
 */
export function parseCatalogCsvFiles(files: readonly CatalogCsvFile[]): CatalogSeedRow[] {
  const taken = new Set<string>();
  const rows: CatalogSeedRow[] = [];

  for (const file of files) {
    try {
      rows.push(...parseCatalogCsv(file.text, taken));
    } catch (error) {
      if (error instanceof CsvParseError) {
        throw new CsvParseError(error.detail, error.line, file.path);
      }
      throw error;
    }
  }

  return rows;
}
