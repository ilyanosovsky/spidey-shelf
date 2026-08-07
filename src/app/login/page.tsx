import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getSession } from "@/lib/dal";

import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "VAULT ACCESS — Spidey Shelf",
  robots: { index: false, follow: false },
};

export default async function LoginPage() {
  // Already signed in? Skip the form.
  if (await getSession()) redirect("/admin");

  return (
    <main
      id="main"
      tabIndex={-1}
      className="flex min-h-dvh flex-col items-center justify-center p-6"
    >
      <div className="w-full max-w-sm rounded-lg border-4 border-blue-frame bg-navy-deep p-6 shadow-[6px_6px_0_var(--color-ink-px)]">
        <h1 className="font-pixel text-center text-lg leading-relaxed text-cream">
          VAULT
          <span className="text-coral"> 🕷 </span>
          ACCESS
        </h1>
        <p className="mt-3 text-center text-sm text-cream/70">Admin only. One password.</p>

        <LoginForm />
      </div>
    </main>
  );
}
