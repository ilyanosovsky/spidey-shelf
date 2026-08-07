import type { NextRequest } from "next/server";
import { createRouteHandler } from "uploadthing/next";

import { isSameOrigin } from "@/lib/box-art";

import { boxArtFileRouter } from "./core";

/**
 * The upload endpoint. Two callers, and they are not the same kind of caller:
 *
 *   1. **the owner's browser** — `POST …?actionType=upload&slug=boxArt`, asking for presigned
 *      URLs. Authenticated by the session cookie, inside the router's middleware.
 *   2. **UploadThing's ingest server** — `POST …?slug=boxArt` with a `uploadthing-hook:
 *      callback` header, telling us an upload finished so `onUploadComplete` can run.
 *      Authenticated by an HMAC signature the SDK verifies (`x-uploadthing-signature`).
 *
 * That difference is why the CSRF check below is conditional. This is a Route Handler, so the
 * Next.js data-security guidance applies and the SDK does not check `Origin` itself — but a
 * blanket check would reject the server-to-server callback (machines send no `Origin`), and
 * `onUploadComplete` is where `image_path` is actually written. So: browser actions must be
 * same-origin; the signed callback is left to its signature.
 *
 * `GET` returns the router's public config (permitted MIME types and the size cap) and is
 * what the client hook reads before it uploads. Nothing in it is a secret and nothing it does
 * changes state, so it is not gated.
 */

const handlers = createRouteHandler({ router: boxArtFileRouter });

export const GET = handlers.GET;

export async function POST(request: NextRequest): Promise<Response> {
  const isServerCallback = request.headers.has("uploadthing-hook");

  if (
    !isServerCallback &&
    !isSameOrigin(request.headers.get("origin"), request.headers.get("host"))
  ) {
    return Response.json(
      { error: "Cross-origin upload requests are not accepted." },
      { status: 403 },
    );
  }

  return handlers.POST(request);
}
