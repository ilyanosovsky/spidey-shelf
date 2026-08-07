import { PixelButton } from "@/components/pixel-button";
import { FIGURE_CATEGORIES, FIGURE_CATEGORY_LABELS } from "@/lib/categories";
import {
  QUICK_ADD_COPY,
  quickAddHref,
  type AdminCatalogFigure,
  type QuickAddErrorCode,
  type QuickAddFormAction,
} from "@/lib/quick-add";

import { Panel, PixelLink, fieldClass, labelClass } from "../ui";
import { QuickAddErrors, QuickAddRail, QuickAddScreen } from "./quick-add-ui";

/**
 * The detour off step 2 — "yes, that is the figure, but the row is wrong".
 *
 * ADR-008 seeded 240 catalog rows from hobbyist checklists, and checklists carry typos. The
 * owner hit one on a shop floor: a scan named the product, the name matched a row, he
 * confirmed it, and the row's box number was not the number printed on the box in his hand.
 * Until Phase 12 the flow had no answer to that at all — finish the add against a wrong
 * number, or abandon it.
 *
 * Four fields, all of them things you can read off the front of a box, all prefilled from the
 * row so a one-digit correction is one digit. Everything else the row knows (its UPC, its
 * provenance, its box art, and above all its **slug**) is untouched — see `fix-figure.ts` for
 * why the slug does not follow the name.
 *
 * The whole barcode context rides through: a fix started mid-scan comes back to the same
 * confirm screen, still carrying `upc` and `via`, so correcting a number never costs the
 * backfill the scan was going to perform.
 */
export function FixStep({
  figure,
  query,
  upc,
  via,
  errors,
  action,
}: {
  figure: AdminCatalogFigure;
  /** What was typed into the search box, so BACK returns to the same results. */
  query: string;
  /** The scanned barcode this add started from, carried straight back to `confirm`. */
  upc?: string | null;
  /** `barcode` when the catalog already knew the code — the `MATCHED BY BARCODE` banner. */
  via?: string | null;
  errors: readonly QuickAddErrorCode[];
  action: QuickAddFormAction;
}) {
  const backHref = quickAddHref("confirm", { ref: figure.id, q: query, upc, via });

  return (
    <QuickAddScreen>
      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-pixel text-base leading-relaxed text-cream">
            {QUICK_ADD_COPY.fixTitle}
          </h1>
          <PixelLink href={backHref}>BACK</PixelLink>
        </div>
        <div className="mt-5">
          <QuickAddRail step="fix" />
        </div>
        <p className="mt-4 text-sm text-cream/70">
          The catalog came out of checklists, so a wrong number is a typo somebody else made.
          Correct what is printed on the box — the figure keeps its address on the shelf.
        </p>
      </Panel>

      <QuickAddErrors codes={errors} />

      <Panel>
        <form action={action} className="flex flex-col gap-4">
          {/* The row being corrected, plus everything needed to land back on step 2. */}
          <input type="hidden" name="referenceFigureId" value={figure.id} />
          <input type="hidden" name="q" value={query} />
          {upc ? <input type="hidden" name="upc" value={upc} /> : null}
          {via ? <input type="hidden" name="via" value={via} /> : null}

          <div className="flex min-w-0 flex-col gap-2">
            <label htmlFor="name" className={labelClass}>
              NAME
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              autoComplete="off"
              defaultValue={figure.name}
              className={fieldClass}
            />
          </div>

          <div className="flex min-w-0 flex-col gap-2">
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
              defaultValue={figure.popNumber === null ? "" : String(figure.popNumber)}
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
                  className="font-pixel flex min-h-11 cursor-pointer items-center justify-center rounded border-2 border-blue-frame px-2 py-2 text-center text-[10px] leading-relaxed tracking-wider text-cream has-checked:border-ink-px has-checked:bg-amber has-checked:text-ink-px has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-amber"
                >
                  <input
                    type="radio"
                    name="category"
                    value={category}
                    defaultChecked={category === figure.category}
                    className="sr-only"
                  />
                  {FIGURE_CATEGORY_LABELS[category]}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="flex min-w-0 flex-col gap-2">
            <label htmlFor="productLine" className={labelClass}>
              PRODUCT LINE (OPTIONAL)
            </label>
            <input
              id="productLine"
              name="productLine"
              type="text"
              autoComplete="off"
              defaultValue={figure.productLine ?? ""}
              placeholder="Pop! Marvel"
              className={fieldClass}
            />
          </div>

          <PixelButton type="submit" variant="primary" className="w-full">
            {QUICK_ADD_COPY.fixSubmit}
          </PixelButton>
        </form>
      </Panel>
    </QuickAddScreen>
  );
}
