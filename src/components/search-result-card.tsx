import Link from "next/link";
import { type ReactNode } from "react";

import { figureCategoryLabel } from "@/lib/categories";
import { formatPopNumber } from "@/lib/format";
import { searchVerdict, type CatalogSearchResult } from "@/lib/search";

import { BoxArt } from "./box-art";
import { PixelFrame } from "./pixel-frame";
import { VerdictStamp } from "./verdict-stamp";

/**
 * One catalog figure with its verdict — the answer card.
 *
 * The stamp comes first in the DOM and in the layout, because a number like #3 matches four
 * different Spider-Men and the friend has to be able to tell at a glance which of them is
 * the one in his hand: art, name, line and the variant chips are the disambiguation, the
 * stamp is the answer.
 *
 * The frame takes the verdict's colour, not the category's, for the same reason. A figure
 * with a public page (owned, or owned once) makes the whole card a link to its sighting log;
 * a figure nobody ever had has nowhere to go, so it stays an inert panel.
 */
const VERDICT_ACCENT = {
  owned: "var(--color-pop-green)",
  had_once: "var(--color-coral)",
  never: "var(--color-coral)",
} as const;

export function SearchResultCard({ result }: { result: CatalogSearchResult }) {
  const verdict = searchVerdict(result);
  const variants = (result.variantFlags ?? []).filter(Boolean);
  const href = result.hasPublicPage ? `/figure/${result.slug}` : null;

  const body = (
    <>
      <VerdictStamp verdict={verdict} />

      <div className="mt-4 flex items-start gap-4">
        <div className="w-24 shrink-0 sm:w-28">
          <BoxArt
            slug={result.slug}
            name={result.name}
            category={result.category}
            popNumber={result.popNumber}
            imagePath={result.imagePath}
            size="card"
            // The art is a thumbnail beside the stamp, never a grid cell.
            sizes="112px"
          />
        </div>

        <div className="min-w-0 flex-1">
          <p className="font-pixel text-xs leading-relaxed tracking-wider text-amber">
            {formatPopNumber(result.popNumber)}
          </p>
          <h3 className="mt-2 text-base leading-snug text-cream">{result.name}</h3>
          {result.productLine ? (
            <p className="mt-1 text-sm text-cream/70">{result.productLine}</p>
          ) : null}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Chip tone="category">{figureCategoryLabel(result.category)}</Chip>
            {result.exclusivity ? <Chip tone="exclusive">{result.exclusivity}</Chip> : null}
            {variants.map((flag) => (
              <Chip key={flag} tone="variant">
                {flag}
              </Chip>
            ))}
          </div>

          {href ? (
            <p className="font-pixel mt-3 text-[10px] leading-relaxed tracking-wider text-cream/80">
              OPEN THE SIGHTING LOG →
            </p>
          ) : null}
        </div>
      </div>
    </>
  );

  return (
    <PixelFrame as="article" weight="sm" accent={VERDICT_ACCENT[verdict]} className="p-4">
      {href ? (
        <Link
          href={href}
          className="block focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber"
        >
          {body}
        </Link>
      ) : (
        body
      )}
    </PixelFrame>
  );
}

const CHIP_TONES = {
  category: "border-cream/40 text-cream/80",
  exclusive: "border-blue-frame text-cream/80",
  variant: "border-amber text-amber",
} as const;

function Chip({ children, tone }: { children: ReactNode; tone: keyof typeof CHIP_TONES }) {
  return (
    <span
      className={`font-pixel rounded border-2 px-2 py-1 text-[10px] leading-relaxed tracking-wider uppercase ${CHIP_TONES[tone]}`}
    >
      {children}
    </span>
  );
}
