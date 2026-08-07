import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import { LCDCounter } from "@/components/lcd-counter";
import { MarketSignal } from "@/components/market-signal";
import { PixelButtonLink } from "@/components/pixel-button";
import { PixelFrame } from "@/components/pixel-frame";
import { BoxArt } from "@/components/box-art";
import { categoryAccent } from "@/components/pixel-spider-art";
import { PublicNav } from "@/components/public-nav";
import { ToothedBanner } from "@/components/toothed-banner";
import { figureCategoryLabel } from "@/lib/categories";
import { getMarketPanel } from "@/lib/ebay/market";
import { MARKET_COPY } from "@/lib/ebay/snapshot";
import { countryFlagEmoji, formatPlace, formatPopNumber, formatSightingDate } from "@/lib/format";
import { findShelfNeighbours, hasLeftTheShelf, type PublicShelfEntry } from "@/lib/showcase";
import { listPublicShelf } from "@/lib/showcase-queries";

/**
 * One figure's page — box art, ownership, and the sighting log behind it.
 *
 * Scope on purpose: only figures the owner actually has a public shelf row for. A slug from
 * the catalog that nobody owns 404s here; the catalog-wide page (with the NOT OWNED verdict
 * and the wishlist CTA) is Phase 5's search feature, and inventing half of it now would ship
 * a page that says nothing.
 *
 * `force-dynamic` is REQUIRED: without it `next build` prerenders and queries Railway at
 * build time, which CI (no DATABASE_URL) cannot do. See docs/wiki/Architecture.md.
 */
export const dynamic = "force-dynamic";

/** One query per request, shared by `generateMetadata` and the page itself. */
const shelf = cache(listPublicShelf);

function title(entry: PublicShelfEntry): string {
  return `${entry.name.toUpperCase()} ${formatPopNumber(entry.popNumber)} — SPIDEY SHELF`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const found = findShelfNeighbours(await shelf(), slug);
  if (!found) return { title: "NOT ON THE SHELF — SPIDEY SHELF" };

  const { current } = found;
  const place = formatPlace(current.acquiredCity, current.acquiredCountry);
  const when = formatSightingDate(current.acquiredAt);

  return {
    title: title(current),
    description: `${current.name} ${formatPopNumber(current.popNumber)} — sighted ${place === "—" ? "somewhere" : place} in ${when}.`,
  };
}

export default async function FigurePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const found = findShelfNeighbours(await shelf(), slug);
  if (!found) notFound();

  const { current, previous, next } = found;
  const accent = categoryAccent(current.category);
  const gone = hasLeftTheShelf(current);
  const variants = (current.variantFlags ?? []).filter(Boolean);

  // Awaited inside the render: the panel is part of the page, not a hole that fills in later.
  // Without `EBAY_CLIENT_ID`/`EBAY_CLIENT_SECRET` this returns `null` before it touches the
  // database, so the key-less deployment issues no extra query and no request.
  const market = await getMarketPanel({
    slug: current.slug,
    name: current.name,
    popNumber: current.popNumber,
  });

  return (
    <main
      id="main"
      tabIndex={-1}
      className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-5 p-4 sm:p-6"
    >
      <PublicNav pathname={`/figure/${current.slug}`} />

      <PixelFrame as="header" className="p-5" accent={accent}>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <div className="mx-auto w-full max-w-[260px] sm:mx-0 sm:w-2/5 sm:shrink-0">
            <BoxArt
              slug={current.slug}
              name={current.name}
              category={current.category}
              popNumber={current.popNumber}
              imagePath={current.imagePath}
              size="hero"
              // The hero is the page's LCP element, and it is capped at 260px by its column.
              sizes="(min-width: 640px) 260px, 100vw"
              priority
            />
          </div>

          <div className="min-w-0 flex-1">
            <p className="font-pixel text-sm tracking-wider text-amber">
              {formatPopNumber(current.popNumber)}
            </p>
            <h1 className="mt-3 text-xl leading-snug text-cream">{current.name}</h1>
            {current.productLine ? (
              <p className="mt-2 text-sm text-cream/70">{current.productLine}</p>
            ) : null}

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span
                className="font-pixel rounded border-2 px-2 py-1 text-[10px] leading-relaxed tracking-wider"
                style={{ borderColor: accent, color: accent }}
              >
                {figureCategoryLabel(current.category)}
              </span>
              {current.exclusivity ? (
                <span className="font-pixel rounded border-2 border-blue-frame px-2 py-1 text-[10px] leading-relaxed tracking-wider text-cream/80">
                  {current.exclusivity.toUpperCase()}
                </span>
              ) : null}
              {variants.map((flag) => (
                <span
                  key={flag}
                  className="font-pixel rounded border-2 border-cream/40 px-2 py-1 text-[10px] leading-relaxed tracking-wider text-cream/70"
                >
                  {flag.toUpperCase()}
                </span>
              ))}
            </div>

            <p
              className={`font-pixel mt-4 inline-block rounded border-2 px-2 py-1 text-[10px] leading-relaxed tracking-wider ${
                gone ? "border-amber text-amber" : "border-pop-green text-pop-green"
              }`}
            >
              {gone ? "NOT MINE ANYMORE" : "ON THE SHELF"}
            </p>
          </div>
        </div>
      </PixelFrame>

      <section aria-labelledby="sighting-log">
        <ToothedBanner as="h2" className="max-w-[220px]">
          <span id="sighting-log">SIGHTING LOG</span>
        </ToothedBanner>

        <PixelFrame className="mt-4 p-5">
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <dt className="font-pixel text-[10px] leading-relaxed tracking-wider text-cream/80">
                PLACE
              </dt>
              <dd className="mt-2 text-base text-cream">
                {formatPlace(current.acquiredCity, current.acquiredCountry)}
                {current.acquiredCountry ? (
                  <span className="ml-2 text-sm text-cream/60">{current.acquiredCountry}</span>
                ) : null}
              </dd>
            </div>
            <div>
              <dt className="font-pixel text-[10px] leading-relaxed tracking-wider text-cream/80">
                DATE
              </dt>
              <dd className="mt-2">
                <LCDCounter
                  value={formatSightingDate(current.acquiredAt)}
                  label="SIGHTED"
                  size="sm"
                  className="max-w-[220px]"
                />
              </dd>
            </div>
          </dl>

          {current.story ? (
            // Body font, not pixel: this is the one place on the site with real prose.
            <p className="mt-5 text-base leading-relaxed whitespace-pre-line text-cream/85">
              {current.story}
            </p>
          ) : (
            <p className="mt-5 text-sm text-cream/60">
              No story written for this one yet. The date and the city are the whole log.
            </p>
          )}
        </PixelFrame>
      </section>

      {market ? (
        <section aria-labelledby="market-signal">
          <ToothedBanner as="h2" className="max-w-[260px]">
            <span id="market-signal">{MARKET_COPY.heading}</span>
          </ToothedBanner>
          <div className="mt-4">
            <MarketSignal panel={market} />
          </div>
        </section>
      ) : null}

      <nav aria-label="Nearby sightings" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <NeighbourLink entry={previous} direction="newer" />
        <NeighbourLink entry={next} direction="older" />
      </nav>

      <div className="mt-auto pt-2 pb-[env(safe-area-inset-bottom)]">
        <PixelButtonLink href="/" variant="primary">
          ← BACK TO THE SHELF
        </PixelButtonLink>
      </div>
    </main>
  );
}

/**
 * Prev/next around the shelf ring. Labelled with the neighbour's name, because "NEXT →" on
 * its own tells a visitor nothing about where they are about to land.
 */
function NeighbourLink({
  entry,
  direction,
}: {
  entry: PublicShelfEntry;
  direction: "newer" | "older";
}) {
  const newer = direction === "newer";

  return (
    <Link
      href={`/figure/${entry.slug}`}
      className={`flex min-h-11 flex-col rounded border-2 border-blue-frame p-3 hover:-translate-y-[2px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber ${
        newer ? "items-start text-left" : "items-end text-right"
      }`}
    >
      <span className="font-pixel text-[10px] leading-relaxed tracking-wider text-amber">
        {newer ? "← NEWER" : "OLDER →"}
      </span>
      <span className="mt-2 line-clamp-2 text-sm text-cream">
        {countryFlagEmoji(entry.acquiredCountry)} {entry.name}
      </span>
    </Link>
  );
}
