import { isRealIsoDate, looksLikeIsoDate, OWNED_STATUSES, type OwnedStatus } from "./collection";

/**
 * Everything the admin collection forms decide before a database is involved.
 *
 * Kept pure and free of `server-only` on purpose: the server actions in
 * `src/app/admin/collection/actions.ts` are thin wrappers around these functions
 * (re-verify the session, parse, write), so the rules can be tested without a session,
 * a request or a database.
 */

/** How the search box reads one input: a box number, or words. */
export type ReferenceSearchQuery =
  | { kind: "empty" }
  | { kind: "number"; popNumber: number; raw: string }
  | { kind: "text"; text: string };

/** Long enough to be worth a trigram scan; shorter input just waits for another keystroke. */
export const MIN_SEARCH_TEXT_LENGTH = 2;

/**
 * One input, two searches. A run of digits is the number printed on the box, which is an
 * exact lookup; anything else is a name, which is full-text + trigram. `1450` is never
 * treated as a word — a Funko number is the single most precise thing the owner can type.
 */
export function parseReferenceSearchQuery(raw: string): ReferenceSearchQuery {
  const trimmed = raw.trim().replace(/\s+/g, " ");
  if (trimmed.length === 0) return { kind: "empty" };

  if (/^#?\d+$/.test(trimmed)) {
    const digits = trimmed.replace("#", "");
    const popNumber = Number.parseInt(digits, 10);
    // A number long enough to overflow an int column is a typo, not a pop number.
    if (Number.isSafeInteger(popNumber) && popNumber <= 2147483647) {
      return { kind: "number", popNumber, raw: trimmed };
    }
  }

  if (trimmed.length < MIN_SEARCH_TEXT_LENGTH) return { kind: "empty" };
  return { kind: "text", text: trimmed };
}

/** The columns an admin form is allowed to write on `owned_figures`. */
export interface OwnedFigureInput {
  referenceFigureId: string;
  status: OwnedStatus;
  acquiredAt: string;
  acquiredCity: string | null;
  acquiredCountry: string | null;
  story: string | null;
  isPublic: boolean;
}

export type OwnedFigureFormFields = Record<string, string | undefined>;

export type OwnedFigureFormResult =
  { ok: true; value: OwnedFigureInput } | { ok: false; errors: string[] };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function trimmedOrNull(value: string | undefined): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Validates a submitted add/edit form.
 *
 * Errors are collected, not thrown one at a time: a form that fixes one field per round
 * trip is a bad form, and this one is used on a phone in a shop.
 */
export function parseOwnedFigureForm(fields: OwnedFigureFormFields): OwnedFigureFormResult {
  const errors: string[] = [];

  const referenceFigureId = (fields.referenceFigureId ?? "").trim();
  if (!UUID_PATTERN.test(referenceFigureId)) {
    errors.push("PICK A FIGURE FROM THE CATALOG");
  }

  const statusRaw = (fields.status ?? "").trim();
  const status = OWNED_STATUSES.find((value) => value === statusRaw);
  if (!status) {
    errors.push("STATUS MUST BE MINE OR NOT MINE ANYMORE");
  }

  const acquiredAt = (fields.acquiredAt ?? "").trim();
  if (!looksLikeIsoDate(acquiredAt)) {
    errors.push("DATE MUST BE YYYY-MM-DD");
  } else if (!isRealIsoDate(acquiredAt)) {
    errors.push("THAT DATE DOES NOT EXIST");
  }

  const acquiredCountryRaw = trimmedOrNull(fields.acquiredCountry);
  const acquiredCountry = acquiredCountryRaw?.toUpperCase() ?? null;
  if (acquiredCountry !== null && !/^[A-Z]{2}$/.test(acquiredCountry)) {
    errors.push("COUNTRY MUST BE A 2-LETTER CODE");
  }

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      referenceFigureId,
      status: status as OwnedStatus,
      acquiredAt,
      acquiredCity: trimmedOrNull(fields.acquiredCity),
      acquiredCountry,
      story: trimmedOrNull(fields.story),
      // An unchecked checkbox sends nothing at all, so absence means false.
      isPublic: fields.isPublic === "on" || fields.isPublic === "true",
    },
  };
}

/** `FormData` → the plain record {@link parseOwnedFigureForm} takes. */
export function ownedFigureFormFields(formData: FormData): OwnedFigureFormFields {
  const fields: OwnedFigureFormFields = {};
  for (const key of [
    "referenceFigureId",
    "status",
    "acquiredAt",
    "acquiredCity",
    "acquiredCountry",
    "story",
    "isPublic",
  ]) {
    const value = formData.get(key);
    if (typeof value === "string") fields[key] = value;
  }
  return fields;
}
