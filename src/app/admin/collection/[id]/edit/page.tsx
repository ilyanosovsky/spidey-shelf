import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getOwnedFigure } from "@/lib/collection-queries";
import { requireAdmin } from "@/lib/dal";

import { CategoryChip, Panel, PixelLink } from "../../../ui";
import { DeleteOwnedFigure } from "../../delete-owned-figure";
import { EditOwnedFigure } from "./edit-owned-figure";

export const metadata: Metadata = {
  title: "EDIT A SIGHTING — Spidey Shelf",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function EditOwnedFigurePage({ params }: { params: Promise<{ id: string }> }) {
  // Real enforcement. src/proxy.ts only redirects optimistically (CVE-2025-29927).
  await requireAdmin();

  const { id } = await params;
  const figure = await getOwnedFigure(id);
  if (!figure) notFound();

  // The form edits a catalog-linked row; an unlinked one (custom_name only) has no Phase 3
  // screen yet — it cannot be created here, and the seeder never makes one.
  if (!figure.referenceFigureId) notFound();

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-5 p-4 sm:p-6">
      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-pixel text-base leading-relaxed text-cream">EDIT SIGHTING</h1>
          <CategoryChip category={figure.category} />
        </div>
        <div className="mt-5">
          <PixelLink href="/admin/collection">BACK TO THE VAULT</PixelLink>
        </div>
      </Panel>

      <Panel>
        <EditOwnedFigure
          id={figure.id}
          reference={{
            id: figure.referenceFigureId,
            popNumber: figure.popNumber,
            name: figure.name ?? "(not in the catalog)",
            productLine: figure.productLine,
          }}
          values={{
            status: figure.status ?? "mine",
            acquiredAt: figure.acquiredAt ?? "",
            acquiredCity: figure.acquiredCity ?? "",
            acquiredCountry: figure.acquiredCountry ?? "",
            story: figure.story ?? "",
            isPublic: figure.isPublic !== false,
          }}
        />
      </Panel>

      <Panel>
        <p className="font-pixel text-[10px] tracking-wider text-coral">DANGER ZONE</p>
        <p className="mt-3 text-sm text-cream/70">
          Deleting removes the entry and its story for good. A figure you no longer have is better
          marked <em>not mine anymore</em>.
        </p>
        <div className="mt-4">
          <DeleteOwnedFigure id={figure.id} name={figure.name ?? "this entry"} />
        </div>
      </Panel>
    </main>
  );
}
