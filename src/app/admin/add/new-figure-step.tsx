import { PixelButton } from "@/components/pixel-button";
import { FIGURE_CATEGORIES, FIGURE_CATEGORY_LABELS } from "@/lib/categories";
import {
  QUICK_ADD_COPY,
  newFigurePrefill,
  quickAddHref,
  type QuickAddErrorCode,
  type QuickAddFormAction,
} from "@/lib/quick-add";

import { Panel, PixelLink, fieldClass, labelClass } from "../ui";
import { QuickAddErrors, QuickAddRail, QuickAddScreen } from "./quick-add-ui";

/**
 * Step 1b — the catalog has never heard of this figure.
 *
 * Four fields, three of them optional. The point is not to capture a good catalog row; it is
 * to stop an unknown figure from ending the flow. Whatever lands here is written with
 * `source = manual` and `needs_review = true`, so the triage pass picks it up later — the
 * owner's shelf is the source of truth about what he owns, and the catalog can catch up.
 *
 * The category radios are chips rather than a `<select>` because four options on a phone are
 * four taps of 44px, not a scroll wheel; `peter` is preselected because it is the bucket the
 * counters are about and the most likely answer on a Spider-Man shelf.
 */
export function NewFigureStep({
  query,
  errors,
  action,
}: {
  query: string;
  errors: readonly QuickAddErrorCode[];
  action: QuickAddFormAction;
}) {
  const prefill = newFigurePrefill(query);

  return (
    <QuickAddScreen>
      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-pixel text-base leading-relaxed text-cream">
            {QUICK_ADD_COPY.newFigureTitle}
          </h1>
          <PixelLink href={quickAddHref("identify", { q: query })}>BACK</PixelLink>
        </div>
        <div className="mt-5">
          <QuickAddRail step="new" />
        </div>
        <p className="mt-4 text-sm text-cream/70">
          It goes into the catalog flagged for review — enter what is printed on the box and move
          on.
        </p>
      </Panel>

      <QuickAddErrors codes={errors} />

      <Panel>
        <form action={action} className="flex flex-col gap-4">
          {/* Carried so BACK and a failed submit both return to the same search. */}
          <input type="hidden" name="q" value={query} />

          <div className="flex flex-col gap-2">
            <label htmlFor="name" className={labelClass}>
              NAME
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              autoFocus={prefill.name.length === 0}
              autoComplete="off"
              defaultValue={prefill.name}
              placeholder="Spider-Man (Last Stand)"
              className={fieldClass}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="popNumber" className={labelClass}>
              POP NUMBER (OPTIONAL)
            </label>
            <input
              id="popNumber"
              name="popNumber"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
              defaultValue={prefill.popNumber}
              placeholder="1450"
              className={fieldClass}
            />
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className={labelClass}>CATEGORY</legend>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {FIGURE_CATEGORIES.map((category) => (
                <label
                  key={category}
                  className="font-pixel flex min-h-11 cursor-pointer items-center justify-center rounded border-2 border-blue-frame px-2 py-2 text-center text-[8px] leading-relaxed tracking-wider text-cream has-checked:border-ink-px has-checked:bg-amber has-checked:text-ink-px"
                >
                  <input
                    type="radio"
                    name="category"
                    value={category}
                    defaultChecked={category === "peter"}
                    className="sr-only"
                  />
                  {FIGURE_CATEGORY_LABELS[category]}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="flex flex-col gap-2">
            <label htmlFor="productLine" className={labelClass}>
              PRODUCT LINE (OPTIONAL)
            </label>
            <input
              id="productLine"
              name="productLine"
              type="text"
              autoComplete="off"
              placeholder="Pop! Marvel"
              className={fieldClass}
            />
          </div>

          <PixelButton type="submit" variant="primary" className="w-full">
            {QUICK_ADD_COPY.newFigureSubmit}
          </PixelButton>
        </form>
      </Panel>
    </QuickAddScreen>
  );
}
