"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { ownedFigures, referenceFigures } from "@/db/schema";
import { decideUpcBackfill } from "@/lib/barcode/backfill";
import { catalogSlug } from "@/lib/catalog";
import {
  getAdminFigure,
  getReferenceReviewNote,
  getReferenceUpc,
  listOwnedCopies,
  listTakenSlugs,
} from "@/lib/collection-queries";
import { requireAdmin } from "@/lib/dal";
import {
  appendReviewNote,
  fixFigureFormFields,
  manualCorrectionNote,
  parseFixFigureForm,
} from "@/lib/fix-figure";
import {
  findOwnedDuplicate,
  newFigureFormFields,
  parseNewFigureForm,
  parseQuickAddDetailsForm,
  parseUuidParam,
  quickAddDetailsFormFields,
  quickAddErrorParam,
  quickAddHref,
  scannedUpcValue,
  type QuickAddErrorCode,
} from "@/lib/quick-add";
import { figureSlug } from "@/lib/slug";

/**
 * The three writes Quick Add performs, and the one rule they all share: **every one of them
 * starts with `requireAdmin()`**. `src/proxy.ts` only redirects optimistically, and
 * CVE-2025-29927 showed a crafted header can skip a proxy check entirely — a server action
 * is reachable without ever passing it, so the session check inside the action is the gate
 * (CLAUDE.md, ADR-005).
 *
 * All three end in a `redirect()` rather than in a returned state object. That is what lets
 * the whole flow be server-rendered with zero client JavaScript: a step is a URL, a failed
 * submit is the same URL with `?err=CODE`, and the browser's back button does the obvious
 * thing. The trade is that a rejected submit loses what was typed — acceptable because every
 * field the parsers can reject is already constrained by the input itself (`type="date"`,
 * `maxlength`, radio groups), so reaching an error at all means a hand-built POST.
 */

/** Both writes move the same four screens; the dashboard counters are on two of them. */
function revalidateVault(): void {
  revalidatePath("/admin");
  revalidatePath("/admin/collection");
  revalidatePath("/admin/add");
  revalidatePath("/");
}

function failNewFigure(
  errors: readonly QuickAddErrorCode[],
  query: string,
  upc: string | null,
): never {
  redirect(quickAddHref("new", { q: query, upc, err: quickAddErrorParam(errors) }));
}

/**
 * The scanner's payoff: the confirmed figure learns the barcode that found it.
 *
 * Called from both write paths (a new sighting and a bumped duplicate) because both are
 * moments when a human has just looked at a box and said "yes, this row". `upc` is empty on
 * every non-scan add, and then this returns before it reads or writes anything at all.
 *
 * The clash branch is the important one. Exclusives share UPCs (ADR-006, ADR-010), so a second,
 * different code on a row is evidence of ambiguity, not a correction: the old value stays,
 * `needs_review` goes up, and `review_note` records both codes so the triage pass knows
 * what it is looking at. Overwriting would trade a checked fact for a guess.
 */
async function backfillUpc(referenceFigureId: string, scanned: string | null): Promise<void> {
  if (!scanned) return;

  const decision = decideUpcBackfill(await getReferenceUpc(referenceFigureId), scanned);
  if (decision.action === "none") return;

  await db
    .update(referenceFigures)
    .set(
      decision.action === "write"
        ? { upc: decision.upc, updatedAt: new Date() }
        : { needsReview: true, reviewNote: decision.note, updatedAt: new Date() },
    )
    .where(eq(referenceFigures.id, referenceFigureId));
}

/**
 * Step 1b — the figure is not in the catalog, so the catalog gets one more row.
 *
 * `source: "manual"` and `needs_review: true` are not optional decorations: this row was
 * typed on a phone from the front of a box, it has no `source_url`, and it must show up in
 * the triage pass next to the seed rows that need checking. `counts_toward_total` mirrors
 * the category because ADR-009 says the denominator IS the `peter` bucket.
 */
export async function createReferenceFigureAction(formData: FormData): Promise<void> {
  await requireAdmin();

  const fields = newFigureFormFields(formData);
  const query = fields.q ?? "";

  const parsed = parseNewFigureForm(fields);
  if (!parsed.ok) failNewFigure(parsed.errors, query, scannedUpcValue(fields.upc));

  const { name, popNumber, category, productLine, countsTowardTotal, upc } = parsed.value;

  // The seeder's slug ladder, reused: base first, then variant/exclusivity, then a numeric
  // tail — so a hand-added second "Spider-Man #3" cannot steal the existing row's URL.
  const base = figureSlug(productLine ?? "", name, popNumber);
  const slug = catalogSlug(
    { name, productLine, popNumber, variantFlags: [], exclusivity: null },
    await listTakenSlugs(base),
  );

  const [created] = await db
    .insert(referenceFigures)
    .values({
      slug,
      name,
      popNumber,
      category,
      productLine,
      countsTowardTotal,
      // A row that did not exist a second ago cannot clash with itself, so the scanned
      // code goes straight in rather than through `decideUpcBackfill()`.
      upc,
      source: upc ? "scan" : "manual",
      needsReview: true,
    })
    .returning({ id: referenceFigures.id });

  revalidateVault();

  // Straight to the details: a figure invented thirty seconds ago has no variants to confirm
  // and cannot already be in the vault.
  redirect(quickAddHref("details", { ref: created.id, upc }));
}

/**
 * The FIX detour — the catalog row was wrong, and the owner is the one holding the box.
 *
 * Everything about this write is deliberately narrow. It sets the four facts printed on the
 * front of a Pop box and **nothing else**: no slug (it is the natural key — a rename must not
 * break `/figure/<slug>`, see `fix-figure.ts`), no UPC (the scanner owns that column and its
 * clash rules), no `source` (where the row came from is history, not a field). What it does
 * change beyond the four is the review state: a row the owner has just checked against the
 * physical box is a row that has been reviewed, so `needs_review` goes to false and
 * `review_note` gains a dated line saying who decided — appended, because the note may
 * already hold a UPC clash that the triage pass still needs.
 *
 * It lands back on the confirm step of the same figure, carrying the barcode context it
 * arrived with, so a correction costs the add nothing.
 */
export async function fixReferenceFigureAction(formData: FormData): Promise<void> {
  await requireAdmin();

  const fields = fixFigureFormFields(formData);
  const reference = parseUuidParam(fields.referenceFigureId);
  const query = fields.q ?? "";
  const upc = scannedUpcValue(fields.upc);
  const via = fields.via === "barcode" ? "barcode" : null;

  if (!reference) redirect(quickAddHref("identify", { err: quickAddErrorParam(["PICK_FIGURE"]) }));

  const parsed = parseFixFigureForm(fields);
  if (!parsed.ok) {
    redirect(
      quickAddHref("fix", {
        ref: reference,
        q: query,
        upc,
        via,
        err: quickAddErrorParam(parsed.errors),
      }),
    );
  }

  // The id came out of a hidden input, so the row is re-read rather than trusted: a stale
  // tab pointing at a deleted figure must update nothing at all.
  const existing = await getReferenceReviewNote(reference);
  if (!existing) redirect(quickAddHref("identify", { err: quickAddErrorParam(["FIGURE_GONE"]) }));

  await db
    .update(referenceFigures)
    .set({
      name: parsed.value.name,
      popNumber: parsed.value.popNumber,
      category: parsed.value.category,
      productLine: parsed.value.productLine,
      countsTowardTotal: parsed.value.countsTowardTotal,
      needsReview: false,
      reviewNote: appendReviewNote(
        existing.reviewNote,
        manualCorrectionNote(new Date().toISOString().slice(0, 10)),
      ),
      updatedAt: new Date(),
    })
    .where(eq(referenceFigures.id, reference));

  revalidateVault();
  redirect(quickAddHref("confirm", { ref: reference, q: query, upc, via }));
}

/**
 * Step 3 — the sighting itself.
 *
 * `is_public` is not on the form and not set here: the column defaults to true, and a Quick
 * Add is the owner putting a figure on the shelf. Staging a figure privately stays possible
 * from the edit screen, where there is room to think about it.
 */
export async function saveSightingAction(formData: FormData): Promise<void> {
  await requireAdmin();

  const fields = quickAddDetailsFormFields(formData);
  const reference = parseUuidParam(fields.referenceFigureId);

  const parsed = parseQuickAddDetailsForm(fields);
  if (!parsed.ok) {
    redirect(
      quickAddHref("details", {
        ref: reference,
        upc: scannedUpcValue(fields.upc),
        err: quickAddErrorParam(parsed.errors),
      }),
    );
  }

  // The id came from a hidden input, so it is checked against the catalog rather than
  // trusted: a stale tab pointing at a deleted figure must not insert a dangling row.
  const figure = await getAdminFigure(parsed.value.referenceFigureId);
  if (!figure) redirect(quickAddHref("identify", { err: quickAddErrorParam(["FIGURE_GONE"]) }));

  const [created] = await db
    .insert(ownedFigures)
    .values({
      referenceFigureId: parsed.value.referenceFigureId,
      status: parsed.value.status,
      acquiredAt: parsed.value.acquiredAt,
      acquiredCity: parsed.value.acquiredCity,
      acquiredCountry: parsed.value.acquiredCountry,
      story: parsed.value.story,
      needsStory: parsed.value.needsStory,
    })
    .returning({ id: ownedFigures.id });

  // After the sighting, not before: the figure being on the shelf is the fact worth
  // keeping, and a failed enrichment must never cost the entry it came with.
  await backfillUpc(parsed.value.referenceFigureId, parsed.value.upc);

  revalidateVault();
  redirect(quickAddHref("done", { id: created.id }));
}

/**
 * The duplicate path — a second box of a figure already in the vault.
 *
 * This bumps `quantity` on the existing row instead of inserting a second one, and that is
 * the whole point: the sighting log is a story per figure, not per receipt, and two rows for
 * the same Pop would double it up on the shelf and in every counter. The date and the story
 * stay with the first copy.
 */
export async function addDuplicateAction(formData: FormData): Promise<void> {
  await requireAdmin();

  const reference = parseUuidParam(formData.get("referenceFigureId")?.toString());
  if (!reference) redirect(quickAddHref("identify", { err: quickAddErrorParam(["PICK_FIGURE"]) }));

  const upc = scannedUpcValue(formData.get("upc")?.toString());

  const guard = findOwnedDuplicate(await listOwnedCopies(reference));
  if (!guard) {
    redirect(
      quickAddHref("confirm", {
        ref: reference,
        upc,
        err: quickAddErrorParam(["NOTHING_TO_BUMP"]),
      }),
    );
  }

  await db
    .update(ownedFigures)
    .set({
      quantity: sql`coalesce(${ownedFigures.quantity}, 1) + 1`,
      updatedAt: new Date(),
    })
    .where(eq(ownedFigures.id, guard.targetId));

  // A second box of a figure he already owns is still a box with a barcode on it.
  await backfillUpc(reference, upc);

  revalidateVault();
  redirect(quickAddHref("done", { id: guard.targetId, dup: "1" }));
}
