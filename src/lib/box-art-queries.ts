import "server-only";

import { eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { referenceFigures } from "@/db/schema";

/**
 * The two writes and one read behind an owner-uploaded box art (ADR-011).
 *
 * Same rule as every other `*-queries.ts` file here: this fetches and writes, it does not
 * decide. The authorization is the file router's middleware
 * (`src/app/api/uploadthing/core.ts`), the URL parsing is `src/lib/box-art.ts`.
 */

export interface BoxArtTarget {
  id: string;
  slug: string;
  name: string;
  /** Whatever is stored today — an UploadThing URL, or NULL for a figure with no art yet. */
  imagePath: string | null;
}

/**
 * The catalog row an upload is aimed at, or `null`.
 *
 * Read *before* the file leaves the browser (from the router's middleware), so an upload
 * against a deleted or invented id is refused rather than stored and then orphaned. The 2 GB
 * free tier has no room for files nothing points at.
 */
export async function getBoxArtTarget(id: string): Promise<BoxArtTarget | null> {
  const [figure] = await db
    .select({
      id: referenceFigures.id,
      slug: referenceFigures.slug,
      name: referenceFigures.name,
      imagePath: referenceFigures.imagePath,
    })
    .from(referenceFigures)
    .where(eq(referenceFigures.id, id))
    .limit(1);

  return figure ?? null;
}

/**
 * Point a catalog row at its new box art.
 *
 * `updated_at` is bumped with `now()` as a SQL expression rather than a JS `new Date()`: the
 * timestamp should be the database's clock, the same rule every other write in this project
 * follows.
 *
 * The caller writes this **before** deleting the file it replaces. That order is the whole
 * safety story: a crash between the two leaves one orphaned file in a 2 GB bucket, while the
 * other order leaves a figure pointing at a URL that 404s.
 */
export async function setBoxArtImagePath(id: string, imagePath: string): Promise<void> {
  await db
    .update(referenceFigures)
    .set({ imagePath, updatedAt: sql`now()` })
    .where(eq(referenceFigures.id, id));
}
