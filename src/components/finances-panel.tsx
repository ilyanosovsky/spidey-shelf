import Link from "next/link";

import { MARKET_COPY } from "@/lib/ebay/snapshot";
import {
  FINANCE_COPY,
  financeCoverageLine,
  isCoveragePartial,
  type CollectionFinances,
  type FinanceFigure,
} from "@/lib/finances";

import { BoxArt } from "./box-art";
import { LCDCounter } from "./lcd-counter";
import { PixelFrame } from "./pixel-frame";
import { ToothedBanner } from "./toothed-banner";

/**
 * What the shelf is worth — the FINANCES section of `/stats` (Phase 11).
 *
 * The owner asked for three numbers: the most expensive figure, the cheapest, and roughly
 * what the whole thing is worth. All three are medians of active eBay listings, so the whole
 * section is built to say "roughly" out loud rather than to look precise:
 *
 *   · every figure is `~$24`, never `$23.99` — `formatMoney()` rounds, because a median of
 *     twenty-five strangers' asking prices does not have cents;
 *   · the coverage line prints how many of the owned figures actually have a price, so a
 *     total over seven of fifteen figures cannot read as a total over fifteen;
 *   · the fine print is `MARKET_COPY.disclaimer`, imported rather than retyped — the same
 *     sentence the MARKET SIGNAL panel carries, and the honest half of the whole feature.
 *
 * It renders nothing at all when there is no number to print (`getCollectionFinances()`
 * returns `null` without keys, without a shelf and without a single cached price). Same rule
 * as MARKET SIGNAL: a showcase does not explain its own missing integrations.
 */
export const FINANCE_THUMB_SIZES = "(min-width: 640px) 96px, 80px";

function FinanceCard({ label, figure }: { label: string; figure: FinanceFigure }) {
  return (
    <Link
      href={`/figure/${figure.slug}`}
      className="flex flex-1 items-center gap-3 rounded border-2 border-blue-frame bg-navy-deep p-3 transition-transform hover:-translate-y-[2px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber"
    >
      <div className="w-20 shrink-0 sm:w-24">
        <BoxArt
          slug={figure.slug}
          name={figure.name}
          category={figure.category}
          popNumber={figure.popNumber}
          imagePath={figure.imagePath}
          size="card"
          sizes={FINANCE_THUMB_SIZES}
        />
      </div>

      <div className="min-w-0">
        <p className="font-pixel text-[10px] leading-relaxed tracking-wider text-amber">{label}</p>
        <p className="mt-2 line-clamp-2 text-sm leading-snug text-cream">{figure.name}</p>
        <p className="font-pixel mt-2 text-[10px] leading-relaxed tracking-wider text-lcd-glow tabular-nums">
          {figure.price}
        </p>
      </div>
    </Link>
  );
}

export function FinancesPanel({ finances }: { finances: CollectionFinances }) {
  // One priced figure is its own most prized and its own easiest find. Printing the same
  // card twice under two labels would read as a bug rather than as a small collection.
  const bothEnds = finances.top.slug !== finances.bottom.slug;

  return (
    <section aria-labelledby="finances">
      <ToothedBanner as="h2" className="max-w-[240px]">
        <span id="finances">{FINANCE_COPY.heading}</span>
      </ToothedBanner>

      <PixelFrame className="mt-4 p-5">
        <LCDCounter value={finances.totalLabel} label={FINANCE_COPY.total} />

        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <FinanceCard label={FINANCE_COPY.top} figure={finances.top} />
          {bothEnds ? <FinanceCard label={FINANCE_COPY.bottom} figure={finances.bottom} /> : null}
        </div>

        <p className="font-pixel mt-4 text-[10px] leading-relaxed tracking-wider text-cream/80 tabular-nums">
          {financeCoverageLine(finances)}
          {isCoveragePartial(finances) ? ` · ${FINANCE_COPY.pending}` : ""}
        </p>

        <p className="mt-3 text-sm text-cream/70">{MARKET_COPY.disclaimer}</p>
      </PixelFrame>
    </section>
  );
}
