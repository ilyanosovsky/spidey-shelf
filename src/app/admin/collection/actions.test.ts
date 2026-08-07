// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The collection edit write, with the session, the database and `fetch` mocked out.
 *
 * The same two rules the Quick Add actions are held to — `requireAdmin()` before anything is
 * touched (CLAUDE.md, ADR-005), and the exact SET clause — plus the one this screen owns:
 * **it is the retry.** A sighting the geocoder could not place lands with NULL coordinates
 * (ADR-012), and saving the edit form is what tries again, for free, because a failed lookup
 * wrote nothing down. Editing a figure whose city is already placeable must reach nobody.
 */

const h = vi.hoisted(() => {
  class RedirectError extends Error {
    url: string;
    constructor(url: string) {
      super(`REDIRECT ${url}`);
      this.url = url;
    }
  }

  const updates: { values: Record<string, unknown> }[] = [];
  const state = { updated: [{ id: "owned-1" }] as { id: string }[] };

  return {
    RedirectError,
    updates,
    state,
    requireAdmin: vi.fn(async () => ({ sub: "admin", role: "admin" as const })),
    revalidatePath: vi.fn(),
    redirect: vi.fn((url: string) => {
      throw new RedirectError(url);
    }),
    findDuplicateOwnedFigure: vi.fn(async (): Promise<string | null> => null),
    listKnownCityCoordinates: vi.fn(
      async (): Promise<
        { country: string | null; city: string | null; lat: string | null; lng: string | null }[]
      > => [],
    ),
    db: {
      update: () => ({
        set: (values: Record<string, unknown>) => ({
          where: () => ({
            returning: async () => {
              updates.push({ values });
              return state.updated;
            },
          }),
        }),
      }),
      delete: () => ({ where: async () => [] }),
    },
  };
});

vi.mock("next/cache", () => ({ revalidatePath: h.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: h.redirect }));
vi.mock("@/db", () => ({ db: h.db }));
vi.mock("@/lib/dal", () => ({ requireAdmin: h.requireAdmin }));
vi.mock("@/lib/collection-queries", () => ({
  findDuplicateOwnedFigure: h.findDuplicateOwnedFigure,
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/geocode/queries", () => ({
  listKnownCityCoordinates: h.listKnownCityCoordinates,
}));

import { updateOwnedFigureAction } from "./actions";

const ID = "22222222-2222-4222-8222-222222222222";
const REF = "11111111-1111-4111-8111-111111111111";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.append(key, value);
  return data;
}

/** A successful save ends in a redirect; a rejected one returns errors. */
async function redirectedTo(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof h.RedirectError) return error.url;
    throw error;
  }
  throw new Error("the action returned without redirecting");
}

const HAIFA = {
  referenceFigureId: REF,
  status: "mine",
  acquiredAt: "2026-08-06",
  acquiredCity: "Haifa",
  acquiredCountry: "Israel (IL)",
  isPublic: "on",
};

const KUALA_LUMPUR = { ...HAIFA, acquiredCity: "Kuala Lumpur", acquiredCountry: "Malaysia (MY)" };

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  h.updates.length = 0;
  h.state.updated = [{ id: "owned-1" }];
  h.requireAdmin.mockResolvedValue({ sub: "admin", role: "admin" as const });
  h.findDuplicateOwnedFigure.mockResolvedValue(null);
  h.listKnownCityCoordinates.mockResolvedValue([]);

  fetchMock = vi.fn(
    async () =>
      ({
        status: 200,
        json: async () => [{ lat: "3.1504726", lon: "101.6941732" }],
      }) as unknown as Response,
  );
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("updateOwnedFigureAction", () => {
  it("writes the form and lands back on the vault list", async () => {
    const url = await redirectedTo(updateOwnedFigureAction(ID, { errors: [] }, form(HAIFA)));

    expect(h.requireAdmin).toHaveBeenCalledOnce();
    expect(h.updates).toHaveLength(1);
    expect(h.updates[0].values).toMatchObject({
      referenceFigureId: REF,
      status: "mine",
      acquiredAt: "2026-08-06",
      acquiredCity: "Haifa",
      acquiredCountry: "IL",
      isPublic: true,
      needsStory: true,
    });
    expect(url).toBe("/admin/collection");
  });

  it("checks the session BEFORE it writes anything", async () => {
    h.requireAdmin.mockRejectedValue(new Error("NEXT_REDIRECT /login"));

    await expect(updateOwnedFigureAction(ID, { errors: [] }, form(HAIFA))).rejects.toThrow(
      "NEXT_REDIRECT",
    );
    expect(h.updates).toHaveLength(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns errors instead of writing when the form is invalid", async () => {
    const state = await updateOwnedFigureAction(
      ID,
      { errors: [] },
      form({ ...HAIFA, acquiredCountry: "Wakanda" }),
    );

    expect(state.errors).toEqual(["PICK A COUNTRY FROM THE LIST"]);
    expect(h.updates).toHaveLength(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses a save that would duplicate another entry, and geocodes nothing", async () => {
    h.findDuplicateOwnedFigure.mockResolvedValue("owned-9");

    const state = await updateOwnedFigureAction(ID, { errors: [] }, form(KUALA_LUMPUR));

    expect(state.errors).toEqual(["ANOTHER ENTRY ALREADY HOLDS THAT FIGURE ON THAT DAY"]);
    expect(h.updates).toHaveLength(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("says so when the row has left the vault", async () => {
    h.state.updated = [];

    const state = await updateOwnedFigureAction(ID, { errors: [] }, form(HAIFA));
    expect(state.errors).toEqual(["THAT ENTRY IS GONE FROM THE VAULT"]);
  });

  /* -------------------------------------------------------- Phase 13: the retry (ADR-012) */

  it("geocodes a city nothing has heard of and writes the point with the row", async () => {
    await redirectedTo(updateOwnedFigureAction(ID, { errors: [] }, form(KUALA_LUMPUR)));

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(h.updates[0].values).toMatchObject({
      acquiredCity: "Kuala Lumpur",
      acquiredCountry: "MY",
      acquiredLat: "3.15",
      acquiredLng: "101.69",
    });
    expect(h.updates[0].values.updatedAt).toBeInstanceOf(Date);
  });

  it("re-saving a dictionary city reaches nothing but the database", async () => {
    await redirectedTo(updateOwnedFigureAction(ID, { errors: [] }, form(HAIFA)));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(h.updates[0].values).toMatchObject({ acquiredLat: "32.794", acquiredLng: "34.99" });
  });

  it("re-saving a city another row already knows reaches nothing either", async () => {
    h.listKnownCityCoordinates.mockResolvedValue([
      { country: "my", city: "kuala lumpur", lat: "3.15", lng: "101.69" },
    ]);

    await redirectedTo(updateOwnedFigureAction(ID, { errors: [] }, form(KUALA_LUMPUR)));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(h.updates[0].values).toMatchObject({ acquiredLat: "3.15", acquiredLng: "101.69" });
  });

  it("clears the coordinates when the city is corrected to one nobody can place", async () => {
    // The stale-pin case: a wrong city that HAD a coordinate must not keep it after the fix.
    fetchMock.mockResolvedValue({ status: 200, json: async () => [] } as unknown as Response);

    await redirectedTo(
      updateOwnedFigureAction(
        ID,
        { errors: [] },
        form({ ...HAIFA, acquiredCity: "Nowheresville", acquiredCountry: "Portugal (PT)" }),
      ),
    );

    expect(h.updates[0].values).toMatchObject({ acquiredLat: null, acquiredLng: null });
  });

  it("saves the edit even when the geocoder is down", async () => {
    fetchMock.mockRejectedValue(new Error("ENOTFOUND"));

    const url = await redirectedTo(updateOwnedFigureAction(ID, { errors: [] }, form(KUALA_LUMPUR)));

    expect(h.updates).toHaveLength(1);
    expect(h.updates[0].values).toMatchObject({ acquiredLat: null, acquiredLng: null });
    expect(url).toBe("/admin/collection");
  });
});
