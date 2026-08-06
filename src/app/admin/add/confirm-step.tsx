import { PixelButton, PixelButtonLink } from "@/components/pixel-button";
import { ToothedBanner } from "@/components/toothed-banner";
import {
  QUICK_ADD_COPY,
  duplicateWarning,
  quickAddHref,
  type AdminCatalogFigure,
  type DuplicateGuard,
  type QuickAddErrorCode,
  type QuickAddFormAction,
} from "@/lib/quick-add";

import { Panel, PixelLink } from "../ui";
import {
  FigureCardLink,
  FigureHero,
  QuickAddErrors,
  QuickAddRail,
  QuickAddScreen,
} from "./quick-add-ui";

/**
 * Step 2 — the mandatory one.
 *
 * Numbers repeat, chases share a number with their common, and exclusives occasionally share
 * a UPC, so "the scanner said #3" is never an answer on its own. The screen asks one question
 * — IS IT THIS ONE? — with the candidate large and its siblings underneath as one-tap
 * corrections.
 *
 * The duplicate guard changes the whole meaning of the primary button. When the figure is
 * already in the vault, inserting a second shelf row would double it on the public grid and
 * in every counter; `ADD DUPLICATE (+1)` bumps the quantity of the existing row instead and
 * skips the details step entirely, because the date and the story belong to the first copy.
 */
export function ConfirmStep({
  figure,
  siblings,
  duplicate,
  query,
  errors,
  duplicateAction,
}: {
  figure: AdminCatalogFigure;
  siblings: readonly AdminCatalogFigure[];
  /** Non-null when a `mine` shelf row already holds this exact figure. */
  duplicate: DuplicateGuard | null;
  query: string;
  errors: readonly QuickAddErrorCode[];
  duplicateAction: QuickAddFormAction;
}) {
  return (
    <QuickAddScreen>
      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-pixel text-base leading-relaxed text-cream">CONFIRM</h1>
          <PixelLink href={quickAddHref("identify", { q: query })}>NOT THIS ONE</PixelLink>
        </div>
        <div className="mt-5">
          <QuickAddRail step="confirm" />
        </div>
      </Panel>

      <QuickAddErrors codes={errors} />

      <section aria-label="Chosen figure">
        <ToothedBanner as="h2">{QUICK_ADD_COPY.confirmHeadline}</ToothedBanner>

        <Panel className="mt-4">
          <FigureHero figure={figure} />

          {duplicate ? (
            <p
              role="status"
              className="font-pixel mt-5 rounded border-2 border-amber px-3 py-3 text-[10px] leading-relaxed tracking-wider text-amber"
            >
              {duplicateWarning(duplicate)}
            </p>
          ) : null}

          <div className="mt-5">
            {duplicate ? (
              <form action={duplicateAction}>
                <input type="hidden" name="referenceFigureId" value={figure.id} />
                <PixelButton type="submit" variant="primary" className="w-full">
                  {QUICK_ADD_COPY.duplicatePrimary}
                </PixelButton>
              </form>
            ) : (
              <PixelButtonLink
                href={quickAddHref("details", { ref: figure.id })}
                variant="primary"
                className="w-full"
              >
                {QUICK_ADD_COPY.confirmPrimary}
              </PixelButtonLink>
            )}
          </div>

          {duplicate ? (
            <p className="mt-3 text-sm text-cream/70">
              One entry per figure keeps the shelf and the counters honest — a second box raises the
              quantity, it does not become a second sighting.
            </p>
          ) : null}
        </Panel>
      </section>

      {siblings.length > 0 ? (
        <section aria-label="Variants" className="flex flex-col gap-3">
          <h3 className="font-pixel text-[10px] leading-relaxed tracking-wider text-amber">
            {QUICK_ADD_COPY.confirmVariants}
          </h3>
          <ul className="flex flex-col gap-3">
            {siblings.map((sibling) => (
              <li key={sibling.id}>
                <FigureCardLink
                  figure={sibling}
                  href={quickAddHref("confirm", { ref: sibling.id, q: query })}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </QuickAddScreen>
  );
}
