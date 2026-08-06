import type { Metadata } from "next";

import { FIGURE_CATEGORY_LABELS } from "@/lib/categories";
import { getVaultStats } from "@/lib/collection-queries";
import { requireAdmin } from "@/lib/dal";

import { logoutAction } from "../login/actions";
import { LcdStat, Panel, PixelLink, pixelButton } from "./ui";

export const metadata: Metadata = {
  title: "VAULT CONSOLE — Spidey Shelf",
  robots: { index: false, follow: false },
};

/** The counters are the point of this screen — never serve them from a cache. */
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  // Real enforcement. src/proxy.ts only redirects optimistically (CVE-2025-29927).
  const session = await requireAdmin();
  const stats = await getVaultStats();

  const remaining = Math.max(stats.peterTotal - stats.peterOwned, 0);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-5 p-4 sm:p-6">
      <Panel>
        <h1 className="font-pixel text-center text-lg leading-relaxed text-cream">
          VAULT
          <span className="text-coral"> 🕷 </span>
          CONSOLE
        </h1>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <LcdStat value={String(stats.mine)} label="FIGURES ON THE SHELF" />
          <LcdStat
            value={`${stats.peterOwned} / ${stats.peterTotal}`}
            label={`${FIGURE_CATEGORY_LABELS.peter} COLLECTED`}
          />
        </div>

        <p className="font-pixel mt-4 text-center text-[8px] leading-relaxed text-amber">
          {remaining} SPIDERS STILL OUT THERE
        </p>

        <div className="mt-6 flex flex-col gap-3">
          <PixelLink href="/admin/collection" variant="primary">
            OPEN THE VAULT
          </PixelLink>
          <PixelLink href="/admin/collection/new" variant="secondary">
            + ADD A FIGURE
          </PixelLink>
        </div>

        <p className="font-pixel mt-6 text-center text-[8px] text-lcd-glow/70">
          SESSION: {session.sub}
        </p>

        <form action={logoutAction} className="mt-4">
          <button type="submit" className={`${pixelButton.quiet} w-full`}>
            LOG OUT
          </button>
        </form>
      </Panel>
    </main>
  );
}
