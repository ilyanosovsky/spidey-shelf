import { describe, expect, it } from "vitest";

import { adminFigure, VARIANT_FIXTURE } from "@/test/fixtures";

import {
  baseFigureName,
  collectionFilterHref,
  duplicateSuccessNote,
  duplicateWarning,
  filterOwnedRows,
  findOwnedDuplicate,
  firstParam,
  lastUsedPlace,
  newFigurePrefill,
  parseCollectionFilter,
  parseNewFigureForm,
  parseQuickAddDetailsForm,
  parseQuickAddErrors,
  parseQuickAddIntent,
  parseQuickAddStep,
  parseUuidParam,
  quickAddDefaults,
  quickAddErrorMessages,
  quickAddErrorParam,
  quickAddHref,
  storiesOwedLabel,
  variantChips,
  variantNamePrefix,
  variantSiblings,
  type OwnedCopy,
} from "./quick-add";

const REF = "11111111-1111-4111-8111-111111111111";

describe("step parsing", () => {
  it("reads the five steps", () => {
    expect(parseQuickAddStep("identify")).toBe("identify");
    expect(parseQuickAddStep("new")).toBe("new");
    expect(parseQuickAddStep("confirm")).toBe("confirm");
    expect(parseQuickAddStep("details")).toBe("details");
    expect(parseQuickAddStep("done")).toBe("done");
  });

  it("falls back to the search box rather than 404ing on a broken URL", () => {
    expect(parseQuickAddStep(undefined)).toBe("identify");
    expect(parseQuickAddStep("")).toBe("identify");
    expect(parseQuickAddStep("confir")).toBe("identify");
    expect(parseQuickAddStep("../../etc/passwd")).toBe("identify");
  });

  it("is case- and space-insensitive, and takes the first of a repeated param", () => {
    expect(parseQuickAddStep(" CONFIRM ")).toBe("confirm");
    expect(parseQuickAddStep(["details", "done"])).toBe("details");
  });

  it("takes the first value of a repeated parameter", () => {
    expect(firstParam(["a", "b"])).toBe("a");
    expect(firstParam(undefined)).toBeUndefined();
  });
});

describe("parseUuidParam", () => {
  it("accepts a uuid and lowercases it", () => {
    expect(parseUuidParam(REF)).toBe(REF);
    expect(parseUuidParam(REF.toUpperCase())).toBe(REF);
  });

  it("refuses anything Postgres would choke on", () => {
    expect(parseUuidParam("not-a-uuid")).toBeNull();
    expect(parseUuidParam("")).toBeNull();
    expect(parseUuidParam(undefined)).toBeNull();
    expect(parseUuidParam("' or 1=1 --")).toBeNull();
    expect(parseUuidParam(`${REF} `)).toBe(REF);
  });
});

describe("quickAddHref", () => {
  it("keeps the default step out of the address bar", () => {
    expect(quickAddHref("identify")).toBe("/admin/add");
  });

  it("builds a step URL with its parameters", () => {
    expect(quickAddHref("confirm", { ref: REF })).toBe(`/admin/add?step=confirm&ref=${REF}`);
  });

  it("drops empty parameters and escapes the rest", () => {
    expect(quickAddHref("new", { q: "", err: undefined })).toBe("/admin/add?step=new");
    expect(quickAddHref("new", { q: "no way home" })).toBe("/admin/add?step=new&q=no+way+home");
  });

  it("carries the query back to step 1 so a wrong pick is one tap from the results", () => {
    expect(quickAddHref("identify", { q: "1450" })).toBe("/admin/add?q=1450");
  });
});

describe("error codes", () => {
  it("round-trips through the query string", () => {
    const param = quickAddErrorParam(["BAD_DATE", "BAD_COUNTRY"]);

    expect(parseQuickAddErrors(param)).toEqual(["BAD_DATE", "BAD_COUNTRY"]);
    expect(quickAddErrorMessages(parseQuickAddErrors(param))).toEqual([
      "DATE MUST BE YYYY-MM-DD",
      "PICK A COUNTRY FROM THE LIST",
    ]);
  });

  it("drops anything that is not a known code — the URL never paints its own text", () => {
    expect(parseQuickAddErrors("<script>alert(1)</script>")).toEqual([]);
    expect(parseQuickAddErrors("BAD_DATE,NONSENSE")).toEqual(["BAD_DATE"]);
    expect(parseQuickAddErrors(undefined)).toEqual([]);
  });

  it("dedupes", () => {
    expect(parseQuickAddErrors("BAD_DATE,bad_date")).toEqual(["BAD_DATE"]);
  });
});

describe("variant grouping", () => {
  it("strips the variant parentheses to compare figures", () => {
    expect(baseFigureName("Spider-Man (Metallic)")).toBe("spider man");
    expect(baseFigureName("Spider-Man (Glow) (Chase)")).toBe("spider man");
    expect(variantNamePrefix("Spider-Man (Metallic)")).toBe("Spider-Man");
    expect(variantNamePrefix("Venom")).toBe("Venom");
  });

  it("groups everything sharing the box number", () => {
    const siblings = variantSiblings(adminFigure(), VARIANT_FIXTURE);

    expect(siblings.map((figure) => figure.name)).toEqual([
      "Spider-Man (Glow)",
      "Spider-Man (Metallic)",
      "Spider-Man (Translucent)",
    ]);
  });

  it("adds a differently-numbered variant of the same figure in the same line", () => {
    // #4 "Spider-Man (Translucent)" shares neither number nor spelling with #3 "Spider-Man",
    // but it is the same base name in the same product line — a variant that got its own box.
    const siblings = variantSiblings(adminFigure({ popNumber: null }), VARIANT_FIXTURE);

    expect(siblings.map((figure) => figure.popNumber)).toEqual([3, 3, 4]);
  });

  it("refuses to group two identically-named figures from different waves", () => {
    // #1090 is also called exactly "Spider-Man". It is a different sculpt, not a variant —
    // without this rule the confirm screen for #3 would offer half the catalog.
    const siblings = variantSiblings(adminFigure(), VARIANT_FIXTURE);

    expect(siblings.some((figure) => figure.popNumber === 1090)).toBe(false);
  });

  it("never includes the selected figure or an unrelated one", () => {
    const siblings = variantSiblings(adminFigure(), VARIANT_FIXTURE);

    expect(siblings.some((figure) => figure.id === adminFigure().id)).toBe(false);
    expect(siblings.some((figure) => figure.name === "Venom")).toBe(false);
  });

  it("caps the row so the question stays answerable", () => {
    const many = Array.from({ length: 20 }, (_, index) =>
      adminFigure({ id: `id-${index}`, name: `Spider-Man (V${index})` }),
    );

    expect(variantSiblings(adminFigure(), many, 12)).toHaveLength(12);
    expect(variantSiblings(adminFigure(), many, 0)).toHaveLength(0);
  });

  it("puts the exclusivity in front of the variant flags on the chips", () => {
    expect(variantChips({ exclusivity: "SDCC", variantFlags: ["glow"] })).toEqual(["SDCC", "glow"]);
    expect(variantChips({ exclusivity: null, variantFlags: null })).toEqual([]);
    expect(variantChips({ exclusivity: "  ", variantFlags: ["", "chase"] })).toEqual(["chase"]);
  });
});

describe("the duplicate guard", () => {
  function copy(overrides: Partial<OwnedCopy> = {}): OwnedCopy {
    return {
      id: "owned-1",
      status: "mine",
      acquiredAt: "2025-04-12",
      quantity: 1,
      needsStory: false,
      ...overrides,
    };
  }

  it("says nothing about a figure that is not on the shelf", () => {
    expect(findOwnedDuplicate([])).toBeNull();
  });

  it("does NOT warn about a figure he had and lost", () => {
    // Re-buying a Pop he gave away is how this collection grows — warning here would cost
    // him the entry.
    expect(findOwnedDuplicate([copy({ status: "not_mine_anymore" })])).toBeNull();
  });

  it("bumps the newest copy but dates the vault from the first", () => {
    const guard = findOwnedDuplicate([
      copy({ id: "old", acquiredAt: "2025-04-12" }),
      copy({ id: "new", acquiredAt: "2026-01-05" }),
    ]);

    expect(guard).toEqual({ targetId: "new", since: "2025-04-12", quantity: 2 });
  });

  it("counts quantities, not rows", () => {
    expect(findOwnedDuplicate([copy({ quantity: 3 })])?.quantity).toBe(3);
    expect(findOwnedDuplicate([copy({ quantity: null })])?.quantity).toBe(1);
  });

  it("spells the warning with the month the first copy arrived", () => {
    expect(duplicateWarning({ targetId: "x", since: "2025-04-12", quantity: 1 })).toBe(
      "ALREADY IN THE VAULT (SINCE APR 2025)",
    );
  });

  it("drops the date rather than print a broken one", () => {
    expect(duplicateWarning({ targetId: "x", since: null, quantity: 1 })).toBe(
      "ALREADY IN THE VAULT",
    );
  });

  it("names the new quantity on the success screen", () => {
    expect(duplicateSuccessNote(2)).toContain("QUANTITY IS NOW 2");
  });
});

describe("smart defaults", () => {
  it("takes the most recent place — the whole trip in one tap", () => {
    expect(
      lastUsedPlace([
        { city: "Moscow", country: "RU" },
        { city: "Batumi", country: "GE" },
      ]),
    ).toEqual({ city: "Moscow", country: "RU" });
  });

  it("skips rows with no place at all and uppercases the country", () => {
    expect(
      lastUsedPlace([
        { city: null, country: null },
        { city: "  ", country: "" },
        { city: "LA", country: "us" },
      ]),
    ).toEqual({ city: "LA", country: "US" });
  });

  it("accepts a country without a city — the flag alone is worth prefilling", () => {
    expect(lastUsedPlace([{ city: null, country: "IL" }])).toEqual({ city: null, country: "IL" });
  });

  it("has nothing to offer on an empty shelf", () => {
    expect(lastUsedPlace([])).toBeNull();
    expect(quickAddDefaults("2026-08-06", null)).toEqual({
      acquiredAt: "2026-08-06",
      acquiredCity: "",
      acquiredCountry: "",
      status: "mine",
    });
  });

  it("fills today and the last place, and preselects MINE", () => {
    expect(quickAddDefaults("2026-08-06", { city: "Moscow", country: "RU" })).toEqual({
      acquiredAt: "2026-08-06",
      acquiredCity: "Moscow",
      acquiredCountry: "RU",
      status: "mine",
    });
  });
});

describe("the new-figure form", () => {
  it("prefills the number when the owner searched a number", () => {
    expect(newFigurePrefill("1450")).toEqual({ name: "", popNumber: "1450" });
    expect(newFigurePrefill("# 1450")).toEqual({ name: "", popNumber: "1450" });
  });

  it("prefills the name when he searched words", () => {
    expect(newFigurePrefill("no way home")).toEqual({ name: "no way home", popNumber: "" });
    expect(newFigurePrefill("")).toEqual({ name: "", popNumber: "" });
  });

  it("accepts a figure with nothing but a name and a category", () => {
    const parsed = parseNewFigureForm({ name: "  Spidey  Deluxe ", category: "peter" });

    expect(parsed).toEqual({
      ok: true,
      value: {
        name: "Spidey Deluxe",
        popNumber: null,
        category: "peter",
        productLine: null,
        countsTowardTotal: true,
        upc: null,
      },
    });
  });

  it("takes the barcode a scan arrived with, canonicalised, and drops a broken one", () => {
    const scanned = parseNewFigureForm({ name: "X", category: "other", upc: "889698636759" });
    expect(scanned.ok && scanned.value.upc).toBe("0889698636759");

    const broken = parseNewFigureForm({ name: "X", category: "other", upc: "889698636758" });
    expect(broken.ok && broken.value.upc).toBeNull();
  });

  it("mirrors counts_toward_total onto the peter bucket and nothing else (ADR-009)", () => {
    const spiderVerse = parseNewFigureForm({ name: "Miles", category: "spider_verse" });

    expect(spiderVerse.ok && spiderVerse.value.countsTowardTotal).toBe(false);
  });

  it("takes a number with a hash in front of it", () => {
    const parsed = parseNewFigureForm({ name: "X", category: "other", popNumber: "#1450" });

    expect(parsed.ok && parsed.value.popNumber).toBe(1450);
  });

  it("collects every complaint at once", () => {
    const parsed = parseNewFigureForm({ name: "  ", category: "villains", popNumber: "12a" });

    expect(parsed).toEqual({
      ok: false,
      errors: ["NAME_REQUIRED", "BAD_NUMBER", "BAD_CATEGORY"],
    });
  });

  it("refuses a number that would overflow the column", () => {
    const parsed = parseNewFigureForm({ name: "X", category: "other", popNumber: "99999999999" });

    expect(parsed).toEqual({ ok: false, errors: ["BAD_NUMBER"] });
  });
});

describe("the details form", () => {
  const base = { referenceFigureId: REF, status: "mine", acquiredAt: "2026-08-06" };

  it("saves a sighting with its story", () => {
    const parsed = parseQuickAddDetailsForm({
      ...base,
      acquiredCity: " Moscow ",
      acquiredCountry: "ru",
      story: "  Found it in a toy shop by the river.  ",
      intent: "save",
    });

    expect(parsed).toEqual({
      ok: true,
      value: {
        referenceFigureId: REF,
        status: "mine",
        acquiredAt: "2026-08-06",
        acquiredCity: "Moscow",
        acquiredCountry: "RU",
        story: "Found it in a toy shop by the river.",
        needsStory: false,
        upc: null,
      },
    });
  });

  it("carries a scanned barcode through to the write that backfills it", () => {
    const parsed = parseQuickAddDetailsForm({ ...base, upc: "889698636759" });

    expect(parsed.ok && parsed.value.upc).toBe("0889698636759");
  });

  it("keeps the invariant the story queue depends on: no story means a story owed", () => {
    const empty = parseQuickAddDetailsForm({ ...base, story: "   ", intent: "save" });

    expect(empty.ok && empty.value.story).toBeNull();
    expect(empty.ok && empty.value.needsStory).toBe(true);
  });

  it("SKIP FOR NOW logs the sighting and owes the story", () => {
    const skipped = parseQuickAddDetailsForm({ ...base, story: "half a thought", intent: "skip" });

    expect(skipped.ok && skipped.value.story).toBeNull();
    expect(skipped.ok && skipped.value.needsStory).toBe(true);
  });

  it("defaults an unknown intent to saving", () => {
    expect(parseQuickAddIntent(undefined)).toBe("save");
    expect(parseQuickAddIntent("nonsense")).toBe("save");
    expect(parseQuickAddIntent(" SKIP ")).toBe("skip");
  });

  it("refuses a figure that is not a uuid, a bad status, a bad date and a bad country", () => {
    const parsed = parseQuickAddDetailsForm({
      referenceFigureId: "nope",
      status: "borrowed",
      acquiredAt: "06/08/2026",
      acquiredCountry: "RUS",
    });

    expect(parsed).toEqual({
      ok: false,
      errors: ["PICK_FIGURE", "BAD_STATUS", "BAD_DATE", "BAD_COUNTRY"],
    });
  });

  it("tells a well-formed date that does not exist from a malformed one", () => {
    expect(parseQuickAddDetailsForm({ ...base, acquiredAt: "2026-02-30" })).toEqual({
      ok: false,
      errors: ["UNREAL_DATE"],
    });
  });

  it("treats a missing place as no place, not as an error", () => {
    const parsed = parseQuickAddDetailsForm(base);

    expect(parsed.ok && parsed.value.acquiredCity).toBeNull();
    expect(parsed.ok && parsed.value.acquiredCountry).toBeNull();
  });
});

describe("the story queue", () => {
  const rows = [
    { id: "a", needsStory: true },
    { id: "b", needsStory: false },
    { id: "c", needsStory: null },
  ];

  it("keeps only the sightings that owe a story", () => {
    expect(filterOwnedRows(rows, "needs_story").map((row) => row.id)).toEqual(["a"]);
  });

  it("passes everything through by default, as a copy", () => {
    const all = filterOwnedRows(rows);

    expect(all).toHaveLength(3);
    expect(all).not.toBe(rows);
  });

  it("reads the filter off the URL and refuses anything else", () => {
    expect(parseCollectionFilter("needs_story")).toBe("needs_story");
    expect(parseCollectionFilter("NEEDS_STORY")).toBe("needs_story");
    expect(parseCollectionFilter("everything")).toBe("all");
    expect(parseCollectionFilter(undefined)).toBe("all");
  });

  it("keeps the default filter out of the address bar", () => {
    expect(collectionFilterHref("all")).toBe("/admin/collection");
    expect(collectionFilterHref("needs_story")).toBe("/admin/collection?filter=needs_story");
  });

  it("shows an empty queue rather than hiding it — no news is good news worth reading", () => {
    expect(storiesOwedLabel(0)).toBe("STORIES OWED: 0");
    expect(storiesOwedLabel(3)).toBe("STORIES OWED: 3");
    expect(storiesOwedLabel(-1)).toBe("STORIES OWED: 0");
  });
});
