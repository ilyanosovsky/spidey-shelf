import type { Metadata } from "next";

import { WishlistScreen } from "@/components/wishlist-screen";
import { listWishlist } from "@/lib/catalog-queries";
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
  const figures = await listWishlist();

  return <WishlistScreen figures={figures} filter={filter} />;
}
