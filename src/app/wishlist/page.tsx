import type { Metadata } from "next";

import { WishlistScreen } from "@/components/wishlist-screen";
import { listWishlist } from "@/lib/catalog-queries";
import { listPriceChips } from "@/lib/ebay/market";
import { parseWishlistFilter } from "@/lib/wishlist";

/**
 * Everything still out there — the catalog rows nobody owns.
 *
 * `force-dynamic` is REQUIRED: without it `next build` prerenders and queries Railway at
 * build time, which CI (no DATABASE_URL) cannot do. See docs/wiki/Architecture.md.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "WISHLIST — SPIDEY SHELF",
  description: "Spider-Man Pops that are not on Ilya's shelf yet — gift ideas, with a link each.",
};

export default async function WishlistPage({
  searchParams,
}: {
  searchParams: Promise<{ cat?: string | string[] }>;
}) {
  const { cat } = await searchParams;
  const filter = parseWishlistFilter(cat);
  // `listPriceChips()` is a cache read and can never trigger an eBay call — 232 cards is the
  // exact page that would burn the free tier. Without keys it returns an empty map without
  // querying at all, so this costs nothing on the current deployment.
  const [figures, prices] = await Promise.all([listWishlist(), listPriceChips()]);

  return <WishlistScreen figures={figures} filter={filter} prices={prices} />;
}
