import { isSameBarcode, normalizeScannedCode } from "./upc";

/**
 * The point of the whole scanner: every real scan makes the catalog know one more barcode.
 *
 * `reference_figures.upc` is EMPTY today — the checklist sources the catalog was seeded
 * from (ADR-008) carry pop numbers and names, not barcodes. So a scan cannot start by
 * matching the catalog; it starts by asking UPCitemdb what the box is, letting the owner
 * confirm which catalog row that is, and then **writing the scanned code onto that row**.
 * The next scan of the same figure is a catalog hit, costs no API call, and needs no
 * confirmation beyond the variant question that was always mandatory.
 *
 * The one rule that keeps that loop honest is the third case below. Funko exclusives
 * genuinely share a UPC (ADR-006), so a code arriving on a row that already carries a
 * DIFFERENT one is not a correction — it is evidence that either the box or the catalog is
 * ambiguous, and a human has to look. Overwriting would erase the older, hand-verified
 * fact to record a guess.
 */

export type UpcBackfillDecision =
  /** Nothing to do: no scan, an unreadable scan, or the row already knows this code. */
  | { action: "none"; reason: "NO_SCAN" | "UNREADABLE" | "ALREADY_KNOWN" }
  /** The row had no barcode. Write the canonical form and move on. */
  | { action: "write"; upc: string }
  /** Two different codes claim the same figure. Keep the old one, flag the row. */
  | { action: "flag"; upc: string; existing: string; note: string };

/**
 * `BARCODE CLASH: catalog has 0889698636759, scan read 0889698636766` — the sentence that
 * lands in `review_note` so the triage pass knows what it is looking at.
 */
export function upcClashNote(existing: string, scanned: string): string {
  return `BARCODE CLASH: catalog has ${existing}, scan read ${scanned} — exclusives can share a UPC, check the box.`;
}

/**
 * What should happen to a catalog row's `upc` when a scan-originated add reaches its write?
 *
 * Pure, and separated from the action that performs it, because this is the decision the
 * whole enrichment loop rests on and "it overwrote my verified barcode" is not a bug worth
 * discovering in production.
 */
export function decideUpcBackfill(
  existing: string | null | undefined,
  scanned: string | null | undefined,
): UpcBackfillDecision {
  const raw = (scanned ?? "").trim();
  if (raw.length === 0) return { action: "none", reason: "NO_SCAN" };

  const code = normalizeScannedCode(raw);
  if (!code) return { action: "none", reason: "UNREADABLE" };

  const current = (existing ?? "").trim();
  if (current.length === 0) return { action: "write", upc: code.ean13 };

  // `889698636759` in the column and `0889698636759` off the camera are ONE code.
  if (isSameBarcode(current, code.ean13)) return { action: "none", reason: "ALREADY_KNOWN" };

  return {
    action: "flag",
    upc: code.ean13,
    existing: current,
    note: upcClashNote(current, code.ean13),
  };
}
