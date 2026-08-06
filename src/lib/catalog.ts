import { CsvParseError, parseCsvWithHeader } from "./csv";
import { figureSlug, slugify } from "./slug";

/**
 * The curated Spider-Man catalog: CSV → validated `reference_figures` rows.
 *
 * The CSV in `data/catalog/spiderman.csv` is our own compilation of checklist facts
 * (pop numbers, names, product lines, exclusivity) with a `source_url` on every row —
 * see ADR-008 in docs/wiki/Decisions.md. This module is pure (text in, rows out) so the
 * seed script and the tests agree on exactly one interpretation of the file.
 */

/** Repo-relative path of the catalog CSV — shared by the seed script and its tests. */
export const CATALOG_CSV_PATH = "data/catalog/spiderman.csv";

/** Columns the CSV must declare, in any order. `notes` is triage prose, not a DB column. */
export const CATALOG_CSV_COLUMNS = [
  "pop_number",
  "name",
  "character",
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
 * Parses the catalog CSV into insert-ready rows with unique slugs.
 *
 * Throws {@link CsvParseError} on a missing column, a malformed number or a malformed
 * boolean — the seeder must refuse a broken file rather than write half a catalog.
 */
export function parseCatalogCsv(text: string): CatalogSeedRow[] {
  const { header, rows, lines } = parseCsvWithHeader(text);

  for (const column of CATALOG_CSV_COLUMNS) {
    if (!header.includes(column)) {
      throw new CsvParseError(`missing required column \`${column}\``, 1);
    }
  }

  const taken = new Set<string>();

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
