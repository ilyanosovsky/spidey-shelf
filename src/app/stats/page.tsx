import type { Metadata } from "next";

import { StatsScreen } from "@/components/stats-screen";
import { getCatalogProgress } from "@/lib/catalog-queries";
import { isAdminSession } from "@/lib/dal";
import { listPublicShelf } from "@/lib/showcase-queries";
import { normalizeCategoryProgress } from "@/lib/stats";

/**
 * The collector's dashboard: counters, the web radar, the years and the flags.
 *
 * `force-dynamic` is REQUIRED: without it `next build` prerenders and queries Railway at
 * build time, which CI (no DATABASE_URL) cannot do. See docs/wiki/Architecture.md.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "VAULT STATUS — SPIDEY SHELF",
  description:
    "How far through the Spider-Man catalog the collection is, when each figure arrived, and where it was found.",
};

export default async function StatsPage() {
  const [progress, entries, isAdmin] = await Promise.all([
    getCatalogProgress(),
    listPublicShelf(),
    isAdminSession(),
  ]);

  return (
    <StatsScreen
      progress={normalizeCategoryProgress(progress)}
      entries={entries}
      isAdmin={isAdmin}
    />
  );
}
