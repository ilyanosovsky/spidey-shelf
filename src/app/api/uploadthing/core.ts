import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError, UTApi } from "uploadthing/server";

import {
  BOX_ART_COPY,
  BOX_ART_MAX_FILE_SIZE,
  parseBoxArtInput,
  replacedFileKey,
  type BoxArtInput,
} from "@/lib/box-art";
import { getBoxArtTarget, setBoxArtImagePath } from "@/lib/box-art-queries";
import { verifySessionFromCookieHeader } from "@/lib/session";

/**
 * The one upload this site has: the owner replacing a figure's box art (ADR-011).
 *
 * There is exactly one route and exactly one person allowed to use it, and both of those
 * facts are enforced here rather than upstream. `src/proxy.ts` does not cover `/api/*`, and
 * CVE-2025-29927 is the reason a proxy check would not count even if it did — so the session
 * is re-verified **inside** `.middleware()`, which is the last thing that runs before
 * UploadThing hands out a presigned URL. Refusing there means no storage is ever allocated
 * to an anonymous request.
 *
 * The file itself is already an 800×800 WebP by the time it gets here: the browser normalizes
 * it (`src/lib/box-art-canvas.ts`) so the uniform-look promise from ADR-004 survives the
 * switch from a curated pipeline to a human with a phone. The route's limits are the
 * backstop, not the plan.
 */

const f = createUploadthing();

/**
 * `.input()` wants a parser, not a schema library.
 *
 * The phantom `_input` / `_output` fields are how UploadThing infers the input type from a
 * zod-shaped object (`ParserZodEsque`); only `parseAsync` has a runtime job. Writing the
 * fifteen lines rather than adding zod for one uuid keeps the dependency list honest — and
 * the parser itself is pure and unit-tested in `src/lib/box-art.ts`.
 */
const boxArtInputParser = {
  _input: undefined as unknown as BoxArtInput,
  _output: undefined as unknown as BoxArtInput,
  parseAsync: async (value: unknown): Promise<BoxArtInput> => parseBoxArtInput(value),
};

/**
 * Deleting the file a replacement supersedes.
 *
 * Constructed per call rather than at module scope: `new UTApi()` reads `UPLOADTHING_TOKEN`,
 * and a build with no env (CI, and the no-env build gate) must not explode at import time —
 * the same lesson `src/db/index.ts` already learned about `DATABASE_URL`.
 *
 * Failure is logged and swallowed. The upload has already succeeded and the catalog row
 * already points at the new file; turning "the old file is still there" into a failed upload
 * would trade a stale 150 KB for the owner's actual work.
 */
async function deleteReplacedFile(previousImagePath: string | null, newKey: string) {
  const key = replacedFileKey(previousImagePath, newKey);
  if (!key) return;

  try {
    await new UTApi().deleteFiles(key);
  } catch (error) {
    console.error("[boxArt] could not delete the replaced file", { key, error });
  }
}

export const boxArtFileRouter = {
  boxArt: f({
    image: {
      maxFileSize: BOX_ART_MAX_FILE_SIZE,
      maxFileCount: 1,
      minFileCount: 1,
    },
  })
    .input(boxArtInputParser)
    .middleware(async ({ req, input }) => {
      // The real gate. Read off the request's own `Cookie` header rather than through
      // `next/headers`, because this runs inside UploadThing's async runtime.
      const session = await verifySessionFromCookieHeader(req.headers.get("cookie"));
      if (!session) {
        throw new UploadThingError({ code: "FORBIDDEN", message: BOX_ART_COPY.notAdmin });
      }

      // Resolve the target before a byte is uploaded: a file stored against an id that does
      // not exist is 150 KB of the 2 GB free tier that nothing will ever point at or delete.
      const figure = await getBoxArtTarget(input.referenceFigureId);
      if (!figure) {
        throw new UploadThingError({ code: "NOT_FOUND", message: BOX_ART_COPY.unknownFigure });
      }

      // Only what `onUploadComplete` needs. The metadata round-trips through UploadThing's
      // servers, so it carries ids and a slug and nothing about the session.
      return {
        referenceFigureId: figure.id,
        slug: figure.slug,
        previousImagePath: figure.imagePath,
      };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      // `ufsUrl` and not `url`: `url`/`appUrl` are deprecated in v7 and go away in v9.
      await setBoxArtImagePath(metadata.referenceFigureId, file.ufsUrl);
      await deleteReplacedFile(metadata.previousImagePath, file.key);

      // Returned to the browser's `onClientUploadComplete`, which uses it to paint the new
      // art immediately instead of waiting for the router refresh behind it.
      return { imagePath: file.ufsUrl, slug: metadata.slug };
    }),
} satisfies FileRouter;

export type BoxArtFileRouter = typeof boxArtFileRouter;
