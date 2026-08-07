import Link from "next/link";

import { FIGURE_CATEGORY_LABELS } from "@/lib/categories";
import {
  filterShelf,
  latestSightingLine,
  newSightings,
  SHELF_TABS,
  shelfHref,
  type PublicShelfEntry,
  type ShelfFilter,
  type ShelfProgress,
} from "@/lib/showcase";

import { FigureCard } from "./figure-card";
import { LCDCounter } from "./lcd-counter";
import { PIXEL_BUTTON_VARIANTS } from "./pixel-button";
import { PixelFrame } from "./pixel-frame";
import { PublicNav } from "./public-nav";
import { TickerBar } from "./ticker-bar";
import { ToothedBanner } from "./toothed-banner";

/**
 * The home screen, as a pure function of already-fetched data.
 *
 * `src/app/page.tsx` is only the shell that reads the database and hands the rows over, so
 * everything that is a design decision — which figures show, what the empty tab says, what
 * the ticker reads — is testable without a database or a request.
 */
export function ShelfScreen({
  entries,
  progress,
  filter,
  isAdmin = false,
}: {
  entries: readonly PublicShelfEntry[];
  progress: ShelfProgress;
  filter: ShelfFilter;
  /** A verified admin session — the only thing it changes here is the nav's fifth tab. */
  isAdmin?: boolean;
}) {
  const visible = filterShelf(entries, filter);
  const ribbon = newSightings(entries);
  const ribbonSlugs = new Set(ribbon.map((entry) => entry.slug));
  const remaining = Math.max(progress.total - progress.owned, 0);

  return (
    <main
      id="main"
      tabIndex={-1}
      className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col gap-5 p-4 sm:p-6"
    >
      <PublicNav pathname="/" isAdmin={isAdmin} />

      <PixelFrame as="header" className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-pixel text-base leading-relaxed text-cream sm:text-xl">
            SPIDEY
            <span className="text-coral"> 🕷 </span>
            SHELF
          </h1>
          <p className="font-pixel text-[10px] leading-relaxed tracking-wider text-cream/80">
            {entries.length} SIGHTINGS LOGGED
          </p>
        </div>

        {/* The counter is the door to the stats screen — the design brief's "tap the LCD". */}
        <Link
          href="/stats"
          className="mt-5 block rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber"
        >
          <LCDCounter
            value={`${progress.owned} / ${progress.total}`}
            label={`${FIGURE_CATEGORY_LABELS.peter} COLLECTED`}
          />
        </Link>

        <Link
          href="/wishlist"
          className="font-pixel mt-4 flex min-h-11 items-center justify-center text-center text-[10px] leading-relaxed tracking-wider text-amber focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber"
        >
          {remaining} SPIDERS STILL OUT THERE →
        </Link>
      </PixelFrame>

      {ribbon.length > 0 ? (
        <section aria-labelledby="new-sightings">
          <ToothedBanner as="h2" className="max-w-[240px]">
            <span id="new-sightings">NEW SIGHTINGS</span>
          </ToothedBanner>

          {/* A ribbon, not a grid: the newest arrivals get bigger cards and a swipe. */}
          <ul className="mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2">
            {ribbon.map((entry) => (
              <li key={entry.slug} className="w-40 shrink-0 snap-start sm:w-48">
                <FigureCard entry={entry} isNew />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <nav aria-label="Categories">
        <ul className="flex flex-wrap gap-2">
          {SHELF_TABS.map((tab) => {
            const active = tab.value === filter;
            return (
              <li key={tab.value}>
                <Link
                  href={shelfHref(tab.value)}
                  aria-current={active ? "page" : undefined}
                  className={active ? PIXEL_BUTTON_VARIANTS.secondary : PIXEL_BUTTON_VARIANTS.quiet}
                >
                  {tab.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <section aria-label="The shelf">
        {visible.length === 0 ? (
          <PixelFrame className="p-5">
            <p className="font-pixel text-[10px] leading-relaxed tracking-wider text-amber">
              NO SIGHTINGS IN THIS SECTOR YET
            </p>
            <p className="mt-3 text-sm text-cream/70">
              Nothing from this corner of the multiverse has made it onto the shelf. Try another
              tab.
            </p>
          </PixelFrame>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {visible.map((entry) => (
              <li key={entry.slug}>
                <FigureCard entry={entry} isNew={ribbonSlugs.has(entry.slug)} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Sticky so the gadget always has its status line, thumb-zone safe on a phone. */}
      <footer className="sticky bottom-0 mt-auto pt-2 pb-[env(safe-area-inset-bottom)]">
        <TickerBar text={latestSightingLine(entries)} />
      </footer>
    </main>
  );
}
