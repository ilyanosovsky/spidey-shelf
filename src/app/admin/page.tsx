import type { Metadata } from "next";
import Link from "next/link";

import { FIGURE_CATEGORY_LABELS } from "@/lib/categories";
import { countStoriesOwed, getVaultStats } from "@/lib/collection-queries";
import { requireAdmin } from "@/lib/dal";
import { STORY_QUEUE_HREF, storiesOwedLabel } from "@/lib/quick-add";

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
  const [stats, storiesOwed] = await Promise.all([getVaultStats(), countStoriesOwed()]);

  const remaining = Math.max(stats.peterTotal - stats.peterOwned, 0);

  return (
    <main
      id="main"
      tabIndex={-1}
      className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-5 p-4 sm:p-6"
    >
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

        <p className="font-pixel mt-4 text-center text-[10px] leading-relaxed text-amber">
          {remaining} SPIDERS STILL OUT THERE
        </p>

        {/*
         * The story queue. Quick Add lets a sighting be logged with no prose (`SKIP FOR NOW`),
         * which only works as a promise if the owed stories are counted somewhere he passes
         * every time — hence an LCD line on the console, not a badge buried in the list.
         */}
        <Link
          href={STORY_QUEUE_HREF}
          className="mt-4 flex min-h-11 items-center justify-center rounded border-2 border-ink-px bg-lcd-bg px-3 py-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber active:translate-x-[2px] active:translate-y-[2px]"
        >
          <span className="font-pixel text-[10px] tracking-wider text-lcd-glow tabular-nums">
            {storiesOwedLabel(storiesOwed)}
          </span>
        </Link>

        <div className="mt-6 flex flex-col gap-3">
          <PixelLink href="/admin/add" variant="primary">
            + QUICK ADD
          </PixelLink>
          <PixelLink href="/admin/collection" variant="secondary">
            OPEN THE VAULT
          </PixelLink>
        </div>

        <p className="font-pixel mt-6 text-center text-[10px] text-lcd-glow/70">
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
