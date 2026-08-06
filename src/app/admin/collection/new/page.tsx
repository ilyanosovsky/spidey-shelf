import type { Metadata } from "next";

import { requireAdmin } from "@/lib/dal";

import { Panel, PixelLink } from "../../ui";
import { AddOwnedFigure } from "./add-owned-figure";

export const metadata: Metadata = {
  title: "ADD A FIGURE — Spidey Shelf",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/** Today in the server's timezone — the date the owner almost always wants. */
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default async function NewOwnedFigurePage() {
  // Real enforcement. src/proxy.ts only redirects optimistically (CVE-2025-29927).
  await requireAdmin();

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-5 p-4 sm:p-6">
      <Panel>
        <h1 className="font-pixel text-base leading-relaxed text-cream">NEW SIGHTING</h1>
        <p className="mt-3 text-sm text-cream/70">
          Type the number on the box, or a name. Pick the exact variant — numbers repeat.
        </p>
        <div className="mt-5">
          <PixelLink href="/admin/collection">BACK TO THE VAULT</PixelLink>
        </div>
      </Panel>

      <Panel>
        <AddOwnedFigure today={today()} />
      </Panel>
    </main>
  );
}
