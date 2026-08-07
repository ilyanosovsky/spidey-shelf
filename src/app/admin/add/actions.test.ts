// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

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
    requireAdmin: vi.fn(async () => ({ sub: "admin", role: "admin" as const })),
    revalidatePath: vi.fn(),
    redirect: vi.fn((url: string) => {
      throw new RedirectError(url);
    }),
    getAdminFigure: vi.fn(),
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
  getReferenceUpc: h.getReferenceUpc,
  listOwnedCopies: h.listOwnedCopies,
  listTakenSlugs: h.listTakenSlugs,
}));

import { addDuplicateAction, createReferenceFigureAction, saveSightingAction } from "./actions";

const REF = "11111111-1111-4111-8111-111111111111";

/** The Phase 7 research fixture: a real Funko Spider-Man barcode, printed and stored form. */
const UPC_A = "889698636759";
const EAN_13 = "0889698636759";

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

beforeEach(() => {
  vi.clearAllMocks();
  h.inserts.length = 0;
  h.updates.length = 0;
  h.state.nextId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  h.requireAdmin.mockResolvedValue({ sub: "admin", role: "admin" as const });
  h.listTakenSlugs.mockResolvedValue(new Set<string>());
  h.getReferenceUpc.mockResolvedValue(null);
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
