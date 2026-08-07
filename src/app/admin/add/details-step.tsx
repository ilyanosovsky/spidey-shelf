import { PixelButton } from "@/components/pixel-button";
import { OWNED_STATUSES } from "@/lib/collection";
import {
  QUICK_ADD_COPY,
  quickAddHref,
  type AdminCatalogFigure,
  type QuickAddDefaults,
  type QuickAddErrorCode,
  type QuickAddFormAction,
} from "@/lib/quick-add";

import { SightingFields } from "../sighting-fields";
import { Panel, PixelLink, fieldClass, labelClass, pixelButton } from "../ui";
import { FigureSummary, QuickAddErrors, QuickAddRail, QuickAddScreen } from "./quick-add-ui";

const STATUS_LABELS: Record<string, string> = {
  mine: "MINE",
  not_mine_anymore: "NOT MINE ANYMORE",
};

/**
 * Step 3 — where and when, with everything already filled in.
 *
 * The date is today and the place is the last place a figure was picked up, which is the
 * trick that makes a whole trip one tap per figure: three Pops bought in one shop in one
 * afternoon means typing the city once. `MINE` is preselected for the obvious reason.
 *
 * The three WHERE/WHEN fields are `SightingFields`, shared with the collection edit form —
 * a native date picker, an ISO 3166 country combobox and a city box that narrows to whatever
 * that country already holds. Phase 12 moved them out of here for two reasons at once: the
 * two forms had already drifted apart, and the country field being a two-letter quiz was the
 * single worst thing about adding a figure abroad.
 *
 * The story is optional and stays optional. `SKIP FOR NOW` is a second submit on the same
 * form — it saves the sighting with `needs_story = true` and puts it in the dashboard's
 * STORIES OWED queue, because the failure mode this whole flow exists to avoid is the owner
 * not logging a figure at all rather than logging one without prose.
 */
export function DetailsStep({
  figure,
  defaults,
  citiesByCountry,
  upc,
  errors,
  action,
}: {
  figure: AdminCatalogFigure;
  defaults: QuickAddDefaults;
  /**
   * What the CITY box may suggest, per country code (Phase 12). Computed on the server from
   * the shelf's own places plus the map dictionary, so the browser gets a small object
   * instead of a fetch on every keystroke.
   */
  citiesByCountry: Readonly<Record<string, readonly string[]>>;
  /**
   * The scanned barcode, when this add started at the camera. It rides the form rather
   * than the session so the save is one self-contained POST — and saving is where the
   * catalog learns the code (`decideUpcBackfill`).
   */
  upc?: string | null;
  errors: readonly QuickAddErrorCode[];
  action: QuickAddFormAction;
}) {
  return (
    <QuickAddScreen>
      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-pixel text-base leading-relaxed text-cream">
            {QUICK_ADD_COPY.detailsTitle}
          </h1>
          <PixelLink href={quickAddHref("confirm", { ref: figure.id, upc })}>BACK</PixelLink>
        </div>
        <div className="mt-5">
          <QuickAddRail step="details" />
        </div>
        <div className="mt-5">
          <FigureSummary figure={figure} />
        </div>
      </Panel>

      <QuickAddErrors codes={errors} />

      <Panel>
        <form action={action} className="flex flex-col gap-4">
          {/* The figure is decided by the previous step; the action re-checks it exists. */}
          <input type="hidden" name="referenceFigureId" value={figure.id} />
          {upc ? <input type="hidden" name="upc" value={upc} /> : null}

          <SightingFields
            date={defaults.acquiredAt}
            city={defaults.acquiredCity}
            country={defaults.acquiredCountry}
            citiesByCountry={citiesByCountry}
          />

          <fieldset className="flex flex-col gap-2">
            <legend className={labelClass}>STATUS</legend>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {OWNED_STATUSES.map((status) => (
                <label
                  key={status}
                  className="font-pixel flex min-h-11 cursor-pointer items-center justify-center rounded border-2 border-blue-frame px-2 py-2 text-center text-[10px] leading-relaxed tracking-wider text-cream has-checked:border-ink-px has-checked:bg-amber has-checked:text-ink-px has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-amber"
                >
                  <input
                    type="radio"
                    name="status"
                    value={status}
                    defaultChecked={status === defaults.status}
                    className="sr-only"
                  />
                  {STATUS_LABELS[status]}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="flex flex-col gap-2">
            <label htmlFor="story" className={labelClass}>
              STORY (OPTIONAL)
            </label>
            <textarea
              id="story"
              name="story"
              rows={4}
              placeholder="Melrose Ave, after a very long flight."
              className={`${fieldClass} leading-relaxed`}
            />
          </div>

          {/*
           * Two submits, one form, and SAVE is FIRST in the DOM on purpose: a form submitted
           * with the Enter key uses the first submit button in tree order, and a stray Enter
           * in the city field silently skipping the story would be a quiet little betrayal.
           */}
          <PixelButton
            type="submit"
            name="intent"
            value="save"
            variant="primary"
            className="w-full"
          >
            {QUICK_ADD_COPY.detailsSubmit}
          </PixelButton>
          <button
            type="submit"
            name="intent"
            value="skip"
            className={`${pixelButton.quiet} w-full`}
          >
            {QUICK_ADD_COPY.detailsSkip}
          </button>
        </form>
      </Panel>
    </QuickAddScreen>
  );
}
