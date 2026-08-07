import { type UpcLookupOutcome } from "./upcitemdb";

/**
 * What happens between "the camera read a number" and "a screen appears".
 *
 * The scan-result step is the one frame of Quick Add that has to make a decision instead
 * of rendering a query, and it makes it in three graded steps — catalog, then the API,
 * then give up gracefully. Each step is a pure function here so the graded part can be
 * tested without a camera, a network or a database; `src/app/admin/add/page.tsx` only
 * fetches in the order these functions consume.
 *
 * Everything the flow says out loud is a code in {@link SCAN_NOTICES}, for the same reason
 * Quick Add's form errors are: the step is a URL, and text rendered out of a URL is
 * content injection with extra steps.
 */

/* ------------------------------------------------------------------ wording */

/** The scanner's vocabulary. Same rule as `QUICK_ADD_COPY` — never retyped in a component. */
export const SCAN_COPY = {
  /** The button on step 1 that used to say SOON. */
  scan: "⌖ SCAN THE BOX",
  overlayTitle: "SCANNING",
  aim: "AIM AT THE BARCODE ON THE BOX BOTTOM",
  /** The escape hatch, present in every state of the overlay. */
  typeInstead: "TYPE INSTEAD",
  close: "CLOSE",
  starting: "WAKING THE CAMERA…",
  hit: "BARCODE LOCKED",
  denied: "NO CAMERA PERMISSION.",
  deniedHint: "ALLOW THE CAMERA IN THE BROWSER SETTINGS, OR TYPE THE NUMBER.",
  unsupported: "THIS BROWSER WON'T HAND OVER A CAMERA.",
  insecure: "THE CAMERA NEEDS HTTPS.",
  failed: "THE CAMERA DID NOT START.",
  fallbackHint: "TYPE THE NUMBER — IT IS THE SAME FLOW, ONE TAP LONGER.",
  /** iOS in a home-screen PWA forgets the permission between launches. */
  reloadHint: "IF THE CAMERA STAYS DARK, RELOAD.",
  resultTitle: "BARCODE",
  candidates: "IS IT ONE OF THESE?",
  /** Shown on the confirm step when the catalog already knew the code. */
  matched: "MATCHED BY BARCODE",
} as const;

/**
 * Everything the scan-result frame can say about how it got there. A closed table: the
 * step reads `?upc=` out of the address bar, so nothing may be rendered from it directly.
 */
export const SCAN_NOTICES = {
  BAD_BARCODE: "THAT BARCODE DOES NOT CHECK OUT. TYPE THE NUMBER?",
  FOUND_IT: "BARCODE FOUND — PICK THE VARIANT.",
  NOT_IN_CATALOG: "BARCODE READ, BUT THE CATALOG DOES NOT KNOW IT YET.",
  NOT_FOUND: "BARCODE NOT FOUND. TYPE THE NUMBER?",
  LOOKUP_BUSY: "LOOKUP BUSY — TYPE THE NUMBER?",
  LOOKUP_DOWN: "LOOKUP UNAVAILABLE — TYPE THE NUMBER?",
} as const;

export type ScanNoticeCode = keyof typeof SCAN_NOTICES;

export function scanNoticeMessage(code: ScanNoticeCode): string {
  return SCAN_NOTICES[code];
}

/* ------------------------------------------------------------------ where a scan came from */

/**
 * `?via=` — how the owner reached a confirm step, so it can say `MATCHED BY BARCODE`
 * instead of leaving him wondering why a figure he never searched for is on screen.
 */
export const SCAN_ORIGINS = ["barcode", "lookup"] as const;

export type ScanOrigin = (typeof SCAN_ORIGINS)[number];

export function parseScanOrigin(raw: string | string[] | undefined): ScanOrigin | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const trimmed = typeof value === "string" ? value.trim().toLowerCase() : "";
  return SCAN_ORIGINS.find((origin) => origin === trimmed) ?? null;
}

/* ------------------------------------------------------------------ step 1: the catalog */

interface ScanMatch {
  id: string;
  popNumber: number | null;
  name: string;
}

/**
 * The catalog rows that already carry the scanned code → the one to open.
 *
 * More than one row CAN share a barcode — that is ADR-006's whole warning about exclusives
 * — and the answer is not to ask a new question: the confirm step already lists every
 * sibling sharing a number, so opening the lowest-numbered match lands the owner exactly
 * one tap from the others. The ordering is spelled out here rather than left to SQL so
 * "which one opens" is stable and testable.
 */
export function chooseScanTarget(matches: readonly ScanMatch[]): string | null {
  if (matches.length === 0) return null;

  return [...matches].sort(
    (a, b) =>
      (a.popNumber ?? Number.MAX_SAFE_INTEGER) - (b.popNumber ?? Number.MAX_SAFE_INTEGER) ||
      a.name.localeCompare(b.name),
  )[0].id;
}

/* ------------------------------------------------------------------ step 2: the fallback */

export type ScanFallback =
  /** Show the owner what the catalog thinks the parsed title might be. */
  | { kind: "candidates"; notice: ScanNoticeCode }
  /** No candidates worth showing — go straight to the new-figure form. */
  | { kind: "new"; notice: ScanNoticeCode };

/** Enough guesses to recognise the box, few enough to answer in one thumb-scroll. */
export const SCAN_CANDIDATE_LIMIT = 8;

/**
 * The catalog knew nothing, so what does UPCitemdb's answer buy us?
 *
 * Three of its four outcomes end in the same place — the new-figure form with the barcode
 * carried — and they differ only in what the screen admits happened. That matters more
 * than it looks: `NOT FOUND` means "this barcode is not in their database, adding the
 * figure by hand is the right move", while `LOOKUP BUSY` means "we hit the 100/day trial
 * ceiling, nothing is wrong with your box". Same form, very different sentence.
 */
export function scanFallbackRoute(lookup: UpcLookupOutcome, candidateCount: number): ScanFallback {
  if (lookup.kind === "rate_limited") return { kind: "new", notice: "LOOKUP_BUSY" };
  if (lookup.kind === "unavailable") return { kind: "new", notice: "LOOKUP_DOWN" };
  if (lookup.kind === "not_found") return { kind: "new", notice: "NOT_FOUND" };

  return candidateCount > 0
    ? { kind: "candidates", notice: "FOUND_IT" }
    : { kind: "new", notice: "NOT_IN_CATALOG" };
}

/**
 * The candidate list: exact number matches first, then the fuzzy name ones, deduped.
 *
 * The order is the point. A title that printed `#1450` gives an exact `pop_number` lookup,
 * and an exact number is worth more than any trigram score — but only the name search can
 * find the figure when the title never printed a number, so both run and neither is
 * allowed to hide the other.
 */
export function mergeScanCandidates<T extends { id: string }>(
  byNumber: readonly T[],
  byName: readonly T[],
  limit: number = SCAN_CANDIDATE_LIMIT,
): T[] {
  const seen = new Set<string>();
  const merged: T[] = [];

  for (const candidate of [...byNumber, ...byName]) {
    if (seen.has(candidate.id)) continue;
    seen.add(candidate.id);
    merged.push(candidate);
  }

  return merged.slice(0, Math.max(limit, 0));
}
