import Link from "next/link";

import { figureCategoryLabel } from "@/lib/categories";
import { formatPopNumber } from "@/lib/format";
import { searchHrefFor, type PublicCatalogFigure } from "@/lib/search";

import { PriceChip } from "./market-signal";
import { BoxArt } from "./box-art";
import { ShareButton } from "./share-button";

/**
 * The wishlist card — `FigureCard`'s twin for a figure nobody owns yet.
 *
 * A separate component rather than a prop on `FigureCard`: that one renders a *shelf row*
 * (place, date, story) and this one renders a *catalog row* that has none of those. They
 * share the frame, the art and the amber number badge; what differs is the coral border, the
 * WANTED stamp and where they point.
 *
 * The link goes to `/search?q=<number>`, not to `/figure/<slug>`: a wanted figure has no
 * sighting log, and the search URL is the canonical shareable answer — whoever opens it gets
 * the live verdict, which will read OWNED the day the gift arrives.
 *
 * The card is not one big link, because it holds a button: nesting a `<button>` inside an
 * `<a>` is invalid HTML and behaves differently in every browser. The art and the name are
 * the link; SHARE sits under them.
 */
export function WantedCard({
  figure,
  price,
}: {
  figure: PublicCatalogFigure;
  /**
   * `~$24`, and only when a figure page has already looked it up and the answer is still
   * fresh (Phase 8). Absent on almost every card, which is deliberate: the wishlist never
   * spends an eBay call, so there is nothing to load and nothing to spin.
   */
  price?: string;
}) {
  const href = searchHrefFor(figure);

  return (
    <article className="flex h-full flex-col rounded border-2 border-coral bg-navy-deep p-2 shadow-[3px_3px_0_var(--color-ink-px)]">
      <Link
        href={href}
        className="block transition-transform hover:-translate-y-[2px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber"
      >
        <div className="relative">
          <BoxArt
            slug={figure.slug}
            name={figure.name}
            category={figure.category}
            popNumber={figure.popNumber}
            imagePath={figure.imagePath}
            size="card"
          />
          <span className="font-pixel absolute -top-1 -left-1 rounded border-2 border-ink-px bg-amber px-2 py-1 text-[10px] tracking-wider text-ink-px">
            {formatPopNumber(figure.popNumber)}
          </span>
          {/* Top-right, where `FigureCard` puts its star: the bottom-right corner is where
              the art prints the pop number, and the stamp would sit on top of it. */}
          <span className="font-pixel absolute -top-1 -right-1 rounded border-2 border-ink-px bg-coral px-2 py-1 text-[10px] tracking-wider text-ink-px">
            WANTED
          </span>
        </div>

        <p className="mt-3 line-clamp-2 text-sm leading-snug text-cream">{figure.name}</p>

        {figure.productLine ? (
          <p className="mt-1 line-clamp-1 text-xs text-cream/60">{figure.productLine}</p>
        ) : null}

        <p className="font-pixel mt-2 text-[10px] leading-relaxed tracking-wider text-coral">
          {figureCategoryLabel(figure.category)}
        </p>
      </Link>

      {price ? (
        <p className="mt-2">
          <PriceChip label={price} />
        </p>
      ) : null}

      <div className="mt-auto pt-3">
        <ShareButton href={href} title={figure.name} />
      </div>
    </article>
  );
}
