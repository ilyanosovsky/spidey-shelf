"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { ownedFigures } from "@/db/schema";
import { requireAdmin } from "@/lib/dal";
import {
  ownedFigureFormFields,
  parseOwnedFigureForm,
  type OwnedFigureInput,
} from "@/lib/collection-form";
import {
  findDuplicateOwnedFigure,
  searchReferenceFigures,
  type ReferenceSearchResult,
} from "@/lib/collection-queries";

/**
 * Every action here starts with `requireAdmin()`.
 *
 * That is not belt-and-braces: `src/proxy.ts` only redirects optimistically, and
 * CVE-2025-29927 showed a crafted header can skip a proxy/middleware check entirely, so a
 * server action is reachable without ever passing it. The session check inside the action
 * is the real gate (CLAUDE.md, ADR-005).
 */

export type OwnedFigureFormState = { errors: string[] };

export const emptyOwnedFigureFormState: OwnedFigureFormState = { errors: [] };

/** Search the catalog from the add screen. Returns [] for an empty or too-short query. */
export async function searchCatalogAction(query: string): Promise<ReferenceSearchResult[]> {
  await requireAdmin();
  return searchReferenceFigures(query);
}

function insertValues(input: OwnedFigureInput) {
  return {
    referenceFigureId: input.referenceFigureId,
    status: input.status,
    acquiredAt: input.acquiredAt,
    acquiredCity: input.acquiredCity,
    acquiredCountry: input.acquiredCountry,
    story: input.story,
    isPublic: input.isPublic,
  };
}

export async function createOwnedFigureAction(
  _prevState: OwnedFigureFormState,
  formData: FormData,
): Promise<OwnedFigureFormState> {
  await requireAdmin();

  const parsed = parseOwnedFigureForm(ownedFigureFormFields(formData));
  if (!parsed.ok) return { errors: parsed.errors };

  const duplicate = await findDuplicateOwnedFigure(
    parsed.value.referenceFigureId,
    parsed.value.acquiredAt,
  );
  if (duplicate) {
    return { errors: ["ALREADY IN THE VAULT — SAME FIGURE, SAME DAY"] };
  }

  await db.insert(ownedFigures).values(insertValues(parsed.value));

  revalidatePath("/admin/collection");
  revalidatePath("/admin");
  redirect("/admin/collection");
}

export async function updateOwnedFigureAction(
  id: string,
  _prevState: OwnedFigureFormState,
  formData: FormData,
): Promise<OwnedFigureFormState> {
  await requireAdmin();

  const parsed = parseOwnedFigureForm(ownedFigureFormFields(formData));
  if (!parsed.ok) return { errors: parsed.errors };

  const duplicate = await findDuplicateOwnedFigure(
    parsed.value.referenceFigureId,
    parsed.value.acquiredAt,
    id,
  );
  if (duplicate) {
    return { errors: ["ANOTHER ENTRY ALREADY HOLDS THAT FIGURE ON THAT DAY"] };
  }

  const updated = await db
    .update(ownedFigures)
    .set({ ...insertValues(parsed.value), updatedAt: new Date() })
    .where(eq(ownedFigures.id, id))
    .returning({ id: ownedFigures.id });

  if (updated.length === 0) {
    return { errors: ["THAT ENTRY IS GONE FROM THE VAULT"] };
  }

  revalidatePath("/admin/collection");
  revalidatePath("/admin");
  redirect("/admin/collection");
}

/**
 * A real `DELETE`, not a soft flag: this is the owner's own shelf, a mistyped entry is
 * noise, and "not mine anymore" already covers the figure he no longer has. The confirm
 * step lives in the UI (`delete-owned-figure.tsx`).
 */
export async function deleteOwnedFigureAction(formData: FormData): Promise<void> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  if (id.length === 0) return;

  await db.delete(ownedFigures).where(eq(ownedFigures.id, id));

  revalidatePath("/admin/collection");
  revalidatePath("/admin");
  redirect("/admin/collection");
}
