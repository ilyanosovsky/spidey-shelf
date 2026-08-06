import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { CATALOG_CSV_PATHS, parseCatalogCsvFiles } from "./catalog";
import {
  matchOwnedRow,
  nameScore,
  OWNED_CSV_PATH,
  parseOwnedCsv,
  resolveOwnedRows,
  type OwnedSeedRow,
  type ReferenceCandidate,
} from "./collection";

const HEADER = "pop_number,name,status,acquired_at,acquired_city,acquired_country,notes";

const row = (fields: string) => parseOwnedCsv(`${HEADER}\n${fields}`)[0];

describe("parseOwnedCsv", () => {
  it("maps a full row onto owned_figures columns", () => {
    expect(row("1450,Spider-Man Last Stand,mine,2025-04-12,LA,US,")).toEqual({
      popNumber: 1450,
      name: "Spider-Man Last Stand",
      status: "mine",
      acquiredAt: "2025-04-12",
      acquiredCity: "LA",
      acquiredCountry: "US",
      line: 2,
    });
  });

  it("uppercases the country code", () => {
    expect(row("3,Spider-Man,mine,2023-12-28,Haifa,il,")).toMatchObject({
      acquiredCountry: "IL",
    });
  });

  it("accepts the not_mine_anymore status", () => {
    expect(row("29,Little Prince,not_mine_anymore,2023-12-28,Haifa,IL,")).toMatchObject({
      status: "not_mine_anymore",
    });
  });

  it("rejects an unknown status", () => {
    expect(() => row("3,Spider-Man,sold,2023-12-28,Haifa,IL,")).toThrow(
      /`status` must be one of mine, not_mine_anymore/,
    );
  });

  it("rejects a non-ISO date", () => {
    expect(() => row("3,Spider-Man,mine,28.12.2023,Haifa,IL,")).toThrow(
      /`acquired_at` must be YYYY-MM-DD/,
    );
  });

  it("rejects a date that does not exist", () => {
    expect(() => row("3,Spider-Man,mine,2025-02-30,Haifa,IL,")).toThrow(
      /`acquired_at` is not a real date/,
    );
  });

  it("rejects a country code that is not two letters", () => {
    expect(() => row("3,Spider-Man,mine,2023-12-28,Haifa,ISR,")).toThrow(
      /`acquired_country` must be a 2-letter ISO code/,
    );
  });

  it("requires a pop number, a name and a place", () => {
    expect(() => row(",Spider-Man,mine,2023-12-28,Haifa,IL,")).toThrow(/`pop_number` is required/);
    expect(() => row("3,,mine,2023-12-28,Haifa,IL,")).toThrow(/`name` is required/);
    expect(() => row("3,Spider-Man,mine,2023-12-28,,IL,")).toThrow(/`acquired_city` is required/);
  });

  it("rejects a file missing a required column", () => {
    expect(() => parseOwnedCsv("pop_number,name\n3,Spider-Man")).toThrow(
      /missing required column `status`/,
    );
  });
});

describe("nameScore", () => {
  it("scores an exact match — ignoring case and punctuation — as 1", () => {
    expect(nameScore("Peter Parker Advanced Suit 2.0", "Peter Parker (Advanced Suit 2.0)")).toBe(1);
  });

  it("ignores word order", () => {
    expect(nameScore("Deadpool Sleepover", "Sleepover Deadpool")).toBe(1);
    expect(nameScore("Spider-Man Fantastic Four", "Fantastic Four Spider-Man")).toBe(1);
  });

  it("scores containment high but below an exact match", () => {
    const contained = nameScore("Deadpool", "Deadpool (Hearts Wolverine)");
    expect(contained).toBeGreaterThan(0.5);
    expect(contained).toBeLessThan(1);
  });

  it("scores unrelated names at zero", () => {
    expect(nameScore("Leroy", "Spider-Man")).toBe(0);
  });
});

describe("matchOwnedRow", () => {
  const shelfRow = (popNumber: number, name: string): OwnedSeedRow => ({
    popNumber,
    name,
    status: "mine",
    acquiredAt: "2025-01-01",
    acquiredCity: "Haifa",
    acquiredCountry: "IL",
    line: 2,
  });

  const catalog: ReferenceCandidate[] = [
    { id: "a", popNumber: 3, name: "Spider-Man" },
    { id: "b", popNumber: 3, name: "Spider-Man Black & White" },
    { id: "c", popNumber: 3, name: "Spider-Man Metallic" },
    { id: "d", popNumber: 932, name: "Spider-Man (Japanese TV Series)" },
    { id: "e", popNumber: 932, name: "Spider-Man (Japanese TV Series) (Glow Chase)" },
    { id: "f", popNumber: 1449, name: "Spider-Man (with Dog)" },
    { id: "g", popNumber: 1413, name: "Deadpool (Hearts Wolverine)" },
    { id: "h", popNumber: 7, name: "Green Goblin" },
    { id: "i", popNumber: 7, name: "Doctor Octopus" },
  ];

  const matched = (popNumber: number, name: string) =>
    matchOwnedRow(shelfRow(popNumber, name), catalog);

  it("prefers the exact name among variants sharing a number", () => {
    expect(matched(3, "Spider-Man")).toMatchObject({ reference: { id: "a" }, score: 1 });
  });

  it("beats a chase variant with the plain figure's exact name", () => {
    expect(matched(932, "Spider-Man Japanese TV Series")).toMatchObject({
      reference: { id: "d" },
    });
  });

  it("takes the only candidate even when the wording differs", () => {
    // The owner writes what he sees on the shelf; the checklist adds "(with Dog)".
    expect(matched(1449, "Spider-Man")).toMatchObject({ reference: { id: "f" } });
    expect(matched(1413, "Deadpool")).toMatchObject({ reference: { id: "g" } });
  });

  it("reports a number that is not in the catalog", () => {
    expect(matched(9999, "Spider-Man")).toMatchObject({
      reason: "no catalog figure with pop_number 9999",
    });
  });

  it("refuses to guess when two candidates score the same", () => {
    const result = matchOwnedRow(shelfRow(3, "Spider-Man Black & White Metallic"), [
      { id: "b", popNumber: 3, name: "Spider-Man Black & White" },
      { id: "c", popNumber: 3, name: "Spider-Man Metallic" },
    ]);
    expect(result).toMatchObject({ reason: expect.stringContaining("ambiguous") });
  });

  it("refuses a shared number whose candidates do not match the name at all", () => {
    expect(matched(7, "Spider-Man")).toMatchObject({
      reason: expect.stringContaining("none matches the name"),
    });
  });
});

describe("data/collection/owned.csv", () => {
  const rows = parseOwnedCsv(readFileSync(path.join(process.cwd(), OWNED_CSV_PATH), "utf8"));

  it("holds the owner's 19 figures", () => {
    expect(rows.length).toBe(19);
  });

  it("has 15 kept and 4 given away", () => {
    expect(rows.filter((figure) => figure.status === "mine").length).toBe(15);
    expect(rows.filter((figure) => figure.status === "not_mine_anymore").length).toBe(4);
  });

  it("has an ISO date and a 2-letter country on every row", () => {
    for (const figure of rows) {
      expect(figure.acquiredAt, figure.name).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(figure.acquiredCountry, figure.name).toMatch(/^[A-Z]{2}$/);
      expect(figure.acquiredCity.length, figure.name).toBeGreaterThan(0);
    }
  });

  it("is one row per (figure, date) — the seeder's idempotency key", () => {
    const keys = rows.map((figure) => `${figure.popNumber}@${figure.acquiredAt}`);
    expect(new Set(keys).size).toBe(rows.length);
  });

  it("resolves every row against the real catalog CSVs", () => {
    // The seeder hard-fails on a miss, so this is the test that keeps `db:seed:owned`
    // runnable: all 19 figures must exist in data/catalog/.
    const references: ReferenceCandidate[] = parseCatalogCsvFiles(
      CATALOG_CSV_PATHS.map((csvPath) => ({
        path: csvPath,
        text: readFileSync(path.join(process.cwd(), csvPath), "utf8"),
      })),
    ).map((figure) => ({ id: figure.slug, popNumber: figure.popNumber, name: figure.name }));

    const { matches, misses } = resolveOwnedRows(rows, references);
    expect(misses.map((miss) => miss.reason)).toEqual([]);
    expect(matches.length).toBe(19);
    expect(new Set(matches.map((match) => match.reference.id)).size).toBe(19);
  });
});
