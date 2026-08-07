import { describe, expect, it } from "vitest";

import {
  appendReviewNote,
  fixFigureFormFields,
  manualCorrectionNote,
  parseFixFigureForm,
  REVIEW_NOTE_LIMIT,
} from "./fix-figure";

const valid = {
  name: "Spider-Man",
  popNumber: "1450",
  category: "peter",
  productLine: "Pop! Marvel",
};

describe("parseFixFigureForm", () => {
  it("takes the four facts printed on the front of a box", () => {
    expect(parseFixFigureForm(valid)).toEqual({
      ok: true,
      value: {
        name: "Spider-Man",
        popNumber: 1450,
        category: "peter",
        productLine: "Pop! Marvel",
        countsTowardTotal: true,
      },
    });
  });

  it("tolerates a `#` and stray whitespace, which is how a number gets typed", () => {
    expect(parseFixFigureForm({ ...valid, popNumber: " # 1450 " })).toMatchObject({
      ok: true,
      value: { popNumber: 1450 },
    });
    expect(parseFixFigureForm({ ...valid, name: "  Spider   Man  " })).toMatchObject({
      ok: true,
      value: { name: "Spider Man" },
    });
  });

  it("keeps the number optional — 'the number is wrong' is sometimes 'there is none'", () => {
    expect(parseFixFigureForm({ ...valid, popNumber: "" })).toMatchObject({
      ok: true,
      value: { popNumber: null },
    });
  });

  it("moves the denominator with the category (ADR-009)", () => {
    expect(parseFixFigureForm({ ...valid, category: "spider_verse" })).toMatchObject({
      ok: true,
      value: { category: "spider_verse", countsTowardTotal: false },
    });
  });

  it("blanks a product line that is only whitespace", () => {
    expect(parseFixFigureForm({ ...valid, productLine: "   " })).toMatchObject({
      ok: true,
      value: { productLine: null },
    });
  });

  it("refuses a nameless row, a non-numeric number and an invented category", () => {
    expect(parseFixFigureForm({ ...valid, name: "  " })).toEqual({
      ok: false,
      errors: ["NAME_REQUIRED"],
    });
    expect(parseFixFigureForm({ ...valid, popNumber: "14a50" })).toEqual({
      ok: false,
      errors: ["BAD_NUMBER"],
    });
    expect(parseFixFigureForm({ ...valid, category: "villains" })).toEqual({
      ok: false,
      errors: ["BAD_CATEGORY"],
    });
  });

  it("refuses a number that would overflow the column", () => {
    expect(parseFixFigureForm({ ...valid, popNumber: "99999999999" })).toEqual({
      ok: false,
      errors: ["BAD_NUMBER"],
    });
  });

  it("reports every broken field at once — this form is filled in standing up", () => {
    expect(parseFixFigureForm({ name: "", popNumber: "x", category: "" })).toEqual({
      ok: false,
      errors: ["NAME_REQUIRED", "BAD_NUMBER", "BAD_CATEGORY"],
    });
  });
});

describe("fixFigureFormFields", () => {
  it("reads exactly the keys the form posts, and nothing a hand-built POST adds", () => {
    const data = new FormData();
    data.append("referenceFigureId", "ref-1");
    data.append("name", "Spider-Man");
    data.append("upc", "0889698636759");
    data.append("via", "barcode");
    data.append("q", "1450");
    data.append("needsReview", "false");
    data.append("slug", "a-new-slug");

    expect(fixFigureFormFields(data)).toEqual({
      referenceFigureId: "ref-1",
      name: "Spider-Man",
      upc: "0889698636759",
      via: "barcode",
      q: "1450",
    });
  });
});

describe("the review note", () => {
  it("says who decided and when", () => {
    expect(manualCorrectionNote("2026-08-07")).toBe("manually corrected by owner 2026-08-07");
  });

  it("is the whole note when there was none before", () => {
    expect(appendReviewNote(null, "fixed")).toBe("fixed");
    expect(appendReviewNote("   ", "fixed")).toBe("fixed");
  });

  it("appends rather than replaces — a UPC clash must survive the first correction", () => {
    const clash = "upc clash: kept 0889698636759, scanned 0889698636766";
    expect(appendReviewNote(clash, manualCorrectionNote("2026-08-07"))).toBe(
      `${clash} · manually corrected by owner 2026-08-07`,
    );
  });

  it("does not write the same line twice — two fixes in one day are one correction", () => {
    const note = manualCorrectionNote("2026-08-07");
    expect(appendReviewNote(note, note)).toBe(note);
    expect(appendReviewNote(appendReviewNote("clash", note), note)).toBe(`clash · ${note}`);
  });

  it("trims from the FRONT when it gets long — the end is the part still true", () => {
    const long = "x".repeat(600);
    const result = appendReviewNote(long, "manually corrected by owner 2026-08-07");

    expect(result.length).toBeLessThanOrEqual(REVIEW_NOTE_LIMIT + 2);
    expect(result.startsWith("… ")).toBe(true);
    expect(result.endsWith("manually corrected by owner 2026-08-07")).toBe(true);
  });
});
