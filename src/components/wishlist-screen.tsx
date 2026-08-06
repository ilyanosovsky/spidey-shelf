import Link from "next/link";

import { type ShelfFilter } from "@/lib/showcase";
import { type PublicCatalogFigure } from "@/lib/search";
import {
  filterWishlist,
  orderWishlist,
  wantedHeadline,
  wishlistHref,
  wishlistTabs,
} from "@/lib/wishlist";

import { PIXEL_BUTTON_VARIANTS } from "./pixel-button";
import { PixelFrame } from "./pixel-frame";
import { PublicNav } from "./public-nav";
import { ToothedBanner } from "./toothed-banner";
import { WantedCard } from "./wanted-card";

/**
 * Everything still out there, for whoever asked what to get him.
 *
 * The same `?cat=` tab pattern as the home grid, with one deliberate difference: the default
 * tab is PETER PARKER rather than ALL, because that bucket is what the counters are about
 * and what he is actually hunting. Each tab carries its own count, so "how much is left"
 * is answered before a tap.
 */
export function WishlistScreen({
  figures,
  filter,
}: {
  figures: readonly PublicCatalogFigure[];
  filter: ShelfFilter;
}) {
  const visible = orderWishlist(filterWishlist(figures, filter));
  const tabs = wishlistTabs(figures);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col gap-5 p-4 sm:p-6">
      <PublicNav pathname="/wishlist" />

      <header>
        <ToothedBanner as="h1">{wantedHeadline(figures)}</ToothedBanner>
        <p className="mt-4 text-sm text-cream/70">
          Every figure in the catalog that is not on the shelf yet. Tap one to get the link that
          answers &ldquo;does he already have it?&rdquo; — that is the one worth sending.
        </p>
      </header>

      <nav aria-label="Categories">
        <ul className="flex flex-wrap gap-2">
          {tabs.map((tab) => {
            const active = tab.value === filter;
            return (
              <li key={tab.value}>
                <Link
                  href={wishlistHref(tab.value)}
                  aria-current={active ? "page" : undefined}
                  className={active ? PIXEL_BUTTON_VARIANTS.secondary : PIXEL_BUTTON_VARIANTS.quiet}
                >
                  {tab.label} {tab.count}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <section aria-label="Wanted figures">
        {visible.length === 0 ? (
          <PixelFrame className="p-5">
            <p className="font-pixel text-[10px] leading-relaxed tracking-wider text-pop-green">
              NOTHING LEFT IN THIS SECTOR
            </p>
            <p className="mt-3 text-sm text-cream/70">
              Every catalogued figure in this bucket is already on the shelf. Try another tab.
            </p>
          </PixelFrame>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {visible.map((figure) => (
              <li key={figure.slug}>
                <WantedCard figure={figure} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
