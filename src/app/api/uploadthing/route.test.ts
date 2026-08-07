// @vitest-environment node
// The route handler deals in web `Request`/`Response`; jsdom's copies are not the ones Next
// hands it, and the header casing differs.

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { NextRequest } from "next/server";

/**
 * The CSRF half of the upload endpoint (the auth half is the router's middleware, tested by
 * `verifySessionFromCookieHeader` and exercised live against the dev server).
 *
 * Two callers, two rules, and getting the second one wrong is the expensive mistake: a
 * blanket `Origin` check looks correct, passes every browser test, and silently breaks
 * `onUploadComplete` in production — because the request that carries it comes from
 * UploadThing's servers, which send no `Origin` at all. Then uploads succeed, files are
 * stored, and `image_path` is never written.
 */

const innerPost = vi.fn(async () => Response.json({ ok: true }));
const innerGet = vi.fn(async () => Response.json({ config: true }));

vi.mock("uploadthing/next", () => ({
  createRouteHandler: () => ({ POST: innerPost, GET: innerGet }),
}));

// The real router pulls in the database and the token; neither is this file's subject.
vi.mock("./core", () => ({ boxArtFileRouter: {} }));

const { POST } = await import("./route");

function request(headers: Record<string, string>): NextRequest {
  return new Request("https://spidey.example.com/api/uploadthing?actionType=upload&slug=boxArt", {
    method: "POST",
    headers,
  }) as unknown as NextRequest;
}

beforeEach(() => {
  innerPost.mockClear();
});

describe("POST /api/uploadthing", () => {
  it("lets our own page through to the router", async () => {
    const response = await POST(
      request({ origin: "https://spidey.example.com", host: "spidey.example.com" }),
    );

    expect(response.status).toBe(200);
    expect(innerPost).toHaveBeenCalledTimes(1);
  });

  it("refuses a cross-origin POST with JSON, not a redirect", async () => {
    const response = await POST(
      request({ origin: "https://evil.example.com", host: "spidey.example.com" }),
    );

    expect(response.status).toBe(403);
    expect(response.headers.get("content-type")).toContain("application/json");
    await expect(response.json()).resolves.toHaveProperty("error");
    expect(innerPost).not.toHaveBeenCalled();
  });

  it("refuses a POST with no Origin — nothing that is not a browser calls this action", async () => {
    const response = await POST(request({ host: "spidey.example.com" }));

    expect(response.status).toBe(403);
    expect(innerPost).not.toHaveBeenCalled();
  });

  it("lets UploadThing's signed callback through, which has no Origin by design", async () => {
    const response = await POST(
      request({ host: "spidey.example.com", "uploadthing-hook": "callback" }),
    );

    expect(response.status).toBe(200);
    expect(innerPost).toHaveBeenCalledTimes(1);
  });
});
