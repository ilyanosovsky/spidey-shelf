import Link from "next/link";

import { figureCategoryLabel } from "@/lib/categories";
import { formatPlace, formatPopNumber, formatSightingDate } from "@/lib/format";
import { hasLeftTheShelf, type PublicShelfEntry } from "@/lib/showcase";

import { BoxArt } from "./box-art";
import { PriceChip } from "./market-signal";
import { categoryAccent } from "./pixel-spider-art";

/**
 * One figure on the shelf: a framed panel of placeholder box art, the amber number badge,
 * the name, and where and when it was picked up.
 *
 * Three states, all of them data — nothing here is toggled by a prop the caller could get
 * wrong except the ribbon's star:
 *   · **mine** — the default card;
 *   · **not mine anymore** — dimmed, with an amber chip, because the figure and its story
 *     stay on the shelf even after the figure itself is gone;
 *   · **new sighting** — an amber star badge, used by the NEW SIGHTINGS ribbon.
 *
 * The whole card is one link (44px+ tall by a wide margin) to `/figure/<slug>`.
 */
export function FigureCard({
  entry,
  isNew = false,
  price,
  className = "",
}: {
  entry: PublicShelfEntry;
  isNew?: boolean;
  /**
   * `~$24` from the price cache (Phase 11), or nothing.
   *
   * **The card never causes a lookup.** The value comes from `listPriceChips()`, which reads
   * `price_snapshots` and stops; the nightly cron is what keeps it current. Absent is a
   * normal state — no keys, a figure the sweep has not reached yet, or a price older than
   * the display window — and the row it sits in keeps its height either way, so a shelf
   * where half the figures are priced does not look ragged.
   */
  price?: string;
  className?: string;
}) {
  const gone = hasLeftTheShelf(entry);
  const accent = categoryAccent(entry.category);

  return (
    <Link
      href={`/figure/${entry.slug}`}
      // `h-full` so a row of cards stays one rectangle even when one name wraps to two
      // lines or one figure carries the NOT MINE ANYMORE chip.
      className={`group block h-full rounded border-2 bg-navy-deep p-2 shadow-[3px_3px_0_var(--color-ink-px)] transition-transform hover:-translate-y-[2px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber ${
        gone ? "opacity-60" : ""
      } ${className}`}
      style={{ borderColor: accent }}
    >
      <div className="relative">
        <BoxArt
          slug={entry.slug}
          name={entry.name}
          category={entry.category}
          popNumber={entry.popNumber}
          imagePath={entry.imagePath}
          size="card"
        />
        <span className="font-pixel absolute -top-1 -left-1 rounded border-2 border-ink-px bg-amber px-2 py-1 text-[10px] tracking-wider text-ink-px">
          {formatPopNumber(entry.popNumber)}
        </span>
        {isNew ? (
          // The star is the badge; the words are what a screen reader gets. `title` was
          // doing neither job well — it is a tooltip on a device with no pointer, and it
          // left the glyph itself to be announced as "black star".
          <span className="font-pixel absolute -top-1 -right-1 rounded border-2 border-ink-px bg-amber px-2 py-1 text-[10px] text-ink-px">
            <span aria-hidden="true">★</span>
            <span className="sr-only">New sighting</span>
          </span>
        ) : null}
      </div>

      <p className="mt-3 line-clamp-2 text-sm leading-snug text-cream">{entry.name}</p>

      <p className="font-pixel mt-2 text-[10px] leading-relaxed tracking-wider text-lcd-glow">
        {formatPlace(entry.acquiredCity, entry.acquiredCountry)}
      </p>
      <p className="font-pixel mt-1 text-[10px] leading-relaxed tracking-wider text-cream/60 tabular-nums">
        {formatSightingDate(entry.acquiredAt)}
      </p>

      {/*
       * The category line and the price chip share one row with a fixed minimum height, so
       * a priced card and an unpriced one are exactly as tall as each other and the grid
       * does not step when the nightly sweep fills a gap.
       */}
      <div className="mt-3 flex min-h-7 flex-wrap items-center justify-between gap-2">
        <p
          className="font-pixel text-[10px] leading-relaxed tracking-wider"
          style={{ color: accent }}
        >
          {figureCategoryLabel(entry.category)}
        </p>
        {price ? <PriceChip label={price} /> : null}
      </div>

      {gone ? (
        <p className="font-pixel mt-2 inline-block rounded border-2 border-amber px-2 py-1 text-[10px] leading-relaxed tracking-wider text-amber">
          NOT MINE ANYMORE
        </p>
      ) : null}
    </Link>
  );
}
