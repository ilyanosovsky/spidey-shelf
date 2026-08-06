import type { Metadata } from "next";

import { SearchScreen } from "@/components/search-screen";
import { searchCatalog } from "@/lib/catalog-queries";
import { parseSearchQuery, searchQueryValue } from "@/lib/search";

/**
 * The gift check — the reason this site exists.
 *
 * `force-dynamic` is REQUIRED, not a preference: without it `next build` prerenders the page
 * and queries Railway at build time, which CI (no DATABASE_URL) cannot do. See
 * docs/wiki/Architecture.md.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "GIFT CHECK — SPIDEY SHELF",
  description:
    "Type a Pop number or a name and find out whether Ilya already owns that Spider-Man figure.",
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const { q } = await searchParams;
  const parsed = parseSearchQuery(q);
  const results = await searchCatalog(parsed);

  return <SearchScreen query={searchQueryValue(q)} parsed={parsed} results={results} />;
}
