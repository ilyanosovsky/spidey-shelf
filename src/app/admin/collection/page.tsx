import type { Metadata } from "next";
import Link from "next/link";

import { FOCUS_RING } from "@/components/pixel-button";
import { PublicNav } from "@/components/public-nav";
import { requireAdmin } from "@/lib/dal";
import { listOwnedFigures } from "@/lib/collection-queries";
import {
  COLLECTION_FILTERS,
  collectionFilterHref,
  filterOwnedRows,
  parseCollectionFilter,
} from "@/lib/quick-add";

import { Panel, PixelLink } from "../ui";
import { VaultCard } from "./vault-card";

export const metadata: Metadata = {
  title: "THE VAULT — Spidey Shelf",
  robots: { index: false, follow: false },
};

/** Nothing is cached: the owner edits this list and expects to see the edit. */
export const dynamic = "force-dynamic";

const FILTER_LABELS = {
  all: "ALL",
  needs_story: "NEEDS STORY",
} as const;

export default async function AdminCollectionPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string | string[] }>;
}) {
  // Real enforcement. src/proxy.ts only redirects optimistically (CVE-2025-29927).
  await requireAdmin();

  const { filter: rawFilter } = await searchParams;
  const filter = parseCollectionFilter(rawFilter);
  const all = await listOwnedFigures();
  const figures = filterOwnedRows(all, filter);

  return (
    <main
      id="main"
      tabIndex={-1}
      className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-5 p-4 sm:p-6"
    >
      <PublicNav pathname="/admin/collection" isAdmin />

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

        {/* Two chips, one of them the story queue the console links to. */}
        <nav aria-label="Filter" className="mt-5 flex flex-wrap gap-2">
          {COLLECTION_FILTERS.map((value) => (
            <Link
              key={value}
              href={collectionFilterHref(value)}
              aria-current={value === filter ? "page" : undefined}
              className={`font-pixel inline-flex min-h-11 items-center justify-center rounded border-2 px-3 py-2 text-[10px] tracking-wider ${FOCUS_RING} ${
                value === filter
                  ? "border-ink-px bg-pop-green text-ink-px"
                  : "border-blue-frame text-cream"
              }`}
            >
              {FILTER_LABELS[value]}
            </Link>
          ))}
        </nav>

        <div className="mt-4 flex flex-wrap gap-3">
          <PixelLink href="/admin/add" variant="primary">
            + QUICK ADD
          </PixelLink>
          <PixelLink href="/admin">BACK TO CONSOLE</PixelLink>
        </div>
      </Panel>

      {figures.length === 0 ? (
        <Panel>
          <p className="font-pixel text-[10px] leading-relaxed text-amber">
            {filter === "needs_story" ? "NO STORIES OWED. NICE." : "THE VAULT IS EMPTY."}
          </p>
          <p className="mt-3 text-sm text-cream/70">
            {filter === "needs_story" ? (
              "Every sighting on the shelf has its story written."
            ) : (
              <>
                Add the first figure, or run <code>npm run db:seed:owned</code> to load the CSV.
              </>
            )}
          </p>
        </Panel>
      ) : (
        <ul className="flex flex-col gap-4">
          {figures.map((figure) => (
            <li key={figure.id}>
              <VaultCard figure={figure} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
