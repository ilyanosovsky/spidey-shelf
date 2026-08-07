import type { Metadata } from "next";
import { redirect } from "next/navigation";

import {
  getAdminFigure,
  getOwnedFigure,
  getVaultStats,
  listOwnedCopies,
  listRecentPlaces,
  listVariantCandidates,
  searchAdminCatalog,
} from "@/lib/collection-queries";
import { requireAdmin } from "@/lib/dal";
import { formatPlace } from "@/lib/format";
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
  variantSiblings,
  type AdminCatalogFigure,
} from "@/lib/quick-add";

import { addDuplicateAction, createReferenceFigureAction, saveSightingAction } from "./actions";
import { ConfirmStep } from "./confirm-step";
import { DetailsStep } from "./details-step";
import { DoneStep } from "./done-step";
import { IdentifyStep } from "./identify-step";
import { NewFigureStep } from "./new-figure-step";

/**
 * Quick Add — one route, five frames, `?step=` decides which.
 *
 * Steps are URLs rather than client state, which buys three things at once: the back button
 * works, a half-finished add survives a phone locking itself, and every frame is a plain
 * server render with no JavaScript to download first. Everything this file does is fetch and
 * dispatch — the rules live in `src/lib/quick-add.ts`, the writes in `./actions.ts`, and each
 * step component is a pure function of its props.
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

  if (step === "new") {
    return <NewFigureStep query={query} errors={errors} action={createReferenceFigureAction} />;
  }

  if (step === "confirm" || step === "details") {
    const figure = await requireFigure(params.ref);

    if (step === "details") {
      const place = lastUsedPlace(await listRecentPlaces());
      return (
        <DetailsStep
          figure={figure}
          defaults={quickAddDefaults(today(), place)}
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
