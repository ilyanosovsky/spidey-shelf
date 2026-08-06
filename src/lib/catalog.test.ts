import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  CATALOG_CSV_PATH,
  CATALOG_CSV_PATHS,
  catalogSlug,
  parseCatalogCsv,
  parseCatalogCsvFiles,
} from "./catalog";
import { FIGURE_CATEGORIES } from "./categories";

const HEADER =
  "pop_number,name,character,category,product_line,release_year,exclusivity,variant_flags," +
  "counts_toward_total,source,source_url,needs_review,notes";

const row = (fields: string) => parseCatalogCsv(`${HEADER}\n${fields}`)[0];

const readCatalog = (csvPath: string) => readFileSync(path.join(process.cwd(), csvPath), "utf8");

describe("parseCatalogCsv", () => {
  it("maps a full row onto reference_figures columns", () => {
    expect(
      row(
        "1450,Spider-Man (Last Stand),Spider-Man,peter,Pop! Marvel,2024,Walgreens,chase|glow," +
          "true,popshopguide,https://example.test/list,false,seen in store",
      ),
    ).toEqual({
      slug: "pop-marvel-spider-man-last-stand-1450",
      popNumber: 1450,
      name: "Spider-Man (Last Stand)",
      character: "Spider-Man",
      category: "peter",
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
    expect(row(",Spider-Man,,other,Pop! Marvel,,,,false,,,true,")).toMatchObject({
      popNumber: null,
      character: null,
      category: "other",
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
    expect(row("3,Spider-Man,,peter,Pop! Marvel,,,,,,,,")).toMatchObject({
      countsTowardTotal: true,
      needsReview: false,
    });
  });

  it("accepts every category of the taxonomy", () => {
    for (const category of FIGURE_CATEGORIES) {
      expect(row(`3,Spider-Man,,${category},Pop! Marvel,,,,true,,,false,`)).toMatchObject({
        category,
      });
    }
  });

  it("normalizes the category's case", () => {
    expect(row("3,Spider-Man,,Spider_Verse,Pop! Marvel,,,,true,,,false,")).toMatchObject({
      category: "spider_verse",
    });
  });

  it("rejects an unknown category", () => {
    expect(() => row("3,Spider-Man,,villains,Pop! Marvel,,,,true,,,false,")).toThrow(
      /`category` must be one of peter, spider_verse, friends_foes, other, found `villains`/,
    );
  });

  it("rejects a blank category instead of defaulting it", () => {
    // The DB column defaults to `other`; a curated CSV row may not lean on that.
    expect(() => row("3,Spider-Man,,,Pop! Marvel,,,,true,,,false,")).toThrow(
      /`category` is required/,
    );
  });

  it("rejects a non-numeric pop_number", () => {
    expect(() => row("15a,Spider-Man,,peter,Pop! Marvel,,,,true,,,false,")).toThrow(
      /pop_number.*whole number/,
    );
  });

  it("rejects a non-boolean flag", () => {
    expect(() => row("3,Spider-Man,,peter,Pop! Marvel,,,,yes,,,false,")).toThrow(
      /counts_toward_total.*true or false/,
    );
  });

  it("rejects a row without a name", () => {
    expect(() => row("3,,,peter,Pop! Marvel,,,,true,,,false,")).toThrow(/`name` is required/);
  });

  it("rejects a file missing a required column", () => {
    expect(() => parseCatalogCsv("pop_number,name\n3,Spider-Man")).toThrow(
      /missing required column `character`/,
    );
  });

  it("rejects a file missing the category column", () => {
    const withoutCategory = HEADER.replace(",category", "");
    expect(() =>
      parseCatalogCsv(`${withoutCategory}\n3,Spider-Man,,Pop! Marvel,,,,true,,,false,`),
    ).toThrow(/missing required column `category`/);
  });
});

describe("parseCatalogCsvFiles", () => {
  const first = `${HEADER}\n3,Spider-Man,,peter,Pop! Marvel,,,,true,,,false,`;

  it("shares one slug namespace across files", () => {
    const second = `${HEADER}\n3,Spider-Man,,other,Pop! Marvel,,Hot Topic,,false,,,false,`;
    const rows = parseCatalogCsvFiles([
      { path: "a.csv", text: first },
      { path: "b.csv", text: second },
    ]);

    expect(rows.map((figure) => figure.slug)).toEqual([
      "pop-marvel-spider-man-3",
      "pop-marvel-spider-man-3-hot-topic",
    ]);
  });

  it("names the offending file in the error", () => {
    const broken = `${HEADER}\n3,Spider-Man,,nope,Pop! Marvel,,,,true,,,false,`;
    expect(() =>
      parseCatalogCsvFiles([
        { path: "data/catalog/spiderman.csv", text: first },
        { path: "data/catalog/others-manual.csv", text: broken },
      ]),
    ).toThrow(/data\/catalog\/others-manual\.csv line 2: `category` must be one of/);
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
  const rows = parseCatalogCsv(readCatalog(CATALOG_CSV_PATH));

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

  it("categorizes every row", () => {
    const uncategorized = rows.filter((figure) => !FIGURE_CATEGORIES.includes(figure.category));
    expect(uncategorized).toEqual([]);
  });

  it("counts toward the total exactly when the figure is Peter Parker (ADR-009)", () => {
    // The one invariant the taxonomy has to keep: the LCD denominator is the `peter` bucket.
    const broken = rows
      .filter((figure) => figure.countsTowardTotal !== (figure.category === "peter"))
      .map((figure) => `${figure.slug} (${figure.category}/${figure.countsTowardTotal})`);
    expect(broken).toEqual([]);
  });

  it("uses no `other` rows — every Spider-Man row lands in one of the three Spidey buckets", () => {
    expect(rows.filter((figure) => figure.category === "other")).toEqual([]);
  });
});

describe("data/catalog/others-manual.csv", () => {
  const rows = parseCatalogCsv(readCatalog(CATALOG_CSV_PATHS[1]));

  it("holds the owner's non-Spider-Man figures", () => {
    expect(rows.length).toBe(7);
    const numbers = rows.map((figure) => figure.popNumber).sort((a, b) => Number(a) - Number(b));
    expect(numbers).toEqual([29, 42, 718, 1344, 1413, 1570, 1572]);
  });

  it("categorizes every row and never counts toward the Spidey total", () => {
    for (const figure of rows) {
      expect(FIGURE_CATEGORIES, figure.slug).toContain(figure.category);
      expect(figure.category, figure.slug).not.toBe("peter");
      expect(figure.countsTowardTotal, figure.slug).toBe(false);
    }
  });

  it("gives every row a product line and a source url", () => {
    for (const figure of rows) {
      expect(figure.productLine, figure.slug).toBeTruthy();
      expect(figure.sourceUrl, figure.slug).toMatch(/^https?:\/\//);
    }
  });
});

describe("the catalog as one file set", () => {
  const rows = parseCatalogCsvFiles(
    CATALOG_CSV_PATHS.map((csvPath) => ({ path: csvPath, text: readCatalog(csvPath) })),
  );

  it("parses both files into one catalog", () => {
    expect(rows.length).toBe(247);
  });

  it("computes a unique slug across files", () => {
    expect(new Set(rows.map((figure) => figure.slug)).size).toBe(rows.length);
  });

  it("keeps `counts_toward_total` ⇔ `peter` over the whole catalog", () => {
    const broken = rows.filter(
      (figure) => figure.countsTowardTotal !== (figure.category === "peter"),
    );
    expect(broken).toEqual([]);
  });
});
