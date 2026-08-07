import { FIGURE_CATEGORIES, type FigureCategory } from "./categories";
import { type QuickAddErrorCode, type QuickAddFormFields, type QuickAddParse } from "./quick-add";

/**
 * The escape hatch for a catalog row that is simply wrong.
 *
 * The case is real and it happened on a shop floor: a box was scanned, UPCitemdb named the
 * product, the name matched a catalog row, the owner confirmed it — and the row's
 * `pop_number` was wrong, because ADR-008 seeded 240 rows out of hobbyist checklists and
 * checklists have typos. The confirm step could say "yes, that is the figure" and there was
 * no way at all to say "…but the number on the box is 1450, not 1405". The add had to be
 * abandoned or completed against a lie.
 *
 * So the confirm step now carries a quiet `WRONG DATA? FIX THIS FIGURE` link into `?step=fix`,
 * and this file is what that form is allowed to change: the four facts printed on the front of
 * a box. Everything else about the row — its slug, its UPC, its images, its provenance — is
 * untouched.
 *
 * **The slug deliberately does not follow the name.** `slug` is the natural key of the whole
 * catalog (CLAUDE.md, "Data ground rules"): it is what `/figure/<slug>` is, what the seeder
 * upserts on, and what every share link a friend has ever been sent points at. A correction is
 * usually a *typo* — the figure is the same figure — so regenerating the slug would break
 * live URLs to fix a spelling. Renames do not rewrite slugs; a genuinely different figure is
 * a different row.
 *
 * Pure, like `collection-form.ts` and `quick-add.ts`: the server action re-verifies the
 * session, calls this, and writes.
 */

/** The four columns the FIX form may set. */
export interface FixFigureInput {
  name: string;
  popNumber: number | null;
  category: FigureCategory;
  productLine: string | null;
  /** ADR-009 again: the denominator IS the `peter` bucket, so recategorising moves it. */
  countsTowardTotal: boolean;
}

function trimmedOrNull(value: string | undefined): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Validates the FIX form. Same shape and the same error codes as {@link parseNewFigureForm} —
 * it is the same four questions, asked about a row that already exists.
 *
 * The number stays optional here too. Multi-packs and convention exclusives ship without one,
 * and "the number is wrong" is sometimes "there is no number", which a required field could
 * not express.
 */
export function parseFixFigureForm(fields: QuickAddFormFields): QuickAddParse<FixFigureInput> {
  const errors: QuickAddErrorCode[] = [];

  const name = (fields.name ?? "").trim().replace(/\s+/g, " ");
  if (name.length === 0) errors.push("NAME_REQUIRED");

  const rawNumber = (fields.popNumber ?? "").trim().replace(/^#\s*/, "");
  let popNumber: number | null = null;
  if (rawNumber.length > 0) {
    if (!/^\d+$/.test(rawNumber)) {
      errors.push("BAD_NUMBER");
    } else {
      const parsed = Number.parseInt(rawNumber, 10);
      // Anything past an int4 column is a typo, not a Funko number.
      if (!Number.isSafeInteger(parsed) || parsed > 2147483647) errors.push("BAD_NUMBER");
      else popNumber = parsed;
    }
  }

  const rawCategory = (fields.category ?? "").trim().toLowerCase();
  const category = FIGURE_CATEGORIES.find((candidate) => candidate === rawCategory);
  if (!category) errors.push("BAD_CATEGORY");

  if (errors.length > 0) return { ok: false, errors };

  const resolved = category as FigureCategory;
  return {
    ok: true,
    value: {
      name,
      popNumber,
      category: resolved,
      productLine: trimmedOrNull(fields.productLine),
      countsTowardTotal: resolved === "peter",
    },
  };
}

export function fixFigureFormFields(formData: FormData): QuickAddFormFields {
  const fields: QuickAddFormFields = {};
  for (const key of [
    "referenceFigureId",
    "name",
    "popNumber",
    "category",
    "productLine",
    "upc",
    "via",
    "q",
  ]) {
    const value = formData.get(key);
    if (typeof value === "string") fields[key] = value;
  }
  return fields;
}

/** The sentence the correction leaves behind, so a later triage pass knows who decided. */
export function manualCorrectionNote(isoDate: string): string {
  return `manually corrected by owner ${isoDate}`;
}

/** Keep `review_note` a readable paragraph rather than an append-only log of a thousand lines. */
export const REVIEW_NOTE_LIMIT = 500;

/**
 * The new `review_note`: what was there, plus this correction, newest last.
 *
 * Appended rather than replaced because the note is the *history* of why a row was ever
 * doubted — a scanner UPC clash (Phase 7) writes into the same column, and losing that on the
 * first manual edit would erase the only record that two products share a barcode. The same
 * note is never written twice in a row (the owner correcting a figure twice on one day is one
 * correction), and the whole thing is trimmed from the FRONT when it gets long, because the
 * end is the part that is still true.
 */
export function appendReviewNote(existing: string | null | undefined, addition: string): string {
  const previous = (existing ?? "").trim();
  if (previous.length === 0) return addition;
  if (previous.endsWith(addition)) return previous;

  const joined = `${previous} · ${addition}`;
  return joined.length <= REVIEW_NOTE_LIMIT ? joined : `… ${joined.slice(-REVIEW_NOTE_LIMIT)}`;
}
