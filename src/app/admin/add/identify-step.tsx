import { PixelButton, PixelButtonLink } from "@/components/pixel-button";
import {
  QUICK_ADD_COPY,
  quickAddHref,
  type AdminCatalogFigure,
  type QuickAddErrorCode,
} from "@/lib/quick-add";
import { type ReferenceSearchQuery } from "@/lib/collection-form";

import { Panel, PixelLink, fieldClass, labelClass } from "../ui";
import { FigureCardLink, QuickAddErrors, QuickAddRail, QuickAddScreen } from "./quick-add-ui";
import { ScanButton } from "./scan-button";

/**
 * Step 1 — one box, one tap.
 *
 * A GET form, exactly like the public gift check: the query lands in the URL, the answer is
 * a plain server render, and the back button works. That is what makes the whole flow
 * survivable on a shop's wifi — there is no bundle to download before the box can be typed
 * into, and the field is autofocused so the keyboard is already up.
 *
 * The list always ends with ADD AS NEW FIGURE. A catalog that does not know a figure must
 * never be the reason a figure does not get logged.
 */
export function IdentifyStep({
  query,
  parsed,
  results,
  errors,
}: {
  /** The raw `?q=`, echoed back so it can be edited rather than retyped. */
  query: string;
  parsed: ReferenceSearchQuery;
  results: readonly AdminCatalogFigure[];
  errors: readonly QuickAddErrorCode[];
}) {
  const searched = parsed.kind !== "empty";

  return (
    <QuickAddScreen>
      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-pixel text-base leading-relaxed text-cream">
            {QUICK_ADD_COPY.identifyTitle}
          </h1>
          <PixelLink href="/admin">CONSOLE</PixelLink>
        </div>
        <div className="mt-5">
          <QuickAddRail step="identify" />
        </div>

        {/* GET, not a server action: every step of this flow has to be a URL. */}
        <form action="/admin/add" method="get" className="mt-5 flex flex-col gap-3" role="search">
          <label htmlFor="q" className={labelClass}>
            {QUICK_ADD_COPY.identifyLabel}
          </label>
          <input
            id="q"
            name="q"
            type="text"
            defaultValue={query}
            autoFocus
            autoComplete="off"
            enterKeyHint="search"
            placeholder="1450 or spider-man"
            className={fieldClass}
          />
          <PixelButton type="submit" variant="primary">
            {QUICK_ADD_COPY.identifySubmit}
          </PixelButton>
        </form>

        {/*
         * Phase 7 landed here. The ONE client component in the flow, and it stays one
         * button wide: the overlay and the wasm behind it are dynamically imported when
         * it is pressed, so typing a number still costs no JavaScript at all.
         */}
        <ScanButton />
      </Panel>

      <QuickAddErrors codes={errors} />

      {!searched ? (
        <Panel>
          <p className="font-pixel text-[10px] leading-relaxed tracking-wider text-lcd-glow">
            TYPE THE NUMBER ON THE BOX.
          </p>
          <p className="mt-3 text-sm text-cream/70">
            The whole 247-row catalog is searchable here, not just the shelf — numbers repeat, so
            the next screen asks which variant it is.
          </p>
        </Panel>
      ) : null}

      {searched && results.length === 0 ? (
        <Panel>
          <p className="font-pixel text-[10px] leading-relaxed text-coral">
            {QUICK_ADD_COPY.noMatch}
          </p>
        </Panel>
      ) : null}

      <ul className="flex flex-col gap-3">
        {results.map((figure) => (
          <li key={figure.id}>
            <FigureCardLink
              figure={figure}
              href={quickAddHref("confirm", { ref: figure.id, q: query })}
            />
          </li>
        ))}

        {/* Always last, searched or not: the escape hatch is part of the flow, not an error
            state the owner has to reach by failing first. */}
        <li>
          <PixelButtonLink
            href={quickAddHref("new", { q: query })}
            variant="secondary"
            className="w-full"
          >
            + {QUICK_ADD_COPY.addAsNew}
          </PixelButtonLink>
        </li>
      </ul>
    </QuickAddScreen>
  );
}
