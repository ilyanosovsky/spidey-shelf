import type { Metadata } from "next";

import { requireAdmin } from "@/lib/dal";
import { listOwnedFigures } from "@/lib/collection-queries";

import { CategoryChip, Panel, PixelLink, StatusChip } from "../ui";
import { DeleteOwnedFigure } from "./delete-owned-figure";

export const metadata: Metadata = {
  title: "THE VAULT — Spidey Shelf",
  robots: { index: false, follow: false },
};

/** Nothing is cached: the owner edits this list and expects to see the edit. */
export const dynamic = "force-dynamic";

function place(city: string | null, country: string | null): string {
  return [city, country].filter(Boolean).join(", ") || "—";
}

export default async function AdminCollectionPage() {
  // Real enforcement. src/proxy.ts only redirects optimistically (CVE-2025-29927).
  await requireAdmin();

  const figures = await listOwnedFigures();

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-5 p-4 sm:p-6">
      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-pixel text-base leading-relaxed text-cream">
            THE
            <span className="text-coral"> 🕷 </span>
            VAULT
          </h1>
          <p className="font-pixel text-[10px] tracking-wider text-lcd-glow">
            {figures.length} ENTRIES
          </p>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <PixelLink href="/admin/collection/new" variant="primary">
            + ADD A FIGURE
          </PixelLink>
          <PixelLink href="/admin">BACK TO CONSOLE</PixelLink>
        </div>
      </Panel>

      {figures.length === 0 ? (
        <Panel>
          <p className="font-pixel text-[10px] leading-relaxed text-amber">THE VAULT IS EMPTY.</p>
          <p className="mt-3 text-sm text-cream/70">
            Add the first figure, or run <code>npm run db:seed:owned</code> to load the CSV.
          </p>
        </Panel>
      ) : (
        <ul className="flex flex-col gap-4">
          {figures.map((figure) => (
            <li key={figure.id}>
              <Panel>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-pixel text-[10px] tracking-wider text-amber">
                      #{figure.popNumber ?? "—"}
                    </p>
                    <p className="mt-2 text-base text-cream">
                      {figure.name ?? "(not in the catalog)"}
                    </p>
                    {figure.productLine ? (
                      <p className="mt-1 text-xs text-cream/60">{figure.productLine}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <StatusChip status={figure.status} />
                    <CategoryChip category={figure.category} />
                  </div>
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="font-pixel text-[8px] tracking-wider text-blue-frame">DATE</dt>
                    <dd className="mt-1 text-cream/80 tabular-nums">{figure.acquiredAt ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="font-pixel text-[8px] tracking-wider text-blue-frame">PLACE</dt>
                    <dd className="mt-1 text-cream/80">
                      {place(figure.acquiredCity, figure.acquiredCountry)}
                    </dd>
                  </div>
                </dl>

                {figure.isPublic === false ? (
                  <p className="font-pixel mt-4 text-[8px] tracking-wider text-coral">
                    HIDDEN FROM THE PUBLIC SHELF
                  </p>
                ) : null}

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <PixelLink href={`/admin/collection/${figure.id}/edit`} variant="secondary">
                    EDIT
                  </PixelLink>
                  <DeleteOwnedFigure id={figure.id} name={figure.name ?? "this entry"} />
                </div>
              </Panel>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
