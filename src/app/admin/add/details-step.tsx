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
 * The story is optional and stays optional. `SKIP FOR NOW` is a second submit on the same
 * form — it saves the sighting with `needs_story = true` and puts it in the dashboard's
 * STORIES OWED queue, because the failure mode this whole flow exists to avoid is the owner
 * not logging a figure at all rather than logging one without prose.
 */
export function DetailsStep({
  figure,
  defaults,
  errors,
  action,
}: {
  figure: AdminCatalogFigure;
  defaults: QuickAddDefaults;
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
          <PixelLink href={quickAddHref("confirm", { ref: figure.id })}>BACK</PixelLink>
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

          <div className="flex flex-col gap-2">
            <label htmlFor="acquiredAt" className={labelClass}>
              DATE
            </label>
            <input
              id="acquiredAt"
              name="acquiredAt"
              type="date"
              required
              defaultValue={defaults.acquiredAt}
              className={fieldClass}
            />
          </div>

          <div className="grid grid-cols-[1fr_auto] gap-3">
            <div className="flex flex-col gap-2">
              <label htmlFor="acquiredCity" className={labelClass}>
                CITY
              </label>
              <input
                id="acquiredCity"
                name="acquiredCity"
                type="text"
                autoComplete="off"
                defaultValue={defaults.acquiredCity}
                className={fieldClass}
              />
            </div>
            <div className="flex w-24 flex-col gap-2">
              <label htmlFor="acquiredCountry" className={labelClass}>
                COUNTRY
              </label>
              <input
                id="acquiredCountry"
                name="acquiredCountry"
                type="text"
                maxLength={2}
                pattern="[A-Za-z]{2}"
                autoComplete="off"
                autoCapitalize="characters"
                defaultValue={defaults.acquiredCountry}
                className={`${fieldClass} uppercase`}
              />
            </div>
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className={labelClass}>STATUS</legend>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {OWNED_STATUSES.map((status) => (
                <label
                  key={status}
                  className="font-pixel flex min-h-11 cursor-pointer items-center justify-center rounded border-2 border-blue-frame px-2 py-2 text-center text-[8px] leading-relaxed tracking-wider text-cream has-checked:border-ink-px has-checked:bg-amber has-checked:text-ink-px"
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
