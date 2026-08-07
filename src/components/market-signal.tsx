import { MARKET_COPY, formatMoney, marketSignalLine } from "@/lib/ebay/snapshot";
import { type MarketPanel } from "@/lib/ebay/market";

import { LCDCounter } from "./lcd-counter";
import { PixelFrame } from "./pixel-frame";

/**
 * What the internet thinks a figure is worth — the LCD readout on `/figure/[slug]`.
 *
 * The panel exists only when there is a number to put in it. No keys, no cached answer and
 * no reachable eBay all produce the same thing: nothing rendered (`getMarketPanel()` returns
 * `null` and the page skips the section). A public showcase does not explain its own missing
 * integrations to visitors.
 *
 * The wording is doing real work here, so none of it is decoration:
 *   · the **`~`** is the median admitting it is a median of twenty-five asking prices;
 *   · **"active listings, not sold prices"** is the difference between what people want for a
 *     Pop and what one actually goes for, and every price guide that leaves it out is lying;
 *   · **the age** is what stops a cached number reading as a live one — and it is the same
 *     line whether the snapshot is an hour old or three days stale.
 */
export function MarketSignal({ panel }: { panel: MarketPanel }) {
  return (
    <PixelFrame className="p-5">
      <div className="flex flex-wrap items-end gap-4">
        <LCDCounter
          value={marketSignalLine(panel)}
          label={MARKET_COPY.heading}
          size="sm"
          className="min-w-[220px] flex-1"
        />

        <p className="font-pixel text-[10px] leading-relaxed tracking-wider text-amber tabular-nums">
          MIN {formatMoney(panel.minCents, panel.currency)}
        </p>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <a
          href={panel.searchUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="font-pixel inline-flex min-h-11 items-center justify-center rounded border-2 border-blue-frame px-4 py-3 text-[10px] tracking-wider text-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber"
        >
          {MARKET_COPY.link}
          {/* The arrow says "leaves the site"; the link text already says where to. */}
          <span aria-hidden="true" className="ml-2">
            ↗
          </span>
        </a>
        <p className="font-pixel text-[10px] leading-relaxed tracking-wider text-cream/60">
          {panel.ageLabel}
          {panel.stale ? " · EBAY DID NOT ANSWER" : ""}
        </p>
      </div>

      <p className="mt-3 text-sm text-cream/70">{MARKET_COPY.disclaimer}</p>
    </PixelFrame>
  );
}

/**
 * The wishlist's version: one amber chip, no link, no explanation.
 *
 * It appears only when a figure page has already paid for that figure's price and the answer
 * is still fresh — the wishlist itself never triggers a lookup. So most cards have no chip,
 * and that is the correct, cheap default rather than a loading state.
 */
export function PriceChip({ label }: { label: string }) {
  return (
    <span className="font-pixel inline-block rounded border-2 border-amber px-2 py-1 text-[10px] leading-relaxed tracking-wider text-amber tabular-nums">
      {label}
    </span>
  );
}
