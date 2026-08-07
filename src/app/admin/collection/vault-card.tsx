import { BoxArt } from "@/components/box-art";
import type { OwnedFigureRow } from "@/lib/collection-queries";

import { CategoryChip, Panel, PixelLink, StatusChip } from "../ui";
import { DeleteOwnedFigure } from "./delete-owned-figure";

/**
 * One shelf row in THE VAULT — now with the picture on it (Phase 10).
 *
 * The owner's note was that after uploading box art there was nowhere in the admin to see
 * it: the list was number, name, chips and dates, so the one screen where he manages the
 * figures was the one screen that never showed them. A 64px (80px from `sm`) square goes
 * first in the row, which is also how every other surface on the site identifies a figure.
 *
 * `BoxArt` decides between the uploaded 800×800 WebP and the drawn spider, exactly as it
 * does on the public grid — so an admin thumbnail can never disagree with the card a visitor
 * sees. `sizes` is not optional here: without it `next/image` would fetch the 800px file to
 * fill a 64px box, which is the whole reason the prop exists.
 *
 * A row whose `reference_figure_id` is NULL has no slug and no picture; the placeholder is
 * deterministic per slug, so an empty one is stable rather than random.
 */
export const VAULT_THUMB_SIZES = "(min-width: 640px) 80px, 64px";

export function VaultCard({ figure }: { figure: OwnedFigureRow }) {
  return (
    <Panel>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div className="w-16 shrink-0 sm:w-20">
            <BoxArt
              slug={figure.slug ?? ""}
              name={figure.name ?? "This figure"}
              category={figure.category}
              popNumber={figure.popNumber}
              imagePath={figure.imagePath}
              size="card"
              sizes={VAULT_THUMB_SIZES}
            />
          </div>
          <div className="min-w-0">
            <p className="font-pixel text-[10px] tracking-wider text-amber">
              #{figure.popNumber ?? "—"}
            </p>
            <p className="mt-2 text-base text-cream">{figure.name ?? "(not in the catalog)"}</p>
            {figure.productLine ? (
              <p className="mt-1 text-xs text-cream/60">{figure.productLine}</p>
            ) : null}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <StatusChip status={figure.status} />
          <CategoryChip category={figure.category} />
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="font-pixel text-[10px] tracking-wider text-cream/80">DATE</dt>
          <dd className="mt-1 text-cream/80 tabular-nums">{figure.acquiredAt ?? "—"}</dd>
        </div>
        <div>
          <dt className="font-pixel text-[10px] tracking-wider text-cream/80">PLACE</dt>
          <dd className="mt-1 text-cream/80">
            {place(figure.acquiredCity, figure.acquiredCountry)}
          </dd>
        </div>
      </dl>

      {figure.needsStory === true ? (
        <p className="font-pixel mt-4 inline-block rounded border-2 border-amber px-2 py-1 text-[10px] tracking-wider text-amber">
          STORY OWED
        </p>
      ) : null}

      {figure.isPublic === false ? (
        <p className="font-pixel mt-4 text-[10px] tracking-wider text-coral">
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
  );
}

function place(city: string | null, country: string | null): string {
  return [city, country].filter(Boolean).join(", ") || "—";
}
