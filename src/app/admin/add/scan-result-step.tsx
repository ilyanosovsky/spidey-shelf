import { PixelButtonLink } from "@/components/pixel-button";
import { ToothedBanner } from "@/components/toothed-banner";
import { SCAN_COPY } from "@/lib/barcode/scan-flow";
import { formatUpc } from "@/lib/barcode/upc";
import { quickAddHref, QUICK_ADD_COPY, type AdminCatalogFigure } from "@/lib/quick-add";

import { Panel, PixelLink } from "../ui";
import { FigureCardLink, QuickAddRail, QuickAddScreen } from "./quick-add-ui";

/**
 * The frame between the camera and the confirm step: `IS IT ONE OF THESE?`
 *
 * It exists because our catalog's `upc` column started empty (ADR-008 seeded facts, not
 * barcodes), so the first scan of any figure cannot be a lookup — it is a **guess**, made
 * out of whatever product title UPCitemdb had for that code, fuzzy-matched against the
 * catalog. The screen says exactly that: the parsed title is printed above the candidates
 * so the owner can see what the guess was made of, and picking one is what turns the guess
 * into a fact by carrying the barcode into the write.
 *
 * Every route out of here carries `upc`. That is the whole enrichment loop — the scan that
 * cost an API call today is a catalog hit tomorrow.
 */
export function ScanResultStep({
  upc,
  notice,
  parsedTitle,
  candidates,
}: {
  /** The scanned code, already checksum-verified upstream. */
  upc: string;
  /** One of `SCAN_NOTICES`, never text lifted out of the address bar. */
  notice: string;
  /** What the heuristic read out of the retailer's product title, if anything. */
  parsedTitle: string | null;
  candidates: readonly AdminCatalogFigure[];
}) {
  return (
    <QuickAddScreen>
      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-pixel text-base leading-relaxed text-cream">
            {SCAN_COPY.resultTitle}
          </h1>
          <PixelLink href={quickAddHref("identify")}>{SCAN_COPY.typeInstead}</PixelLink>
        </div>
        <div className="mt-5">
          <QuickAddRail step="scan-result" />
        </div>
        <p className="font-pixel mt-5 text-[10px] leading-relaxed tracking-wider text-lcd-glow">
          {formatUpc(upc)}
        </p>
        <p role="status" className="font-pixel mt-4 text-[10px] leading-relaxed text-amber">
          {notice}
        </p>
        {parsedTitle ? (
          <p className="mt-3 text-sm text-cream/70">
            The lookup calls it <span className="text-cream">{parsedTitle}</span>. The catalog is
            ours, so the names differ — pick the row that is the same figure.
          </p>
        ) : null}
      </Panel>

      <section aria-label="Barcode candidates">
        <ToothedBanner as="h2">{SCAN_COPY.candidates}</ToothedBanner>

        <ul className="mt-4 flex flex-col gap-3">
          {candidates.map((figure) => (
            <li key={figure.id}>
              <FigureCardLink
                figure={figure}
                href={quickAddHref("confirm", { ref: figure.id, upc, via: "lookup" })}
              />
            </li>
          ))}

          {/* Same rule as step 1: the escape hatch is part of the flow, not a failure. */}
          <li>
            <PixelButtonLink
              href={quickAddHref("new", { upc, q: parsedTitle ?? "" })}
              variant="secondary"
              className="w-full"
            >
              + {QUICK_ADD_COPY.addAsNew}
            </PixelButtonLink>
          </li>
        </ul>
      </section>
    </QuickAddScreen>
  );
}

/**
 * The other end of the scan: a barcode that does not survive its own check digit.
 *
 * Reached by a mistyped URL or a torn label read half-way, never by a clean decode — the
 * overlay validates before it navigates. It is a separate screen rather than an `?err=`
 * on step 1 because the answer is different: there is nothing to fix in a form, the code
 * is simply not a code, and the only useful next move is the keyboard.
 */
export function ScanFailedStep({ notice }: { notice: string }) {
  return (
    <QuickAddScreen>
      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-pixel text-base leading-relaxed text-cream">
            {SCAN_COPY.resultTitle}
          </h1>
          <PixelLink href="/admin">CONSOLE</PixelLink>
        </div>
        <div className="mt-5">
          <QuickAddRail step="scan-result" />
        </div>
      </Panel>

      <Panel className="border-coral">
        <p role="alert" className="font-pixel text-[10px] leading-relaxed text-coral">
          {notice}
        </p>
        <p className="mt-3 text-sm text-cream/70">
          A barcode carries a check digit that has to agree with the other twelve. This one does
          not, so it was never scanned off a box that exists.
        </p>
      </Panel>

      <PixelButtonLink href={quickAddHref("identify")} variant="primary" className="w-full">
        {SCAN_COPY.typeInstead}
      </PixelButtonLink>
    </QuickAddScreen>
  );
}
