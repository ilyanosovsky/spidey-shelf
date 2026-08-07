import type { MetadataRoute } from "next";

import { listPublicShelf } from "@/lib/showcase-queries";
import { absoluteUrl } from "@/lib/site";

/**
 * `/sitemap.xml` — the four public screens plus one entry per figure on the shelf.
 *
 * **`force-dynamic` is REQUIRED, exactly as it is on every DB-reading page.** Without it Next
 * evaluates this function while collecting page data during `next build`, which would query
 * Railway from CI — where there is no `DATABASE_URL` — and fail the build. That constraint is
 * older than this file (docs/wiki/Architecture.md) and the no-env build is a gate on every PR;
 * the sitemap of a nineteen-figure shelf has nothing to gain from being prerendered anyway.
 *
 * The `try` is the belt to that braces. A sitemap is the least important thing this app
 * serves, and there is no version of "Railway is asleep" that should be answered with a 500
 * to Googlebot: a failed query degrades to the four static screens, which are the pages worth
 * indexing most. It is also what makes the file safe if a future Next ever decides to
 * evaluate it eagerly regardless of the segment config.
 *
 * Only figures with a public shelf row are listed, because `/figure/<slug>` 404s for anything
 * else — the catalog's other 228 rows have no page to point at (Phase 4). Wishlist figures
 * are reachable through `/search?q=<number>`, which is a query string and not a document.
 */
export const dynamic = "force-dynamic";

/** `lastModified` for the static screens: they change when the shelf does. */
function today(): Date {
  return new Date();
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const screens: MetadataRoute.Sitemap = [
    { url: absoluteUrl("/"), lastModified: today(), changeFrequency: "weekly", priority: 1 },
    {
      url: absoluteUrl("/search"),
      lastModified: today(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: absoluteUrl("/wishlist"),
      lastModified: today(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    { url: absoluteUrl("/stats"), lastModified: today(), changeFrequency: "weekly", priority: 0.6 },
  ];

  try {
    const shelf = await listPublicShelf();
    return [
      ...screens,
      ...shelf.map((entry) => ({
        url: absoluteUrl(`/figure/${entry.slug}`),
        // The sighting's own date is the honest answer to "when did this page last change".
        lastModified: entry.acquiredAt ? new Date(entry.acquiredAt) : today(),
        changeFrequency: "monthly" as const,
        priority: 0.7,
      })),
    ];
  } catch {
    return screens;
  }
}
