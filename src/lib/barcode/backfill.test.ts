import { describe, expect, it } from "vitest";

import { decideUpcBackfill } from "./backfill";

/**
 * The rule the whole enrichment loop rests on.
 *
 * Three outcomes, and the third exists because Funko exclusives genuinely share a UPC
 * (ADR-006): a second, different code on a row is ambiguity, not a correction, and the
 * hand-verified value must survive it.
 */

const UPC_A = "889698636759";
const EAN_13 = "0889698636759";
const OTHER = "0889698636766";

describe("decideUpcBackfill", () => {
  it("writes the canonical form onto a row that has no barcode", () => {
    expect(decideUpcBackfill(null, UPC_A)).toEqual({ action: "write", upc: EAN_13 });
    expect(decideUpcBackfill("", UPC_A)).toEqual({ action: "write", upc: EAN_13 });
    expect(decideUpcBackfill("   ", EAN_13)).toEqual({ action: "write", upc: EAN_13 });
  });

  it("does nothing when the row already knows the code, in either spelling", () => {
    expect(decideUpcBackfill(EAN_13, EAN_13)).toEqual({ action: "none", reason: "ALREADY_KNOWN" });
    expect(decideUpcBackfill(UPC_A, EAN_13)).toEqual({ action: "none", reason: "ALREADY_KNOWN" });
    expect(decideUpcBackfill(EAN_13, UPC_A)).toEqual({ action: "none", reason: "ALREADY_KNOWN" });
  });

  it("never overwrites a different code — it flags the row and names both", () => {
    const decision = decideUpcBackfill(EAN_13, OTHER);

    expect(decision.action).toBe("flag");
    if (decision.action !== "flag") throw new Error("expected a flag");
    expect(decision.existing).toBe(EAN_13);
    expect(decision.upc).toBe(OTHER);
    expect(decision.note).toContain(EAN_13);
    expect(decision.note).toContain(OTHER);
  });

  it("is a no-op for every add that did not come from a camera", () => {
    expect(decideUpcBackfill(null, null)).toEqual({ action: "none", reason: "NO_SCAN" });
    expect(decideUpcBackfill(EAN_13, undefined)).toEqual({ action: "none", reason: "NO_SCAN" });
    expect(decideUpcBackfill(null, "  ")).toEqual({ action: "none", reason: "NO_SCAN" });
  });

  it("refuses to write a code that fails its own check digit", () => {
    expect(decideUpcBackfill(null, "889698636758")).toEqual({
      action: "none",
      reason: "UNREADABLE",
    });
    expect(decideUpcBackfill(null, "not-a-barcode")).toEqual({
      action: "none",
      reason: "UNREADABLE",
    });
  });

  it("treats a column holding junk as a clash, not as an empty column", () => {
    // Something unreadable is already in there; a human put it there and a scan may not
    // silently replace it.
    const decision = decideUpcBackfill("see box", UPC_A);
    expect(decision.action).toBe("flag");
  });
});
