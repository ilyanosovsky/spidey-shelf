// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The Quick Add writes, with the session and the database mocked out.
 *
 * Two things are being checked here and they matter in this order:
 *   1. **every action re-verifies the session before it touches a row** — `src/proxy.ts` is
 *      an optimistic redirect and CVE-2025-29927 showed a proxy check can be skipped, so the
 *      `requireAdmin()` call inside the action is the only real gate (CLAUDE.md, ADR-005);
 *   2. what actually lands in the columns: `source`/`needs_review` on an invented catalog
 *      row, `needs_story` on a skipped sighting, and an *expression* rather than a constant
 *      when a duplicate bumps the quantity.
 *
 * Phase 13 adds a third: `acquired_lat` / `acquired_lng`. The geocoder is exercised for real
 * here — only `fetch` and the "which cities does the shelf already know" query are mocked —
 * because the thing worth protecting is the BUDGET, and a fully mocked resolver would assert
 * that a mock was called rather than that OpenStreetMap was not.
 */

const h = vi.hoisted(() => {
  class RedirectError extends Error {
    url: string;
    constructor(url: string) {
      super(`REDIRECT ${url}`);
      this.url = url;
    }
  }

  const inserts: { values: Record<string, unknown> }[] = [];
  const updates: { values: Record<string, unknown> }[] = [];
  const state = { nextId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" };

  return {
    RedirectError,
    inserts,
    updates,
    state,
    listKnownCityCoordinates: vi.fn(
      async (): Promise<
        { country: string | null; city: string | null; lat: string | null; lng: string | null }[]
      > => [],
    ),
    requireAdmin: vi.fn(async () => ({ sub: "admin", role: "admin" as const })),
    revalidatePath: vi.fn(),
    redirect: vi.fn((url: string) => {
      throw new RedirectError(url);
    }),
    getAdminFigure: vi.fn(),
    getReferenceReviewNote: vi.fn(async (): Promise<{ reviewNote: string | null } | null> => ({
      reviewNote: null,
    })),
    getReferenceUpc: vi.fn(async (): Promise<string | null> => null),
    listOwnedCopies: vi.fn(),
    listTakenSlugs: vi.fn(async () => new Set<string>()),
    db: {
      insert: () => ({
        values: (values: Record<string, unknown>) => {
          inserts.push({ values });
          return { returning: async () => [{ id: state.nextId }] };
        },
      }),
      update: () => ({
        set: (values: Record<string, unknown>) => ({
          where: async () => {
            updates.push({ values });
            return [];
          },
        }),
      }),
    },
  };
});

vi.mock("next/cache", () => ({ revalidatePath: h.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: h.redirect }));
vi.mock("@/db", () => ({ db: h.db }));
vi.mock("@/lib/dal", () => ({ requireAdmin: h.requireAdmin }));
vi.mock("@/lib/collection-queries", () => ({
  getAdminFigure: h.getAdminFigure,
  getReferenceReviewNote: h.getReferenceReviewNote,
  getReferenceUpc: h.getReferenceUpc,
  listOwnedCopies: h.listOwnedCopies,
  listTakenSlugs: h.listTakenSlugs,
}));
// `server-only` throws outside a React Server Components build; the geocoder's entry point
// carries the marker precisely so nothing client-side can reach the network call under it.
vi.mock("server-only", () => ({}));
vi.mock("@/lib/geocode/queries", () => ({
  listKnownCityCoordinates: h.listKnownCityCoordinates,
}));

import {
  addDuplicateAction,
  createReferenceFigureAction,
  fixReferenceFigureAction,
  saveSightingAction,
} from "./actions";

const REF = "11111111-1111-4111-8111-111111111111";

/** The Phase 7 research fixture: a real Funko Spider-Man barcode, printed and stored form. */
const UPC_A = "889698636759";
const EAN_13 = "0889698636759";

/** A Nominatim jsonv2 answer, trimmed to the two fields the parser reads. */
function geocoded(lat: string, lon: string): Response {
  return { status: 200, json: async () => [{ lat, lon }] } as unknown as Response;
}

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.append(key, value);
  return data;
}

/** Every action ends in a redirect, so the assertion is always "where did it send him?". */
async function redirectedTo(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof h.RedirectError) return error.url;
    throw error;
  }
  throw new Error("the action returned without redirecting");
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  h.inserts.length = 0;
  h.updates.length = 0;
  h.state.nextId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  h.requireAdmin.mockResolvedValue({ sub: "admin", role: "admin" as const });
  h.listTakenSlugs.mockResolvedValue(new Set<string>());
  h.getReferenceUpc.mockResolvedValue(null);
  h.getReferenceReviewNote.mockResolvedValue({ reviewNote: null });
  h.listKnownCityCoordinates.mockResolvedValue([]);

  // Stubbed rather than left real: a test suite that can reach the internet is a test suite
  // that spends somebody else's rate limit, and every assertion below about "no call" would
  // otherwise be a silent request.
  fetchMock = vi.fn(async () => geocoded("3.1504726", "101.6941732"));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createReferenceFigureAction", () => {
  const valid = {
    name: "Spidey Prototype",
    popNumber: "9001",
    category: "peter",
    productLine: "Pop! Marvel",
    q: "spidey prototype",
  };

  it("writes a manual, review-flagged catalog row and moves to the details step", async () => {
    const url = await redirectedTo(createReferenceFigureAction(form(valid)));

    expect(h.requireAdmin).toHaveBeenCalledOnce();
    expect(h.inserts).toHaveLength(1);
    expect(h.inserts[0].values).toMatchObject({
      slug: "pop-marvel-spidey-prototype-9001",
      name: "Spidey Prototype",
      popNumber: 9001,
      category: "peter",
      productLine: "Pop! Marvel",
      countsTowardTotal: true,
      source: "manual",
      needsReview: true,
    });
    expect(url).toBe(`/admin/add?step=details&ref=${h.state.nextId}`);
  });

  it("never steals a slug an existing figure already holds", async () => {
    h.listTakenSlugs.mockResolvedValue(new Set(["pop-marvel-spidey-prototype-9001"]));

    await redirectedTo(createReferenceFigureAction(form(valid)));

    expect(h.inserts[0].values.slug).toBe("pop-marvel-spidey-prototype-9001-2");
  });

  it("bounces an invalid form back to the same step with the query intact", async () => {
    const url = await redirectedTo(
      createReferenceFigureAction(form({ name: "  ", category: "peter", q: "spidey" })),
    );

    expect(h.inserts).toHaveLength(0);
    expect(url).toBe("/admin/add?step=new&q=spidey&err=NAME_REQUIRED");
  });

  it("checks the session BEFORE it writes anything", async () => {
    h.requireAdmin.mockRejectedValue(new Error("NEXT_REDIRECT /login"));

    await expect(createReferenceFigureAction(form(valid))).rejects.toThrow("NEXT_REDIRECT");
    expect(h.inserts).toHaveLength(0);
  });

  it("gives an invented figure the barcode that found it, in the stored spelling", async () => {
    const url = await redirectedTo(createReferenceFigureAction(form({ ...valid, upc: UPC_A })));

    expect(h.inserts[0].values).toMatchObject({ upc: EAN_13, source: "scan", needsReview: true });
    // A row created a second ago cannot clash with itself — no read, no decision.
    expect(h.getReferenceUpc).not.toHaveBeenCalled();
    expect(url).toBe(`/admin/add?step=details&ref=${h.state.nextId}&upc=${EAN_13}`);
  });

  it("refuses to write a barcode that fails its own check digit", async () => {
    await redirectedTo(createReferenceFigureAction(form({ ...valid, upc: "889698636758" })));

    expect(h.inserts[0].values).toMatchObject({ upc: null, source: "manual" });
  });

  it("keeps the barcode on a rejected submit, so a scan is not lost to a typo", async () => {
    const url = await redirectedTo(
      createReferenceFigureAction(form({ name: " ", category: "peter", q: "x", upc: UPC_A })),
    );

    expect(url).toBe(`/admin/add?step=new&q=x&upc=${EAN_13}&err=NAME_REQUIRED`);
  });
});

describe("saveSightingAction", () => {
  const valid = {
    referenceFigureId: REF,
    status: "mine",
    acquiredAt: "2026-08-06",
    acquiredCity: "Moscow",
    acquiredCountry: "ru",
  };

  beforeEach(() => {
    h.getAdminFigure.mockResolvedValue({ id: REF, name: "Spider-Man" });
  });

  it("inserts the sighting and lands on the success screen", async () => {
    const url = await redirectedTo(
      saveSightingAction(form({ ...valid, story: "Bought it by the river.", intent: "save" })),
    );

    expect(h.requireAdmin).toHaveBeenCalledOnce();
    expect(h.inserts[0].values).toMatchObject({
      referenceFigureId: REF,
      status: "mine",
      acquiredAt: "2026-08-06",
      acquiredCity: "Moscow",
      acquiredCountry: "RU",
      story: "Bought it by the river.",
      needsStory: false,
    });
    expect(url).toBe(`/admin/add?step=done&id=${h.state.nextId}`);
  });

  it("SKIP FOR NOW saves the sighting and owes the story", async () => {
    await redirectedTo(saveSightingAction(form({ ...valid, story: "half", intent: "skip" })));

    expect(h.inserts[0].values).toMatchObject({ story: null, needsStory: true });
  });

  it("refuses a sighting whose figure has left the catalog", async () => {
    h.getAdminFigure.mockResolvedValue(null);

    const url = await redirectedTo(saveSightingAction(form(valid)));

    expect(h.inserts).toHaveLength(0);
    expect(url).toBe("/admin/add?err=FIGURE_GONE");
  });

  it("sends a malformed submit back to the details step with a code", async () => {
    const url = await redirectedTo(
      saveSightingAction(form({ ...valid, acquiredAt: "06/08/2026" })),
    );

    expect(h.inserts).toHaveLength(0);
    expect(url).toBe(`/admin/add?step=details&ref=${REF}&err=BAD_DATE`);
  });

  it("checks the session BEFORE it writes anything", async () => {
    h.requireAdmin.mockRejectedValue(new Error("NEXT_REDIRECT /login"));

    await expect(saveSightingAction(form(valid))).rejects.toThrow("NEXT_REDIRECT");
    expect(h.inserts).toHaveLength(0);
  });

  it("does not go near the catalog when the add did not come from a camera", async () => {
    await redirectedTo(saveSightingAction(form(valid)));

    expect(h.getReferenceUpc).not.toHaveBeenCalled();
    expect(h.updates).toHaveLength(0);
  });

  it("backfills the scanned barcode onto a catalog row that had none", async () => {
    await redirectedTo(saveSightingAction(form({ ...valid, upc: UPC_A })));

    expect(h.inserts).toHaveLength(1);
    expect(h.updates).toHaveLength(1);
    expect(h.updates[0].values).toMatchObject({ upc: EAN_13 });
    expect(h.updates[0].values.updatedAt).toBeInstanceOf(Date);
  });

  it("leaves the row alone when it already knows the code in the other spelling", async () => {
    h.getReferenceUpc.mockResolvedValue(UPC_A);

    await redirectedTo(saveSightingAction(form({ ...valid, upc: EAN_13 })));

    expect(h.updates).toHaveLength(0);
  });

  it("flags a clash instead of overwriting — exclusives share codes (ADR-006)", async () => {
    h.getReferenceUpc.mockResolvedValue("0889698636766");

    await redirectedTo(saveSightingAction(form({ ...valid, upc: UPC_A })));

    expect(h.updates).toHaveLength(1);
    expect(h.updates[0].values).toMatchObject({ needsReview: true });
    expect(h.updates[0].values.upc).toBeUndefined();
    expect(String(h.updates[0].values.reviewNote)).toContain("0889698636766");
    expect(String(h.updates[0].values.reviewNote)).toContain(EAN_13);
  });

  it("logs the sighting FIRST — the enrichment must never cost the entry", async () => {
    h.getReferenceUpc.mockRejectedValue(new Error("catalog read exploded"));

    await expect(saveSightingAction(form({ ...valid, upc: UPC_A }))).rejects.toThrow("exploded");
    expect(h.inserts).toHaveLength(1);
  });

  /* ------------------------------------------------ Phase 13: where the city IS (ADR-012) */

  const KL = { ...valid, acquiredCity: "Kuala Lumpur", acquiredCountry: "MY" };

  it("geocodes a city nothing has heard of, ONCE, and stores the rounded point", async () => {
    await redirectedTo(saveSightingAction(form(KL)));

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("nominatim.openstreetmap.org/search");
    expect(url).toContain("countrycodes=my");
    expect((init.headers as Record<string, string>)["User-Agent"]).toContain("spidey-shelf/");

    expect(h.inserts[0].values).toMatchObject({
      acquiredCity: "Kuala Lumpur",
      acquiredCountry: "MY",
      acquiredLat: "3.15",
      acquiredLng: "101.69",
    });
  });

  it("makes ZERO network calls for a city the dictionary already knows", async () => {
    await redirectedTo(saveSightingAction(form(valid)));

    expect(fetchMock).not.toHaveBeenCalled();
    // Moscow is in `geo.ts`, so its coordinate is copied rather than looked up.
    expect(h.inserts[0].values).toMatchObject({ acquiredLat: "55.756", acquiredLng: "37.617" });
  });

  it("makes ZERO network calls for a city a row on the shelf already knows", async () => {
    h.listKnownCityCoordinates.mockResolvedValue([
      { country: "MY", city: "KUALA LUMPUR", lat: "3.15", lng: "101.69" },
    ]);

    await redirectedTo(saveSightingAction(form(KL)));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(h.inserts[0].values).toMatchObject({ acquiredLat: "3.15", acquiredLng: "101.69" });
  });

  it("saves the sighting with NULL coordinates when the geocoder times out", async () => {
    fetchMock.mockRejectedValue(new DOMException("aborted", "TimeoutError"));

    const url = await redirectedTo(saveSightingAction(form(KL)));

    expect(h.inserts).toHaveLength(1);
    expect(h.inserts[0].values).toMatchObject({ acquiredLat: null, acquiredLng: null });
    expect(url).toBe(`/admin/add?step=done&id=${h.state.nextId}`);
  });

  it("saves the sighting with NULL coordinates when the lookup is rate-limited", async () => {
    fetchMock.mockResolvedValue({ status: 429, json: async () => ({}) } as unknown as Response);

    await redirectedTo(saveSightingAction(form(KL)));

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(h.inserts[0].values).toMatchObject({ acquiredLat: null, acquiredLng: null });
  });

  it("saves the sighting when the shelf read itself fails — a pin is never worth the entry", async () => {
    h.listKnownCityCoordinates.mockRejectedValue(new Error("connection reset"));

    await redirectedTo(saveSightingAction(form(KL)));

    expect(h.inserts).toHaveLength(1);
    expect(h.inserts[0].values).toMatchObject({ acquiredLat: null, acquiredLng: null });
  });

  it("never geocodes a sighting with no city", async () => {
    await redirectedTo(saveSightingAction(form({ ...valid, acquiredCity: "" })));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(h.inserts[0].values).toMatchObject({ acquiredLat: null, acquiredLng: null });
  });

  it("does not geocode a submit that never gets past validation", async () => {
    await redirectedTo(saveSightingAction(form({ ...KL, acquiredAt: "06/08/2026" })));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(h.inserts).toHaveLength(0);
  });

  it("does not geocode before the session is verified", async () => {
    h.requireAdmin.mockRejectedValue(new Error("NEXT_REDIRECT /login"));

    await expect(saveSightingAction(form(KL))).rejects.toThrow("NEXT_REDIRECT");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("addDuplicateAction", () => {
  it("bumps the quantity of the existing row instead of inserting a second sighting", async () => {
    h.listOwnedCopies.mockResolvedValue([
      { id: "owned-1", status: "mine", acquiredAt: "2025-04-12", quantity: 1, needsStory: false },
    ]);

    const url = await redirectedTo(addDuplicateAction(form({ referenceFigureId: REF })));

    expect(h.requireAdmin).toHaveBeenCalledOnce();
    expect(h.inserts).toHaveLength(0);
    expect(h.updates).toHaveLength(1);
    // An expression, not a computed constant: two adds in flight must not lose one.
    expect(typeof h.updates[0].values.quantity).toBe("object");
    expect(h.updates[0].values.updatedAt).toBeInstanceOf(Date);
    expect(url).toBe("/admin/add?step=done&id=owned-1&dup=1");
  });

  it("bumps the newest copy when there is more than one", async () => {
    h.listOwnedCopies.mockResolvedValue([
      { id: "old", status: "mine", acquiredAt: "2024-01-01", quantity: 1, needsStory: false },
      { id: "new", status: "mine", acquiredAt: "2026-01-05", quantity: 1, needsStory: false },
    ]);

    const url = await redirectedTo(addDuplicateAction(form({ referenceFigureId: REF })));

    expect(url).toContain("id=new");
  });

  it("refuses to bump a figure that only ever left the shelf", async () => {
    h.listOwnedCopies.mockResolvedValue([
      {
        id: "gone",
        status: "not_mine_anymore",
        acquiredAt: "2024-01-01",
        quantity: 1,
        needsStory: false,
      },
    ]);

    const url = await redirectedTo(addDuplicateAction(form({ referenceFigureId: REF })));

    expect(h.updates).toHaveLength(0);
    expect(url).toBe(`/admin/add?step=confirm&ref=${REF}&err=NOTHING_TO_BUMP`);
  });

  it("never lets a non-uuid reach Postgres", async () => {
    const url = await redirectedTo(addDuplicateAction(form({ referenceFigureId: "' or 1=1" })));

    expect(h.listOwnedCopies).not.toHaveBeenCalled();
    expect(url).toBe("/admin/add?err=PICK_FIGURE");
  });

  it("checks the session BEFORE it writes anything", async () => {
    h.requireAdmin.mockRejectedValue(new Error("NEXT_REDIRECT /login"));

    await expect(addDuplicateAction(form({ referenceFigureId: REF }))).rejects.toThrow(
      "NEXT_REDIRECT",
    );
    expect(h.updates).toHaveLength(0);
  });

  it("learns the barcode off the second box too", async () => {
    h.listOwnedCopies.mockResolvedValue([
      { id: "owned-1", status: "mine", acquiredAt: "2025-04-12", quantity: 1, needsStory: false },
    ]);

    await redirectedTo(addDuplicateAction(form({ referenceFigureId: REF, upc: UPC_A })));

    // Two writes: the quantity bump, then the catalog enrichment.
    expect(h.updates).toHaveLength(2);
    expect(h.updates[1].values).toMatchObject({ upc: EAN_13 });
  });
});

describe("fixReferenceFigureAction", () => {
  const valid = {
    referenceFigureId: REF,
    name: "Spider-Man (White Spider)",
    popNumber: "1450",
    category: "peter",
    productLine: "Pop! Marvel",
    q: "1450",
  };

  it("corrects the four facts on the box and comes back to the confirm step", async () => {
    const url = await redirectedTo(fixReferenceFigureAction(form(valid)));

    expect(h.requireAdmin).toHaveBeenCalledOnce();
    expect(h.inserts).toHaveLength(0);
    expect(h.updates).toHaveLength(1);
    expect(h.updates[0].values).toMatchObject({
      name: "Spider-Man (White Spider)",
      popNumber: 1450,
      category: "peter",
      productLine: "Pop! Marvel",
      countsTowardTotal: true,
      needsReview: false,
    });
    expect(h.updates[0].values.updatedAt).toBeInstanceOf(Date);
    expect(url).toBe(`/admin/add?step=confirm&ref=${REF}&q=1450`);
  });

  it("never touches the slug — it is the natural key, and share links point at it", () => {
    // Asserted on the SET clause rather than on a redirect, because the failure mode is
    // silent: a regenerated slug 404s every URL a friend was ever sent.
    return redirectedTo(fixReferenceFigureAction(form({ ...valid, name: "Something Else" }))).then(
      () => {
        expect(h.updates[0].values.slug).toBeUndefined();
        expect(h.updates[0].values.upc).toBeUndefined();
        expect(h.updates[0].values.source).toBeUndefined();
      },
    );
  });

  it("clears the review flag and says who decided, dated", async () => {
    await redirectedTo(fixReferenceFigureAction(form(valid)));

    const today = new Date().toISOString().slice(0, 10);
    expect(h.updates[0].values.needsReview).toBe(false);
    expect(String(h.updates[0].values.reviewNote)).toBe(`manually corrected by owner ${today}`);
  });

  it("appends to a note that is already there — a UPC clash must survive the fix", async () => {
    h.getReferenceReviewNote.mockResolvedValue({
      reviewNote: "upc clash: kept 0889698636759, scanned 0889698636766",
    });

    await redirectedTo(fixReferenceFigureAction(form(valid)));

    const note = String(h.updates[0].values.reviewNote);
    expect(note).toContain("0889698636766");
    expect(note).toContain("manually corrected by owner");
  });

  it("moves the denominator when the category moves (ADR-009)", async () => {
    await redirectedTo(fixReferenceFigureAction(form({ ...valid, category: "spider_verse" })));

    expect(h.updates[0].values).toMatchObject({
      category: "spider_verse",
      countsTowardTotal: false,
    });
  });

  it("carries the barcode context through the correction and back", async () => {
    const url = await redirectedTo(
      fixReferenceFigureAction(form({ ...valid, upc: UPC_A, via: "barcode" })),
    );

    expect(url).toBe(`/admin/add?step=confirm&ref=${REF}&q=1450&upc=${EAN_13}&via=barcode`);
  });

  it("bounces an invalid form back to the fix step, context intact", async () => {
    const url = await redirectedTo(
      fixReferenceFigureAction(form({ ...valid, name: "  ", popNumber: "x", upc: UPC_A })),
    );

    expect(h.updates).toHaveLength(0);
    expect(url).toBe(
      `/admin/add?step=fix&ref=${REF}&q=1450&upc=${EAN_13}&err=NAME_REQUIRED%2CBAD_NUMBER`,
    );
  });

  it("refuses a row that has left the catalog rather than updating nothing quietly", async () => {
    h.getReferenceReviewNote.mockResolvedValue(null);

    const url = await redirectedTo(fixReferenceFigureAction(form(valid)));

    expect(h.updates).toHaveLength(0);
    expect(url).toBe("/admin/add?err=FIGURE_GONE");
  });

  it("never lets a non-uuid reach Postgres", async () => {
    const url = await redirectedTo(
      fixReferenceFigureAction(form({ ...valid, referenceFigureId: "' or 1=1" })),
    );

    expect(h.getReferenceReviewNote).not.toHaveBeenCalled();
    expect(h.updates).toHaveLength(0);
    expect(url).toBe("/admin/add?err=PICK_FIGURE");
  });

  it("checks the session BEFORE it writes anything", async () => {
    h.requireAdmin.mockRejectedValue(new Error("NEXT_REDIRECT /login"));

    await expect(fixReferenceFigureAction(form(valid))).rejects.toThrow("NEXT_REDIRECT");
    expect(h.updates).toHaveLength(0);
  });
});
