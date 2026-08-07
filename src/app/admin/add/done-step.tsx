import { LCDCounter } from "@/components/lcd-counter";
import { PixelButtonLink } from "@/components/pixel-button";
import { ToothedBanner } from "@/components/toothed-banner";
import { FIGURE_CATEGORY_LABELS } from "@/lib/categories";
// `import type`, not an inline `type` specifier: `collection-queries` pulls in `server-only`,
// and only the statement form is guaranteed to be erased before anything tries to load it.
import type { VaultStats } from "@/lib/collection-queries";
import { formatSightingDate } from "@/lib/format";
import {
  QUICK_ADD_COPY,
  duplicateSuccessNote,
  quickAddHref,
  type AdminCatalogFigure,
} from "@/lib/quick-add";

import { Panel } from "../ui";
import { FigureSummary, QuickAddScreen } from "./quick-add-ui";

/**
 * Step 4 — the payoff.
 *
 * The counter is the reason this screen is full-screen rather than a toast: the number the
 * whole site is about just moved, and watching it move is what makes logging the next figure
 * feel worth thirty seconds. The three buttons are the three things that plausibly come next
 * and nothing else — another figure, look at this one, or write the story that was skipped.
 */
export function DoneStep({
  figure,
  ownedId,
  acquiredAt,
  place,
  needsStory,
  slug,
  duplicateQuantity,
  stats,
}: {
  figure: AdminCatalogFigure;
  ownedId: string;
  acquiredAt: string | null;
  place: string;
  /** The story was skipped — the WRITE THE STORY button only exists in that case. */
  needsStory: boolean;
  /** The public URL, or null when the row is staged and `/figure/<slug>` would 404. */
  slug: string | null;
  /** Set when the owner bumped an existing row instead of inserting a new one. */
  duplicateQuantity: number | null;
  stats: VaultStats;
}) {
  return (
    <QuickAddScreen>
      <section aria-label="Sighting confirmed">
        <ToothedBanner as="h1" tone="green">
          {QUICK_ADD_COPY.successHeadline}
        </ToothedBanner>

        <Panel className="mt-4 border-pop-green">
          <FigureSummary figure={figure} />

          <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="font-pixel text-[10px] tracking-wider text-cream/80">DATE</dt>
              <dd className="mt-1 text-cream/80 tabular-nums">{formatSightingDate(acquiredAt)}</dd>
            </div>
            <div>
              <dt className="font-pixel text-[10px] tracking-wider text-cream/80">PLACE</dt>
              <dd className="mt-1 text-cream/80">{place}</dd>
            </div>
          </dl>

          {duplicateQuantity !== null ? (
            <p className="font-pixel mt-5 rounded border-2 border-amber px-3 py-3 text-[10px] leading-relaxed tracking-wider text-amber">
              {duplicateSuccessNote(duplicateQuantity)}
            </p>
          ) : null}
        </Panel>
      </section>

      <div className="grid grid-cols-2 gap-3">
        <LCDCounter
          value={`${stats.peterOwned} / ${stats.peterTotal}`}
          label={`${FIGURE_CATEGORY_LABELS.peter} COLLECTED`}
          size="sm"
        />
        <LCDCounter value={String(stats.mine)} label="FIGURES ON THE SHELF" size="sm" />
      </div>

      <div className="flex flex-col gap-3">
        <PixelButtonLink href={quickAddHref("identify")} variant="primary" className="w-full">
          {QUICK_ADD_COPY.addAnother}
        </PixelButtonLink>

        {slug ? (
          <PixelButtonLink href={`/figure/${slug}`} variant="secondary" className="w-full">
            {QUICK_ADD_COPY.viewIt}
          </PixelButtonLink>
        ) : null}

        {needsStory ? (
          <PixelButtonLink
            href={`/admin/collection/${ownedId}/edit`}
            variant="quiet"
            className="w-full"
          >
            {QUICK_ADD_COPY.writeTheStory}
          </PixelButtonLink>
        ) : null}

        <PixelButtonLink href="/admin/collection" variant="quiet" className="w-full">
          BACK TO THE VAULT
        </PixelButtonLink>
      </div>
    </QuickAddScreen>
  );
}
