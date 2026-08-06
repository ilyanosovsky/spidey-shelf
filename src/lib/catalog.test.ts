import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { CATALOG_CSV_PATH, catalogSlug, parseCatalogCsv } from "./catalog";

const HEADER =
  "pop_number,name,character,product_line,release_year,exclusivity,variant_flags," +
  "counts_toward_total,source,source_url,needs_review,notes";

const row = (fields: string) => parseCatalogCsv(`${HEADER}\n${fields}`)[0];

describe("parseCatalogCsv", () => {
  it("maps a full row onto reference_figures columns", () => {
    expect(
      row(
        "1450,Spider-Man (Last Stand),Spider-Man,Pop! Marvel,2024,Walgreens,chase|glow," +
          "true,popshopguide,https://example.test/list,false,seen in store",
      ),
    ).toEqual({
      slug: "pop-marvel-spider-man-last-stand-1450",
      popNumber: 1450,
      name: "Spider-Man (Last Stand)",
      character: "Spider-Man",
      productLine: "Pop! Marvel",
      releaseYear: 2024,
      exclusivity: "Walgreens",
      variantFlags: ["chase", "glow"],
      countsTowardTotal: true,
      source: "popshopguide",
      sourceUrl: "https://example.test/list",
      needsReview: false,
    });
  });

  it("turns empty optional fields into nulls and an empty flag list", () => {
    expect(row(",Spider-Man,,Pop! Marvel,,,,false,,,true,")).toMatchObject({
      popNumber: null,
      character: null,
      releaseYear: null,
      exclusivity: null,
      variantFlags: [],
      countsTowardTotal: false,
      source: null,
      sourceUrl: null,
      needsReview: true,
    });
  });

  it("defaults the booleans when the cells are blank", () => {
    expect(row("3,Spider-Man,,Pop! Marvel,,,,,,,,")).toMatchObject({
      countsTowardTotal: true,
      needsReview: false,
    });
  });

  it("rejects a non-numeric pop_number", () => {
    expect(() => row("15a,Spider-Man,,Pop! Marvel,,,,true,,,false,")).toThrow(
      /pop_number.*whole number/,
    );
  });

  it("rejects a non-boolean flag", () => {
    expect(() => row("3,Spider-Man,,Pop! Marvel,,,,yes,,,false,")).toThrow(
      /counts_toward_total.*true or false/,
    );
  });

  it("rejects a row without a name", () => {
    expect(() => row("3,,,Pop! Marvel,,,,true,,,false,")).toThrow(/`name` is required/);
  });

  it("rejects a file missing a required column", () => {
    expect(() => parseCatalogCsv("pop_number,name\n3,Spider-Man")).toThrow(
      /missing required column `character`/,
    );
  });
});

describe("catalogSlug", () => {
  const base = {
    name: "Spider-Man Metallic",
    productLine: "Pop! Marvel",
    popNumber: 15,
    variantFlags: ["metallic"],
    exclusivity: "SDCC 2012",
  };

  it("uses the plain figure slug while it is free", () => {
    expect(catalogSlug(base, new Set())).toBe("pop-marvel-spider-man-metallic-15");
  });

  it("falls through to the exclusivity when the base is taken", () => {
    // `metallic` is skipped as a suffix: the base slug already spells it out.
    expect(catalogSlug(base, new Set(["pop-marvel-spider-man-metallic-15"]))).toBe(
      "pop-marvel-spider-man-metallic-15-sdcc-2012",
    );
  });

  it("appends the variant flags before the exclusivity", () => {
    const chase = { ...base, name: "Spider-Man", variantFlags: ["chase", "glow"] };
    expect(catalogSlug(chase, new Set(["pop-marvel-spider-man-15"]))).toBe(
      "pop-marvel-spider-man-15-chase-glow",
    );
  });

  it("falls back to a numeric tail when every disambiguator is taken", () => {
    const taken = new Set([
      "pop-marvel-spider-man-metallic-15",
      "pop-marvel-spider-man-metallic-15-sdcc-2012",
    ]);
    expect(catalogSlug(base, taken)).toBe("pop-marvel-spider-man-metallic-15-sdcc-2012-2");
  });

  it("is deterministic — the same input yields the same slug", () => {
    const taken = new Set(["pop-marvel-spider-man-metallic-15"]);
    expect(catalogSlug(base, taken)).toBe(catalogSlug(base, taken));
  });
});

describe("data/catalog/spiderman.csv", () => {
  const rows = parseCatalogCsv(readFileSync(path.join(process.cwd(), CATALOG_CSV_PATH), "utf8"));

  it("parses every row", () => {
    expect(rows.length).toBeGreaterThan(200);
    expect(rows.every((figure) => figure.name.length > 0)).toBe(true);
  });

  it("has pop numbers that are whole numbers or absent", () => {
    for (const figure of rows) {
      if (figure.popNumber === null) continue;
      expect(Number.isInteger(figure.popNumber)).toBe(true);
      expect(figure.popNumber).toBeGreaterThan(0);
    }
  });

  it("computes a unique slug for every row", () => {
    const slugs = rows.map((figure) => figure.slug);
    const duplicates = slugs.filter((slug, index) => slugs.indexOf(slug) !== index);
    expect(duplicates).toEqual([]);
    expect(new Set(slugs).size).toBe(rows.length);
  });

  it("gives every row a product line and a source url", () => {
    for (const figure of rows) {
      expect(figure.productLine, figure.slug).toBeTruthy();
      expect(figure.sourceUrl, figure.slug).toMatch(/^https?:\/\//);
    }
  });

  it("contains all 12 owned figures", () => {
    // The owner's shelf as of Phase 2 — the seed is worthless if a figure he holds in his
    // hand answers NOT OWNED because the catalog never heard of it.
    const owned = [3, 932, 971, 1136, 913, 1412, 1450, 1451, 1445, 1449, 1531, 1239];
    const numbers = new Set(rows.map((figure) => figure.popNumber));
    expect(owned.filter((popNumber) => !numbers.has(popNumber))).toEqual([]);
  });

  it("matches the owned figures by name, not just by number", () => {
    const owned: [number, string][] = [
      [3, "Spider-Man"],
      [932, "Spider-Man (Japanese TV Series)"],
      [971, "Peter Parker (Advanced Suit 2.0)"],
      [1136, "Spider-Man"],
      [913, "Spider-Man Integrated Suit"],
      [1412, "Miles G Morales"],
      [1450, "Spider-Man (Last Stand)"],
      [1451, "Fantastic Four Spider-Man"],
      [1445, "Spider-Man (Fear Itself Suit)"],
      [1449, "Spider-Man (with Dog)"],
      [1531, "Peter Parker"],
      [1239, "Peter B. Parker & Mayday"],
    ];
    const missing = owned.filter(
      ([popNumber, name]) =>
        !rows.some((figure) => figure.popNumber === popNumber && figure.name === name),
    );
    expect(missing).toEqual([]);
  });

  it("keeps a core-canon denominator worth showing", () => {
    const core = rows.filter((figure) => figure.countsTowardTotal);
    expect(core.length).toBeGreaterThan(100);
    expect(core.length).toBeLessThanOrEqual(rows.length);
  });
});
