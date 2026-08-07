import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { geocodeCity } from "./lookup";
import { NOMINATIM_USER_AGENT } from "./nominatim";

/**
 * The one socket, with `fetch` mocked.
 *
 * What is being checked is mostly the OSM Foundation's usage policy
 * (<https://operations.osmfoundation.org/policies/nominatim/>) turned into assertions: one
 * request, an identifying User-Agent, an abort signal, no cache, and no exception on the way
 * out — a server action is holding a sighting open behind this call.
 */

const OK = (body: unknown) => ({ status: 200, json: async () => body }) as unknown as Response;

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn(async () => OK([{ lat: "3.1504726", lon: "101.6941732" }]));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("geocodeCity", () => {
  it("makes exactly one request and returns the rounded point", async () => {
    await expect(geocodeCity("MY", "Kuala Lumpur")).resolves.toEqual({ lat: 3.15, lng: 101.69 });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("sends the identifying User-Agent the policy requires", async () => {
    await geocodeCity("MY", "Kuala Lumpur");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("nominatim.openstreetmap.org/search");
    expect((init.headers as Record<string, string>)["User-Agent"]).toBe(NOMINATIM_USER_AGENT);
  });

  it("carries a timeout signal and never caches the answer", async () => {
    await geocodeCity("MY", "Kuala Lumpur");

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(init.cache).toBe("no-store");
  });

  it("does not open a socket at all when there is nothing to ask", async () => {
    await expect(geocodeCity("MY", "  ")).resolves.toBeNull();
    await expect(geocodeCity("", "Kuala Lumpur")).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("answers null on a rate limit — and does NOT try again", async () => {
    fetchMock.mockResolvedValue({ status: 429, json: async () => ({}) } as unknown as Response);

    await expect(geocodeCity("PT", "Lisbon")).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("answers null when the body is an HTML error page rather than JSON", async () => {
    fetchMock.mockResolvedValue({
      status: 200,
      json: async () => {
        throw new SyntaxError("Unexpected token <");
      },
    } as unknown as Response);

    await expect(geocodeCity("PT", "Lisbon")).resolves.toBeNull();
  });

  it("answers null when the request itself explodes — a timeout must not reject", async () => {
    fetchMock.mockRejectedValue(new DOMException("The operation was aborted.", "TimeoutError"));

    await expect(geocodeCity("PT", "Lisbon")).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("answers null for a town OpenStreetMap has never heard of", async () => {
    fetchMock.mockResolvedValue(OK([]));

    await expect(geocodeCity("PT", "Nowheresville")).resolves.toBeNull();
  });
});
