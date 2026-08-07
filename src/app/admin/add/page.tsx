import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { lookupUpcItemDb } from "@/lib/barcode/lookup";
import {
  chooseScanTarget,
  mergeScanCandidates,
  parseScanOrigin,
  scanFallbackRoute,
  scanNoticeMessage,
  SCAN_CANDIDATE_LIMIT,
} from "@/lib/barcode/scan-flow";
import { parseProductTitle } from "@/lib/barcode/upcitemdb";
import { normalizeScannedCode } from "@/lib/barcode/upc";
import {
  findFiguresByUpc,
  getAdminFigure,
  getOwnedFigure,
  getVaultStats,
  listOwnedCopies,
  listRecentPlaces,
  listUsedPlaces,
  listVariantCandidates,
  searchAdminCatalog,
} from "@/lib/collection-queries";
import { requireAdmin } from "@/lib/dal";
import { formatPlace } from "@/lib/format";
import { citySuggestionIndex } from "@/lib/places";
import { parseSearchQuery, searchQueryValue } from "@/lib/search";
import {
  findOwnedDuplicate,
  firstParam,
  lastUsedPlace,
  parseQuickAddErrors,
  parseQuickAddStep,
  parseUuidParam,
  quickAddDefaults,
  quickAddErrorParam,
  quickAddHref,
  scannedUpcValue,
  variantSiblings,
  type AdminCatalogFigure,
} from "@/lib/quick-add";

import {
  addDuplicateAction,
  createReferenceFigureAction,
  fixReferenceFigureAction,
  saveSightingAction,
} from "./actions";
import { ConfirmStep } from "./confirm-step";
import { DetailsStep } from "./details-step";
import { DoneStep } from "./done-step";
import { FixStep } from "./fix-step";
import { IdentifyStep } from "./identify-step";
import { NewFigureStep } from "./new-figure-step";
import { ScanFailedStep, ScanResultStep } from "./scan-result-step";

/**
 * Quick Add — one route, seven frames, `?step=` decides which.
 *
 * Steps are URLs rather than client state, which buys three things at once: the back button
 * works, a half-finished add survives a phone locking itself, and every frame is a plain
 * server render with no JavaScript to download first. Everything this file does is fetch and
 * dispatch — the rules live in `src/lib/quick-add.ts` and `src/lib/barcode/`, the writes in
 * `./actions.ts`, and each step component is a pure function of its props.
 *
 * Phase 7 added `scan-result`, the one frame that decides rather than renders a query, and
 * `?upc=` — which every step from there on carries, because the write at the end of the flow
 * is what teaches the catalog the barcode. Phase 12 added `fix`, a detour off step 2 for the
 * case the flow could not express at all: the right figure on a row with wrong data.
 *
 * `force-dynamic` is REQUIRED, not a preference: without it `next build` would prerender the
 * page and query Railway at build time, which CI (no DATABASE_URL) cannot do. See
 * docs/wiki/Architecture.md.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "QUICK ADD — Spidey Shelf",
  robots: { index: false, follow: false },
};

type QuickAddSearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Today in the server's timezone — the date the owner almost always wants. */
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default async function QuickAddPage({
  searchParams,
}: {
  searchParams: QuickAddSearchParams;
}) {
  // Real enforcement. src/proxy.ts only redirects optimistically (CVE-2025-29927).
  await requireAdmin();

  const params = await searchParams;
  const step = parseQuickAddStep(params.step);
  const errors = parseQuickAddErrors(params.err);
  const query = searchQueryValue(params.q);
  const upc = scannedUpcValue(firstParam(params.upc));

  if (step === "scan-result") {
    return renderScanResult(firstParam(params.upc));
  }

  if (step === "new") {
    return (
      <NewFigureStep query={query} upc={upc} errors={errors} action={createReferenceFigureAction} />
    );
  }

  if (step === "confirm" || step === "details" || step === "fix") {
    const figure = await requireFigure(params.ref);

    if (step === "fix") {
      return (
        <FixStep
          figure={figure}
          query={query}
          upc={upc}
          via={parseScanOrigin(params.via) === "barcode" ? "barcode" : null}
          errors={errors}
          action={fixReferenceFigureAction}
        />
      );
    }

    if (step === "details") {
      const [recent, used] = await Promise.all([listRecentPlaces(), listUsedPlaces()]);
      return (
        <DetailsStep
          figure={figure}
          defaults={quickAddDefaults(today(), lastUsedPlace(recent))}
          citiesByCountry={citySuggestionIndex(used)}
          upc={upc}
          errors={errors}
          action={saveSightingAction}
        />
      );
    }

    const [copies, candidates] = await Promise.all([
      listOwnedCopies(figure.id),
      listVariantCandidates(figure),
    ]);

    return (
      <ConfirmStep
        figure={figure}
        siblings={variantSiblings(figure, candidates)}
        duplicate={findOwnedDuplicate(copies)}
        query={query}
        upc={upc}
        matchedByBarcode={parseScanOrigin(params.via) === "barcode"}
        errors={errors}
        duplicateAction={addDuplicateAction}
      />
    );
  }

  if (step === "done") {
    return renderDone(params);
  }

  const parsed = parseSearchQuery(params.q);
  const results = await searchAdminCatalog(parsed);

  return <IdentifyStep query={query} parsed={parsed} results={results} errors={errors} />;
}

/**
 * `?ref=` → a real catalog row, or back to the search box.
 *
 * A bad uuid never reaches Postgres (which would answer with an error page), and a uuid that
 * no longer names a figure is a stale tab, not a crash: both land on step 1 with FIGURE_GONE
 * spelled out.
 */
async function requireFigure(raw: string | string[] | undefined): Promise<AdminCatalogFigure> {
  const id = parseUuidParam(raw);
  const figure = id ? await getAdminFigure(id) : null;
  if (!figure) redirect(quickAddHref("identify", { err: quickAddErrorParam(["FIGURE_GONE"]) }));
  return figure;
}

/**
 * Where a decoded barcode lands — three graded answers, in cost order.
 *
 * 1. **The catalog.** A row already carrying the code (in either spelling) goes straight
 *    to the confirm step with `MATCHED BY BARCODE`. Free, instant, and the state every
 *    scanned figure ends up in after its first pass through this function.
 * 2. **UPCitemdb, exactly once.** The trial tier is 100 lookups a day for the whole
 *    deployment, so this is reached only on a catalog miss, is never retried, and its
 *    failures are outcomes rather than exceptions. Its product title is parsed by a
 *    heuristic and fuzzy-matched against our own catalog — the names will not agree, which
 *    is precisely why the next screen asks instead of deciding.
 * 3. **The new-figure form**, prefilled with whatever survived, barcode carried.
 *
 * Every branch keeps `upc` in the URL, because the write at the end of the flow is what
 * backfills it onto the confirmed row. That is the loop: today's API call is tomorrow's
 * catalog hit.
 */
async function renderScanResult(raw: string | undefined) {
  const scanned = normalizeScannedCode(raw);
  // A URL is not a decode. A code that fails its own arithmetic never reaches the API.
  if (!scanned) return <ScanFailedStep notice={scanNoticeMessage("BAD_BARCODE")} />;

  const matches = await findFiguresByUpc(scanned.forms);
  const known = chooseScanTarget(matches);
  if (known) {
    redirect(quickAddHref("confirm", { ref: known, upc: scanned.ean13, via: "barcode" }));
  }

  const lookup = await lookupUpcItemDb(scanned.query);
  const title = lookup.kind === "hit" ? parseProductTitle(lookup.title) : null;

  const [byNumber, byName] = await Promise.all([
    title?.popNumber
      ? searchAdminCatalog({
          kind: "number",
          popNumber: title.popNumber,
          raw: String(title.popNumber),
        })
      : Promise.resolve([]),
    title?.name ? searchAdminCatalog({ kind: "text", text: title.name }) : Promise.resolve([]),
  ]);

  const candidates = mergeScanCandidates(byNumber, byName, SCAN_CANDIDATE_LIMIT);
  const route = scanFallbackRoute(lookup, candidates.length);

  if (route.kind === "candidates") {
    return (
      <ScanResultStep
        upc={scanned.ean13}
        notice={scanNoticeMessage(route.notice)}
        parsedTitle={title?.name ?? null}
        candidates={candidates}
      />
    );
  }

  return (
    <NewFigureStep
      query={title?.name ?? ""}
      prefill={{
        name: title?.name ?? "",
        popNumber: title?.popNumber ? String(title.popNumber) : "",
      }}
      upc={scanned.ean13}
      notice={scanNoticeMessage(route.notice)}
      errors={[]}
      action={createReferenceFigureAction}
    />
  );
}

/**
 * The success frame reads the row that was just written rather than trusting the URL for
 * anything but its id — so the date, the place and the story flag on screen are the ones in
 * the database, not the ones the form hoped for.
 */
async function renderDone(params: Record<string, string | string[] | undefined>) {
  const id = parseUuidParam(params.id);
  const owned = id ? await getOwnedFigure(id) : null;
  if (!owned?.referenceFigureId) redirect(quickAddHref("identify"));

  const [figure, stats] = await Promise.all([
    getAdminFigure(owned.referenceFigureId),
    getVaultStats(),
  ]);
  if (!figure) redirect(quickAddHref("identify"));

  const isDuplicate = firstParam(params.dup) === "1";

  return (
    <DoneStep
      figure={figure}
      ownedId={owned.id}
      acquiredAt={owned.acquiredAt}
      place={formatPlace(owned.acquiredCity, owned.acquiredCountry)}
      needsStory={owned.needsStory === true}
      slug={owned.isPublic === false ? null : owned.slug}
      duplicateQuantity={isDuplicate ? (owned.quantity ?? 1) : null}
      stats={stats}
    />
  );
}
