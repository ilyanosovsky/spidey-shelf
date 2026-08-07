import { normalizeScannedCode } from "./barcode/upc";
import { FIGURE_CATEGORIES, type FigureCategory } from "./categories";
import { resolveCountryCode } from "./countries";
import { isRealIsoDate, looksLikeIsoDate, OWNED_STATUSES, type OwnedStatus } from "./collection";
import { parseReferenceSearchQuery } from "./collection-form";
import { formatSightingDate } from "./format";

/**
 * Quick Add — everything the add flow decides, minus the database.
 *
 * The realistic way a collection tracker dies is that adding a figure takes ninety seconds
 * and the owner stops bothering. So the flow is: search (or scan) → tap → confirm → save,
 * story later. Each step is a URL (`/admin/add?step=…`), which means every one of them is a
 * plain server render: the phone in the shop has one bar of wifi, and a form that works
 * before hydration is a form that works. The only client JavaScript in the whole flow is the
 * camera, and it is not downloaded until the SCAN button is pressed (`src/lib/barcode/`).
 *
 * Because the steps are URLs, the things that could go wrong are URLs too — see
 * {@link parseQuickAddStep} and {@link QUICK_ADD_ERRORS}. Nothing in this file touches a
 * request, a session or Drizzle; `src/lib/collection-queries.ts` fetches, the server actions
 * in `src/app/admin/add/actions.ts` re-verify the session and write.
 */

/* ------------------------------------------------------------------ steps and URLs */

/**
 * The frames of the flow, in the order the owner walks them.
 *
 * `scan-result` (Phase 7) is a landing frame, not a screen he navigates to: the overlay
 * submits the decoded barcode into it, and it either forwards to `confirm` (the catalog
 * knew the code), renders the candidates it found, or hands over to `new`.
 *
 * `fix` (Phase 12) is a detour off `confirm` rather than a step of its own: "yes, that is the
 * figure, but the number on it is wrong". It edits the catalog row and comes straight back.
 */
export const QUICK_ADD_STEPS = [
  "identify",
  "scan-result",
  "new",
  "confirm",
  "fix",
  "details",
  "done",
] as const;

export type QuickAddStep = (typeof QUICK_ADD_STEPS)[number];

/** The bare `/admin/add` — an autofocused search box and nothing else. */
export const DEFAULT_QUICK_ADD_STEP: QuickAddStep = "identify";

/** A repeated query parameter takes its first value, exactly like `?cat=` and `?q=`. */
export function firstParam(raw: string | string[] | undefined): string | undefined {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === "string" ? value : undefined;
}

/**
 * `?step=confirm` → `confirm`.
 *
 * Anything unknown falls back to the first step rather than 404: a mistyped or truncated URL
 * should drop the owner into the search box, which is where he wanted to be anyway.
 */
export function parseQuickAddStep(raw: string | string[] | undefined): QuickAddStep {
  const value = firstParam(raw)?.trim().toLowerCase();
  const step = QUICK_ADD_STEPS.find((candidate) => candidate === value);
  return step ?? DEFAULT_QUICK_ADD_STEP;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * `?ref=…` → a uuid, or `null`.
 *
 * Validated before it reaches a query, not after: Postgres rejects a malformed uuid with an
 * error, and an error page is a worse answer to a fat-fingered URL than the search box.
 */
export function parseUuidParam(raw: string | string[] | undefined): string | null {
  const value = firstParam(raw)?.trim() ?? "";
  return UUID_PATTERN.test(value) ? value.toLowerCase() : null;
}

export type QuickAddParams = Record<string, string | number | null | undefined>;

/** The canonical URL of a step. `identify` is the bare path — the default is never in the bar. */
export function quickAddHref(step: QuickAddStep, params: QuickAddParams = {}): string {
  const search = new URLSearchParams();
  if (step !== DEFAULT_QUICK_ADD_STEP) search.set("step", step);

  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === "") continue;
    search.set(key, String(value));
  }

  const query = search.toString();
  return query.length > 0 ? `/admin/add?${query}` : "/admin/add";
}

/* ------------------------------------------------------------------ errors */

/**
 * The closed set of things a Quick Add form can complain about.
 *
 * Errors travel back to the owner as `?err=CODE,CODE` rather than as text, for two reasons:
 * the steps are server-rendered with no `useActionState` to hold state in, and a message
 * lifted straight out of the address bar and painted on the page is content injection with
 * extra steps. Only codes in this table render; anything else is dropped by
 * {@link parseQuickAddErrors}.
 */
export const QUICK_ADD_ERRORS = {
  PICK_FIGURE: "PICK A FIGURE FROM THE CATALOG",
  FIGURE_GONE: "THAT FIGURE IS NO LONGER IN THE CATALOG",
  NAME_REQUIRED: "THE FIGURE NEEDS A NAME",
  BAD_NUMBER: "POP NUMBER MUST BE DIGITS ONLY",
  BAD_CATEGORY: "PICK ONE OF THE FOUR CATEGORIES",
  BAD_STATUS: "STATUS MUST BE MINE OR NOT MINE ANYMORE",
  BAD_DATE: "DATE MUST BE YYYY-MM-DD",
  UNREAL_DATE: "THAT DATE DOES NOT EXIST",
  BAD_COUNTRY: "PICK A COUNTRY FROM THE LIST",
  NOTHING_TO_BUMP: "NOTHING TO BUMP — THAT FIGURE IS NOT IN THE VAULT",
} as const;

export type QuickAddErrorCode = keyof typeof QUICK_ADD_ERRORS;

export function isQuickAddErrorCode(value: unknown): value is QuickAddErrorCode {
  return typeof value === "string" && value in QUICK_ADD_ERRORS;
}

/** `?err=BAD_DATE,BAD_COUNTRY` → the two messages, deduped, unknown codes dropped. */
export function parseQuickAddErrors(raw: string | string[] | undefined): QuickAddErrorCode[] {
  const value = firstParam(raw) ?? "";
  const seen = new Set<QuickAddErrorCode>();
  for (const part of value.split(",")) {
    const code = part.trim().toUpperCase();
    if (isQuickAddErrorCode(code)) seen.add(code);
  }
  return [...seen];
}

/** The `?err=` value for a failed submit. Empty when nothing failed, so the key is dropped. */
export function quickAddErrorParam(codes: readonly QuickAddErrorCode[]): string {
  return codes.join(",");
}

export function quickAddErrorMessages(codes: readonly QuickAddErrorCode[]): string[] {
  return codes.map((code) => QUICK_ADD_ERRORS[code]);
}

/* ------------------------------------------------------------------ the catalog row */

/**
 * A catalog figure as the ADMIN sees it: the public columns plus the two the owner is
 * allowed to know about — `needs_review` (this row came out of the seed unverified) and
 * `owned_count` (it is already on the shelf). Neither ever reaches a public component;
 * that is the whole reason this type is separate from `PublicCatalogFigure`.
 */
export interface AdminCatalogFigure {
  id: string;
  slug: string;
  name: string;
  popNumber: number | null;
  category: FigureCategory;
  productLine: string | null;
  exclusivity: string | null;
  variantFlags: string[] | null;
  releaseYear: number | null;
  /** Owner-uploaded box art (ADR-011), or NULL. */
  imagePath: string | null;
  needsReview: boolean;
  ownedCount: number;
}

/** The chips under a figure's name: `CHASE · GLOW`, or the exclusivity, or nothing. */
export function variantChips(figure: Pick<AdminCatalogFigure, "exclusivity" | "variantFlags">) {
  const flags = (figure.variantFlags ?? []).filter((flag) => Boolean(flag && flag.trim()));
  const exclusivity = figure.exclusivity?.trim();
  return exclusivity ? [exclusivity, ...flags] : flags;
}

/** `Spider-Man (Metallic)` → `Spider-Man`: the part before the first parenthetical. */
export function variantNamePrefix(name: string): string {
  const [head] = name.split(" (");
  return head.trim();
}

/** Lowercase, punctuation → single spaces. The comparison form, never displayed. */
function normalize(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** The figure minus its variant parentheses: `Spider-Man (Glow) (Chase)` → `spider man`. */
export function baseFigureName(name: string): string {
  return normalize(name.replace(/\([^)]*\)/g, " ").replace(/\[[^\]]*\]/g, " "));
}

type SiblingCandidate = Pick<AdminCatalogFigure, "popNumber" | "name" | "productLine">;

/**
 * Are these two rows the same figure in different clothes?
 *
 * Two rules, and the second one is deliberately narrow:
 *   1. **the same box number** — Funko reuses a number across a chase, a glow and an
 *      exclusive, so this is the case the confirm step exists for;
 *   2. **the same base name inside the same product line, spelled differently** — e.g.
 *      `Spider-Man` and `Spider-Man (Translucent)`, which occasionally get separate numbers.
 *
 * Rule 2 refuses to fire on two identically-named rows, because "Spider-Man" is the name of
 * some forty unrelated figures: two rows called exactly `Spider-Man` with different numbers
 * are different sculpts from different waves, not variants of each other. Without that
 * clause a confirm screen for #3 would offer half the catalog as "is it this one?".
 */
export function isVariantSibling(a: SiblingCandidate, b: SiblingCandidate): boolean {
  if (a.popNumber !== null && b.popNumber !== null && a.popNumber === b.popNumber) return true;

  const line = normalize(a.productLine ?? "");
  if (line.length === 0 || line !== normalize(b.productLine ?? "")) return false;

  const base = baseFigureName(a.name);
  if (base.length === 0 || base !== baseFigureName(b.name)) return false;

  return normalize(a.name) !== normalize(b.name);
}

/** Enough alternatives to disambiguate a box, few enough to stay one thumb-scroll. */
export const VARIANT_SIBLING_LIMIT = 12;

/**
 * The other figures the box in the owner's hand might be.
 *
 * The selected figure is not in the list — it is the hero above it. Ordered by box number
 * then name so the row is stable between renders, and capped: a screen with thirty
 * "is it this one?" cards asks a question nobody can answer.
 */
export function variantSiblings<T extends AdminCatalogFigure>(
  selected: AdminCatalogFigure,
  candidates: readonly T[],
  limit: number = VARIANT_SIBLING_LIMIT,
): T[] {
  const seen = new Set<string>([selected.id]);
  const siblings: T[] = [];

  for (const candidate of candidates) {
    if (seen.has(candidate.id)) continue;
    if (!isVariantSibling(selected, candidate)) continue;
    seen.add(candidate.id);
    siblings.push(candidate);
  }

  return siblings
    .sort(
      (a, b) =>
        (a.popNumber ?? Number.MAX_SAFE_INTEGER) - (b.popNumber ?? Number.MAX_SAFE_INTEGER) ||
        a.name.localeCompare(b.name),
    )
    .slice(0, Math.max(limit, 0));
}

/* ------------------------------------------------------------------ the duplicate guard */

/** One shelf row holding the figure the owner just picked. */
export interface OwnedCopy {
  id: string;
  status: OwnedStatus | null;
  acquiredAt: string | null;
  quantity: number | null;
  needsStory: boolean | null;
}

export interface DuplicateGuard {
  /** The row `ADD DUPLICATE (+1)` increments — the most recent copy. */
  targetId: string;
  /** ISO date of the FIRST copy: "in the vault since …". */
  since: string | null;
  /** Copies currently on the shelf, counting quantities. */
  quantity: number;
}

/**
 * Is this figure already in the vault?
 *
 * Only `mine` rows count. A figure logged as `not_mine_anymore` is one the owner had and
 * lost, and warning "already in the vault" about it would be a lie that costs him the entry —
 * buying the same Pop again after giving one away is exactly how this collection grows.
 *
 * The increment target is the newest copy and `since` is the oldest, which is the pair the
 * screen needs: bump what he is holding now, but date the story from the first one.
 */
export function findOwnedDuplicate(copies: readonly OwnedCopy[]): DuplicateGuard | null {
  const mine = copies.filter((copy) => copy.status === "mine");
  if (mine.length === 0) return null;

  const dated = [...mine].sort((a, b) => (a.acquiredAt ?? "").localeCompare(b.acquiredAt ?? ""));
  const first = dated[0];
  const latest = dated[dated.length - 1];

  return {
    targetId: latest.id,
    since: first.acquiredAt,
    quantity: mine.reduce((total, copy) => total + Math.max(copy.quantity ?? 1, 1), 0),
  };
}

/** `ALREADY IN THE VAULT (SINCE JAN 2026)` — the amber line above the confirm button. */
export function duplicateWarning(guard: DuplicateGuard): string {
  const since = formatSightingDate(guard.since, "");
  return since.length > 0 ? `ALREADY IN THE VAULT (SINCE ${since})` : "ALREADY IN THE VAULT";
}

/* ------------------------------------------------------------------ smart defaults */

export interface SightingPlace {
  city: string | null;
  country: string | null;
}

/**
 * Where the last figure was picked up — the "whole trip in one tap" trick.
 *
 * Figures arrive in clusters: a convention, a holiday, one shop on one afternoon. Rows come
 * in newest-acquisition-first (the query orders them), so the first one that names a place
 * wins; a row with a country but no city still counts, because the flag alone is worth
 * prefilling.
 */
export function lastUsedPlace(rows: readonly SightingPlace[]): SightingPlace | null {
  for (const row of rows) {
    const city = row.city?.trim() ?? "";
    const country = row.country?.trim() ?? "";
    if (city.length > 0 || country.length > 0) {
      return { city: city || null, country: country.toUpperCase() || null };
    }
  }
  return null;
}

export interface QuickAddDefaults {
  acquiredAt: string;
  acquiredCity: string;
  acquiredCountry: string;
  status: OwnedStatus;
}

/**
 * What the details step is already filled with before the owner touches it: today, the last
 * place, and `mine`. Every one of them is the answer nine times out of ten, and the tenth
 * time it is one field to change rather than four to type.
 */
export function quickAddDefaults(today: string, place: SightingPlace | null): QuickAddDefaults {
  return {
    acquiredAt: today,
    acquiredCity: place?.city ?? "",
    acquiredCountry: place?.country ?? "",
    status: "mine",
  };
}

/* ------------------------------------------------------------------ step 1b: a new figure */

export type QuickAddFormFields = Record<string, string | undefined>;

/**
 * A server action as a `<form action={…}>` takes it.
 *
 * The step components receive their action as a prop instead of importing it — the same
 * shape `OwnedFigureForm` already uses. That keeps every screen a pure function of props
 * (and therefore renderable in a test) while the module that actually writes to Postgres
 * stays behind `"use server"` and `server-only`.
 */
export type QuickAddFormAction = (formData: FormData) => void | Promise<void>;

export type QuickAddParse<T> = { ok: true; value: T } | { ok: false; errors: QuickAddErrorCode[] };

/** What step 1b writes into `reference_figures`. */
export interface NewFigureInput {
  name: string;
  popNumber: number | null;
  category: FigureCategory;
  productLine: string | null;
  /** ADR-009: the denominator is the `peter` bucket, so this mirrors the category. */
  countsTowardTotal: boolean;
  /**
   * The barcode that started this, canonicalised (Phase 7), or `null` when the figure was
   * typed rather than scanned. A brand-new row cannot clash with itself, so this is the
   * one place a scanned code is written without consulting `decideUpcBackfill()`.
   */
  upc: string | null;
}

/**
 * `?upc=` / a hidden field → the canonical thirteen-digit form, or `null`.
 *
 * The check digit is recomputed rather than trusted: a URL is not a decode, and a code
 * that fails arithmetic must not reach the column that later scans will match on.
 */
export function scannedUpcValue(raw: string | undefined): string | null {
  return normalizeScannedCode(raw ?? "")?.ean13 ?? null;
}

/**
 * What the owner already typed into the search box, carried into the new-figure form.
 *
 * If he searched `1450` the box was a number, so it prefills the number field and leaves the
 * name for him; anything else was a name. Nothing is guessed beyond that — this is the path
 * for a figure the catalog has never heard of.
 */
export function newFigurePrefill(rawQuery: string): { name: string; popNumber: string } {
  const parsed = parseReferenceSearchQuery(rawQuery ?? "");
  if (parsed.kind === "number") return { name: "", popNumber: String(parsed.popNumber) };
  if (parsed.kind === "text") return { name: parsed.text, popNumber: "" };
  return { name: "", popNumber: "" };
}

function trimmedOrNull(value: string | undefined): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Validates step 1b. Same shape as `parseOwnedFigureForm`: errors are collected, never
 * thrown one per round trip — this form is filled in on a phone, standing up.
 *
 * The number is optional on purpose. Multi-packs and convention exclusives ship without one,
 * and refusing the entry over a missing number is exactly the "never block on an incomplete
 * catalog" failure the whole step exists to avoid.
 */
export function parseNewFigureForm(fields: QuickAddFormFields): QuickAddParse<NewFigureInput> {
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
      upc: scannedUpcValue(fields.upc),
    },
  };
}

export function newFigureFormFields(formData: FormData): QuickAddFormFields {
  return readFields(formData, ["name", "popNumber", "category", "productLine", "q", "upc"]);
}

/* ------------------------------------------------------------------ step 3: the details */

/** What step 3 writes into `owned_figures`. */
export interface QuickAddDetailsInput {
  referenceFigureId: string;
  status: OwnedStatus;
  acquiredAt: string;
  acquiredCity: string | null;
  acquiredCountry: string | null;
  story: string | null;
  needsStory: boolean;
  /**
   * The barcode this add started from, or `null` when it started from the search box.
   * Not written to `owned_figures` — it is the input to the catalog backfill that makes
   * the next scan of this figure a catalog hit instead of an API call.
   */
  upc: string | null;
}

/** The two submit buttons of the details form. */
export const QUICK_ADD_INTENTS = ["save", "skip"] as const;

export type QuickAddIntent = (typeof QUICK_ADD_INTENTS)[number];

export function parseQuickAddIntent(value: string | undefined): QuickAddIntent {
  return value?.trim().toLowerCase() === "skip" ? "skip" : "save";
}

/**
 * Validates step 3.
 *
 * `SKIP FOR NOW` is a second submit on the same form, and it deliberately does NOT read the
 * textarea: it means "log the sighting, I will write it later", which is why it sits under
 * the box and not next to it. Either way the invariant is the same and the story queue
 * depends on it — **a sighting with no story is a story owed**, so `needs_story` is exactly
 * `story is null`.
 */
export function parseQuickAddDetailsForm(
  fields: QuickAddFormFields,
): QuickAddParse<QuickAddDetailsInput> {
  const errors: QuickAddErrorCode[] = [];

  const referenceFigureId = (fields.referenceFigureId ?? "").trim();
  if (!UUID_PATTERN.test(referenceFigureId)) errors.push("PICK_FIGURE");

  const rawStatus = (fields.status ?? "").trim();
  const status = OWNED_STATUSES.find((candidate) => candidate === rawStatus);
  if (!status) errors.push("BAD_STATUS");

  const acquiredAt = (fields.acquiredAt ?? "").trim();
  if (!looksLikeIsoDate(acquiredAt)) errors.push("BAD_DATE");
  else if (!isRealIsoDate(acquiredAt)) errors.push("UNREAL_DATE");

  // The field is a combobox over the whole ISO 3166 list, so what arrives here may be
  // `Israel (IL)`, `IL`, `Israel` or `USA` — `resolveCountryCode` accepts all four and
  // answers `null` for anything it cannot place. An empty box stays empty (the place is
  // optional); an unresolvable one is an error, never a silently stored two letters.
  const rawCountry = trimmedOrNull(fields.acquiredCountry);
  const acquiredCountry = rawCountry === null ? null : resolveCountryCode(rawCountry);
  if (rawCountry !== null && acquiredCountry === null) errors.push("BAD_COUNTRY");

  if (errors.length > 0) return { ok: false, errors };

  const skipped = parseQuickAddIntent(fields.intent) === "skip";
  const story = skipped ? null : trimmedOrNull(fields.story);

  return {
    ok: true,
    value: {
      referenceFigureId,
      status: status as OwnedStatus,
      acquiredAt,
      acquiredCity: trimmedOrNull(fields.acquiredCity),
      acquiredCountry,
      story,
      needsStory: story === null,
      upc: scannedUpcValue(fields.upc),
    },
  };
}

export function quickAddDetailsFormFields(formData: FormData): QuickAddFormFields {
  return readFields(formData, [
    "referenceFigureId",
    "status",
    "acquiredAt",
    "acquiredCity",
    "acquiredCountry",
    "story",
    "intent",
    "upc",
  ]);
}

function readFields(formData: FormData, keys: readonly string[]): QuickAddFormFields {
  const fields: QuickAddFormFields = {};
  for (const key of keys) {
    const value = formData.get(key);
    if (typeof value === "string") fields[key] = value;
  }
  return fields;
}

/* ------------------------------------------------------------------ the story queue */

/** The vault list's filter chips. `all` is the bare path. */
export const COLLECTION_FILTERS = ["all", "needs_story"] as const;

export type CollectionFilter = (typeof COLLECTION_FILTERS)[number];

export const DEFAULT_COLLECTION_FILTER: CollectionFilter = "all";

export function parseCollectionFilter(raw: string | string[] | undefined): CollectionFilter {
  const value = firstParam(raw)?.trim().toLowerCase();
  const filter = COLLECTION_FILTERS.find((candidate) => candidate === value);
  return filter ?? DEFAULT_COLLECTION_FILTER;
}

export function collectionFilterHref(filter: CollectionFilter): string {
  return filter === DEFAULT_COLLECTION_FILTER
    ? "/admin/collection"
    : `/admin/collection?filter=${filter}`;
}

/** Where the dashboard's STORIES OWED line points. */
export const STORY_QUEUE_HREF = collectionFilterHref("needs_story");

/**
 * Filtering in TypeScript rather than in SQL: the shelf is nineteen rows, the list page
 * already fetches all of them, and this way the rule the chips promise is the rule a test
 * can check.
 */
export function filterOwnedRows<T extends { needsStory: boolean | null }>(
  rows: readonly T[],
  filter: CollectionFilter = DEFAULT_COLLECTION_FILTER,
): T[] {
  return filter === "needs_story" ? rows.filter((row) => row.needsStory === true) : [...rows];
}

/** `STORIES OWED: 3`. Zero is still shown — an empty queue is good news worth reading. */
export function storiesOwedLabel(count: number): string {
  return `STORIES OWED: ${Math.max(count, 0)}`;
}

/* ------------------------------------------------------------------ wording */

/**
 * The gadget's Quick Add vocabulary, kept here rather than retyped in five components —
 * same rule as the search and wishlist copy (docs/wiki/Design-System.md).
 */
export const QUICK_ADD_COPY = {
  identifyTitle: "NEW SIGHTING",
  identifyLabel: "NUMBER OR NAME",
  identifySubmit: "SCAN THE CATALOG",
  addAsNew: "ADD AS NEW FIGURE",
  noMatch: "NOTHING IN THE CATALOG MATCHES THAT.",
  needsReviewChip: "NEEDS REVIEW",
  ownedChip: "IN THE VAULT",
  newFigureTitle: "ADD AS NEW FIGURE",
  newFigureSubmit: "CREATE — IT'S REAL",
  confirmHeadline: "IS IT THIS ONE?",
  confirmPrimary: "CONFIRM — IT'S MINE",
  confirmVariants: "OR ONE OF THESE",
  duplicatePrimary: "ADD DUPLICATE (+1)",
  fixLink: "WRONG DATA? FIX THIS FIGURE",
  fixTitle: "FIX THE CATALOG",
  fixSubmit: "SAVE THE CORRECTION",
  detailsTitle: "WHERE AND WHEN?",
  detailsSubmit: "SAVE THE SIGHTING",
  detailsSkip: "SKIP FOR NOW",
  successHeadline: "SIGHTING CONFIRMED!",
  addAnother: "ADD ANOTHER",
  viewIt: "VIEW IT",
  writeTheStory: "WRITE THE STORY",
} as const;

/** The line under the success banner when the owner bumped an existing row instead. */
export function duplicateSuccessNote(quantity: number): string {
  return `QUANTITY IS NOW ${Math.max(quantity, 1)} — ONE ENTRY, MORE THAN ONE BOX`;
}
