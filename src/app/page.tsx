import { ShelfScreen } from "@/components/shelf-screen";
import { isAdminSession } from "@/lib/dal";
import { listPriceChips } from "@/lib/ebay/market";
import { getShelfProgress, listPublicShelf } from "@/lib/showcase-queries";
import { parseShelfFilter } from "@/lib/showcase";

/**
 * The public shelf.
 *
 * `force-dynamic` is REQUIRED, not a preference: without it `next build` prerenders this
 * page, which means querying Railway at build time — and CI has no DATABASE_URL, so the
 * build fails (it already did once). Caching is not worth it yet either; this is a
 * friends-scale site, the shelf is ~20 rows, and the owner expects an edit in the admin to
 * show up on the next reload. See docs/wiki/Architecture.md.
 */
export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ cat?: string | string[] }>;
}) {
  const { cat } = await searchParams;
  const filter = parseShelfFilter(cat);

  // `isAdminSession()` is the nav's CONSOLE tab and nothing else — a verified signature,
  // deduped by React `cache()` with any other session read on this request.
  //
  // `listPriceChips()` is a cache read that **cannot** cause an eBay call (Phase 11): the
  // nightly cron at `/api/cron/refresh-prices` is what fills `price_snapshots`, and this
  // page spends it. Without keys it returns an empty map without querying at all.
  const [entries, progress, prices, isAdmin] = await Promise.all([
    listPublicShelf(),
    getShelfProgress(),
    listPriceChips(),
    isAdminSession(),
  ]);

  return (
    <ShelfScreen
      entries={entries}
      progress={progress}
      filter={filter}
      prices={prices}
      isAdmin={isAdmin}
    />
  );
}
