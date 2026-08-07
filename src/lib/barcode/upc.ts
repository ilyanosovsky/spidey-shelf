/**
 * The number under the barcode, and the arithmetic that says whether it is real.
 *
 * A camera decode is a guess. zxing and the native detector both report a checksum-valid
 * read, but a URL parameter is not a decode — `?upc=` can hold anything — and the whole
 * scan flow hangs off this parse, so the check digit is recomputed here rather than
 * trusted from wherever the digits came from.
 *
 * **One code, two spellings.** A Funko box in the US prints a 12-digit UPC-A; the same
 * product in Europe prints it as EAN-13, which IS the UPC-A with a leading `0`. They are
 * the same code, so:
 *   - we STORE the 13-digit form (one canonical spelling in `reference_figures.upc`);
 *   - we LOOK UP both, because rows seeded or typed before this phase may hold either;
 *   - we COMPARE on the normalized form, so `889698636759` and `0889698636759` are
 *     recognized as the same barcode and never look like a clash.
 *
 * Nothing here touches a request, a camera or the database — it is the piece every other
 * part of the scanner agrees on.
 */

/** The two symbologies a Funko box carries (ADR-006). Anything else is not our barcode. */
export const SCANNABLE_FORMATS = ["EAN13", "UPCA"] as const;

/** The same two in the native `BarcodeDetector` spelling. */
export const NATIVE_SCANNABLE_FORMATS = ["ean_13", "upc_a"] as const;

/**
 * Is this what the decoder just read one of ours?
 *
 * Both spellings are accepted because the two engines disagree about them: zxing-wasm
 * reports `EAN13` / `UPCA`, the native detector reports `ean_13` / `upc_a`.
 */
export function isScannableFormat(format: string | null | undefined): boolean {
  const value = (format ?? "").trim().toLowerCase().replace(/[_-]/g, "");
  return value === "ean13" || value === "upca";
}

/**
 * The GTIN check digit of a payload (the code minus its last digit).
 *
 * One implementation for both lengths: walking right-to-left from the digit next to the
 * check digit with alternating weights 3,1,3,1… is the UPC-A rule AND the EAN-13 rule —
 * a leading zero contributes nothing, which is exactly why the two forms are the same code.
 */
export function gtinCheckDigit(payload: string): number {
  let sum = 0;
  let weight = 3;
  for (let i = payload.length - 1; i >= 0; i -= 1) {
    sum += Number(payload[i]) * weight;
    weight = weight === 3 ? 1 : 3;
  }
  return (10 - (sum % 10)) % 10;
}

function hasValidCheckDigit(code: string): boolean {
  return gtinCheckDigit(code.slice(0, -1)) === Number(code[code.length - 1]);
}

/** `889698636759` — twelve digits, last one checking the other eleven. */
export function isValidUpcA(code: string): boolean {
  return /^\d{12}$/.test(code) && hasValidCheckDigit(code);
}

/** `0889698636759` — thirteen digits, same arithmetic. */
export function isValidEan13(code: string): boolean {
  return /^\d{13}$/.test(code) && hasValidCheckDigit(code);
}

/** One barcode in every spelling the rest of the flow needs. */
export interface ScannedUpc {
  /** The canonical, stored form: thirteen digits. */
  ean13: string;
  /** The printed twelve-digit form, when this code has one. */
  upcA: string | null;
  /** Both forms — the `in (…)` list for a catalog lookup. */
  forms: string[];
  /** What UPCitemdb is asked about: the twelve-digit form when there is one. */
  query: string;
}

/**
 * Digits in, a real barcode or `null` out.
 *
 * Spaces and dashes are forgiven (a typed number is allowed to look like a typed number);
 * a wrong check digit is not, because a mis-scan that reaches the lookup burns one of the
 * hundred daily UPCitemdb calls to learn nothing.
 *
 * EAN-8 and UPC-E are deliberately refused: they exist, but not on a Funko box, and
 * pretending to understand them would turn a torn label into a confident wrong answer.
 */
export function normalizeScannedCode(raw: string | null | undefined): ScannedUpc | null {
  const digits = (raw ?? "").replace(/[\s-]/g, "");
  if (!/^\d+$/.test(digits)) return null;

  if (isValidUpcA(digits)) return scannedUpc(`0${digits}`, digits);

  if (isValidEan13(digits)) {
    const upcA = digits.startsWith("0") ? digits.slice(1) : null;
    return scannedUpc(digits, upcA);
  }

  return null;
}

function scannedUpc(ean13: string, upcA: string | null): ScannedUpc {
  return {
    ean13,
    upcA,
    forms: upcA ? [ean13, upcA] : [ean13],
    query: upcA ?? ean13,
  };
}

/**
 * Every spelling of a code already sitting in a database column.
 *
 * The catalog's `upc` is text, and rows written before this phase (or by hand) may hold
 * the twelve-digit form, the thirteen-digit one, or something with a dash in it. A lookup
 * that only knew one of them would miss the row and pay for an API call to rediscover it.
 */
export function upcLookupForms(raw: string | null | undefined): string[] {
  const scanned = normalizeScannedCode(raw);
  return scanned ? scanned.forms : [];
}

/**
 * Are these two codes the same barcode?
 *
 * Compared after normalization, so a UPC-A in the column and the EAN-13 the camera read
 * are the same thing and never trip the clash path. Anything unparseable is not equal to
 * anything — including itself — because "two codes we cannot read" is not a match.
 */
export function isSameBarcode(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = normalizeScannedCode(a);
  const right = normalizeScannedCode(b);
  return left !== null && right !== null && left.ean13 === right.ean13;
}

/** `889698636759` → `8 896986 36759`: the grouping printed under the bars. */
export function formatUpc(code: string): string {
  const scanned = normalizeScannedCode(code);
  if (!scanned) return code;
  const printed = scanned.upcA ?? scanned.ean13;
  return printed.length === 12
    ? `${printed.slice(0, 1)} ${printed.slice(1, 6)} ${printed.slice(6, 11)} ${printed.slice(11)}`
    : `${printed.slice(0, 1)} ${printed.slice(1, 7)} ${printed.slice(7)}`;
}
