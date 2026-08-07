import { describe, expect, it } from "vitest";

import {
  formatUpc,
  gtinCheckDigit,
  isSameBarcode,
  isScannableFormat,
  isValidEan13,
  isValidUpcA,
  normalizeScannedCode,
  upcLookupForms,
} from "./upc";

/**
 * The arithmetic under the scanner.
 *
 * `889698636759` is a real Funko Spider-Man barcode (found during the Phase 7 research and
 * used for the live UPCitemdb smoke), which makes it the one fixture worth building the
 * matrix around: its EAN-13 spelling, its off-by-one neighbours and its transpositions.
 */

const UPC_A = "889698636759";
const EAN_13 = "0889698636759";

describe("gtinCheckDigit", () => {
  it("computes the digit printed on the box", () => {
    expect(gtinCheckDigit(UPC_A.slice(0, -1))).toBe(9);
  });

  it("ignores a leading zero, which is why the two forms are one code", () => {
    expect(gtinCheckDigit(EAN_13.slice(0, -1))).toBe(gtinCheckDigit(UPC_A.slice(0, -1)));
  });

  it("wraps to 0 rather than to 10", () => {
    // 000000000000 sums to 0 → (10 - 0) % 10 = 0, not 10.
    expect(gtinCheckDigit("00000000000")).toBe(0);
  });
});

describe("isValidUpcA / isValidEan13", () => {
  it("accepts the real code in its own length", () => {
    expect(isValidUpcA(UPC_A)).toBe(true);
    expect(isValidEan13(EAN_13)).toBe(true);
  });

  it("refuses the other length even when the digits are right", () => {
    expect(isValidUpcA(EAN_13)).toBe(false);
    expect(isValidEan13(UPC_A)).toBe(false);
  });

  it("catches a single wrong digit", () => {
    expect(isValidUpcA("889698636758")).toBe(false);
    expect(isValidEan13("0889698636758")).toBe(false);
  });

  it("catches a transposition, which is the typo a check digit is for", () => {
    expect(isValidUpcA("889698363759")).toBe(false);
  });

  it("refuses anything that is not digits of the right length", () => {
    for (const bad of ["", "88969863675", "8896986367590", "88969863675x", "  ", "1234"]) {
      expect(isValidUpcA(bad)).toBe(false);
      expect(isValidEan13(bad)).toBe(false);
    }
  });
});

describe("normalizeScannedCode", () => {
  it("turns a printed UPC-A into both spellings", () => {
    expect(normalizeScannedCode(UPC_A)).toEqual({
      ean13: EAN_13,
      upcA: UPC_A,
      forms: [EAN_13, UPC_A],
      query: UPC_A,
    });
  });

  it("recognises the EAN-13 spelling of the same code", () => {
    expect(normalizeScannedCode(EAN_13)?.upcA).toBe(UPC_A);
    expect(normalizeScannedCode(EAN_13)?.ean13).toBe(EAN_13);
  });

  it("keeps a genuinely 13-digit code as one form only", () => {
    // 4006381333931 is a well-known EAN-13 with no UPC-A behind it (no leading zero).
    const scanned = normalizeScannedCode("4006381333931");
    expect(scanned?.upcA).toBeNull();
    expect(scanned?.forms).toEqual(["4006381333931"]);
    expect(scanned?.query).toBe("4006381333931");
  });

  it("forgives how a human types a number", () => {
    expect(normalizeScannedCode(" 8-89698 636759 ")?.ean13).toBe(EAN_13);
  });

  it("refuses a bad check digit rather than paying for a lookup", () => {
    expect(normalizeScannedCode("889698636758")).toBeNull();
  });

  it("refuses the lengths a Funko box never carries", () => {
    // Valid EAN-8 and UPC-E codes — real symbologies, just not on this shelf.
    expect(normalizeScannedCode("96385074")).toBeNull();
    expect(normalizeScannedCode("01234565")).toBeNull();
  });

  it("refuses nothing, letters and injections", () => {
    for (const bad of [null, undefined, "", "abc", "889698636759'; drop table", "1e12"]) {
      expect(normalizeScannedCode(bad)).toBeNull();
    }
  });
});

describe("upcLookupForms", () => {
  it("asks the catalog about both spellings", () => {
    expect(upcLookupForms(UPC_A)).toEqual([EAN_13, UPC_A]);
    expect(upcLookupForms(EAN_13)).toEqual([EAN_13, UPC_A]);
  });

  it("is empty for a column that holds junk, so the query matches nothing", () => {
    expect(upcLookupForms(null)).toEqual([]);
    expect(upcLookupForms("n/a")).toEqual([]);
  });
});

describe("isSameBarcode", () => {
  it("sees through the two spellings", () => {
    expect(isSameBarcode(UPC_A, EAN_13)).toBe(true);
    expect(isSameBarcode(` ${EAN_13} `, UPC_A)).toBe(true);
  });

  it("tells two different codes apart", () => {
    expect(isSameBarcode(UPC_A, "889698636766")).toBe(false);
  });

  it("never calls two unreadable codes equal", () => {
    expect(isSameBarcode("junk", "junk")).toBe(false);
    expect(isSameBarcode(null, null)).toBe(false);
  });
});

describe("isScannableFormat", () => {
  it("accepts both engines' spelling of the two symbologies", () => {
    for (const format of ["EAN13", "UPCA", "ean_13", "upc_a", "EAN-13"]) {
      expect(isScannableFormat(format)).toBe(true);
    }
  });

  it("refuses everything else, including the QR on an exclusive's box", () => {
    for (const format of ["QRCode", "qr_code", "Code128", "EAN8", "upc_e", "", null, undefined]) {
      expect(isScannableFormat(format)).toBe(false);
    }
  });
});

describe("formatUpc", () => {
  it("groups the digits the way the box prints them", () => {
    expect(formatUpc(UPC_A)).toBe("8 89698 63675 9");
    expect(formatUpc("4006381333931")).toBe("4 006381 333931");
  });

  it("hands back anything it cannot read untouched", () => {
    expect(formatUpc("nope")).toBe("nope");
  });
});
