import { describe, expect, it } from "vitest";

import {
  ownedFigureFormFields,
  parseOwnedFigureForm,
  parseReferenceSearchQuery,
} from "./collection-form";

const REFERENCE_ID = "0b6f5a2c-1d3e-4a5b-8c7d-9e0f1a2b3c4d";

const validFields = {
  referenceFigureId: REFERENCE_ID,
  status: "mine",
  acquiredAt: "2026-08-06",
  acquiredCity: "Haifa",
  acquiredCountry: "il",
  story: "  ",
  isPublic: "on",
};

describe("parseReferenceSearchQuery", () => {
  it("reads a run of digits as a pop number", () => {
    expect(parseReferenceSearchQuery("1450")).toEqual({
      kind: "number",
      popNumber: 1450,
      raw: "1450",
    });
  });

  it("accepts the number with a leading hash and stray spaces", () => {
    expect(parseReferenceSearchQuery("  #3 ")).toMatchObject({ kind: "number", popNumber: 3 });
  });

  it("reads anything else as text", () => {
    expect(parseReferenceSearchQuery("  spider-man   last  stand ")).toEqual({
      kind: "text",
      text: "spider-man last stand",
    });
  });

  it("keeps a mixed number-and-word query as text", () => {
    // "1450 stand" is a name search, not a number lookup — only a bare number is exact.
    expect(parseReferenceSearchQuery("1450 stand")).toEqual({
      kind: "text",
      text: "1450 stand",
    });
  });

  it("treats nothing worth querying as empty", () => {
    expect(parseReferenceSearchQuery("")).toEqual({ kind: "empty" });
    expect(parseReferenceSearchQuery("   ")).toEqual({ kind: "empty" });
    expect(parseReferenceSearchQuery("s")).toEqual({ kind: "empty" });
  });

  it("falls back to text when the digits cannot be a pop number", () => {
    expect(parseReferenceSearchQuery("99999999999999")).toMatchObject({ kind: "text" });
  });
});

describe("parseOwnedFigureForm", () => {
  it("accepts a complete form and normalizes it", () => {
    expect(parseOwnedFigureForm(validFields)).toEqual({
      ok: true,
      value: {
        referenceFigureId: REFERENCE_ID,
        status: "mine",
        acquiredAt: "2026-08-06",
        acquiredCity: "Haifa",
        acquiredCountry: "IL",
        story: null,
        isPublic: true,
      },
    });
  });

  it("treats a missing checkbox as not public", () => {
    const { isPublic, ...withoutCheckbox } = validFields;
    expect(isPublic).toBe("on");
    expect(parseOwnedFigureForm(withoutCheckbox)).toMatchObject({
      ok: true,
      value: { isPublic: false },
    });
  });

  it("keeps a story that has content", () => {
    expect(
      parseOwnedFigureForm({ ...validFields, story: " bought it in the rain " }),
    ).toMatchObject({ ok: true, value: { story: "bought it in the rain" } });
  });

  it("allows an unknown place", () => {
    expect(
      parseOwnedFigureForm({ ...validFields, acquiredCity: "", acquiredCountry: "" }),
    ).toMatchObject({ ok: true, value: { acquiredCity: null, acquiredCountry: null } });
  });

  it("rejects a form with no figure picked", () => {
    expect(parseOwnedFigureForm({ ...validFields, referenceFigureId: "1450" })).toEqual({
      ok: false,
      errors: ["PICK A FIGURE FROM THE CATALOG"],
    });
  });

  it("rejects an unknown status", () => {
    expect(parseOwnedFigureForm({ ...validFields, status: "sold" })).toMatchObject({
      ok: false,
      errors: ["STATUS MUST BE MINE OR NOT MINE ANYMORE"],
    });
  });

  it("rejects a malformed date and a date that does not exist", () => {
    expect(parseOwnedFigureForm({ ...validFields, acquiredAt: "06.08.2026" })).toMatchObject({
      ok: false,
      errors: ["DATE MUST BE YYYY-MM-DD"],
    });
    expect(parseOwnedFigureForm({ ...validFields, acquiredAt: "2026-02-30" })).toMatchObject({
      ok: false,
      errors: ["THAT DATE DOES NOT EXIST"],
    });
  });

  it("rejects a country nobody can place, and accepts the four spellings that resolve", () => {
    expect(parseOwnedFigureForm({ ...validFields, acquiredCountry: "Narnia" })).toMatchObject({
      ok: false,
      errors: ["PICK A COUNTRY FROM THE LIST"],
    });
    // `ISR` used to fail on length alone; it fails now because it names no country.
    expect(parseOwnedFigureForm({ ...validFields, acquiredCountry: "ISR" })).toMatchObject({
      ok: false,
      errors: ["PICK A COUNTRY FROM THE LIST"],
    });

    for (const spelling of ["il", "IL", "Israel", "Israel (IL)"]) {
      expect(parseOwnedFigureForm({ ...validFields, acquiredCountry: spelling })).toMatchObject({
        ok: true,
        value: { acquiredCountry: "IL" },
      });
    }
  });

  it("reports every broken field at once", () => {
    const result = parseOwnedFigureForm({
      referenceFigureId: "",
      status: "",
      acquiredAt: "",
      acquiredCountry: "XYZ",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toHaveLength(4);
  });
});

describe("ownedFigureFormFields", () => {
  it("picks only the fields the form owns", () => {
    const formData = new FormData();
    formData.set("referenceFigureId", REFERENCE_ID);
    formData.set("status", "mine");
    formData.set("acquiredAt", "2026-08-06");
    formData.set("isFavorite", "on");

    expect(ownedFigureFormFields(formData)).toEqual({
      referenceFigureId: REFERENCE_ID,
      status: "mine",
      acquiredAt: "2026-08-06",
    });
  });
});
