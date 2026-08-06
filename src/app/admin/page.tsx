import type { Metadata } from "next";

import { requireAdmin } from "@/lib/dal";

import { logoutAction } from "../login/actions";

export const metadata: Metadata = {
  title: "VAULT CONSOLE — Spidey Shelf",
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  // Real enforcement. src/proxy.ts only redirects optimistically (CVE-2025-29927).
  const session = await requireAdmin();

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-lg border-4 border-blue-frame bg-navy-deep p-6 shadow-[6px_6px_0_var(--color-ink-px)]">
        <h1 className="font-pixel text-center text-lg leading-relaxed text-cream">
          VAULT
          <span className="text-coral"> 🕷 </span>
          CONSOLE
        </h1>

        <div className="mt-6 rounded border-2 border-ink-px bg-lcd-bg px-4 py-3 text-center">
          <p className="font-pixel text-[10px] tracking-widest text-lcd-glow">ADMIN ONLINE</p>
          <p className="font-pixel mt-2 text-[8px] text-lcd-glow/70">SESSION: {session.sub}</p>
        </div>

        <p className="mt-6 text-center text-sm text-cream/70">
          Quick Add and the catalog tools land here in later phases.
        </p>

        <form action={logoutAction} className="mt-6">
          <button
            type="submit"
            className="font-pixel w-full rounded border-2 border-ink-px bg-amber px-4 py-3 text-[10px] tracking-wider text-ink-px shadow-[4px_4px_0_var(--color-ink-px)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0_var(--color-ink-px)]"
          >
            LOG OUT
          </button>
        </form>
      </div>
    </main>
  );
}
