import type { Metadata, Viewport } from "next";
import { Geist, Press_Start_2P } from "next/font/google";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const pressStart = Press_Start_2P({
  variable: "--font-press-start",
  weight: "400",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SPIDEY SHELF",
  description:
    "Personal Funko Pop Spider-Man collection tracker. Check if Ilya already owns a figure before gifting one.",
  applicationName: "SPIDEY SHELF",
  /**
   * iOS has no manifest support worth relying on and no `beforeinstallprompt`, so the
   * home-screen experience is configured entirely through these meta tags. Without
   * `capable`, "Add to Home Screen" produces a bookmark that opens Safari with its chrome;
   * with it, the shelf launches full-screen like an app — which is what the scanner wants.
   *
   * `black-translucent` puts the page under the status bar, and the layouts already end in
   * `pb-[env(safe-area-inset-bottom)]` for the notch at the other end.
   */
  appleWebApp: {
    capable: true,
    title: "SPIDEY SHELF",
    statusBarStyle: "black-translucent",
  },
  icons: {
    // Safari finds `/apple-touch-icon.png` by convention, but only after a 404 on several
    // other spellings; naming it here is one request rather than four.
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#1b41c8",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // The font variables belong on <html>, not on <body>: Tailwind emits the theme tokens
    // (`--font-pixel: var(--font-press-start), monospace`) into `:root`, and a custom
    // property that references an undefined variable computes to nothing there — so with the
    // classes one level lower BOTH webfonts silently fell back to the system stack.
    <html lang="en" className={`${geist.variable} ${pressStart.variable}`}>
      <body className="antialiased">
        {/*
         * Skip link. Every screen opens with the same four-button nav, so a keyboard or
         * switch user otherwise tabs through SHELF · SEARCH · WISHLIST · STATS before
         * reaching anything on the page. Off-screen until focused, then it lands on the
         * amber CTA colour in the top-left corner. Every `<main>` on the site carries
         * `id="main"` and `tabIndex={-1}`, which is what makes the jump actually move focus
         * rather than only the scroll position.
         */}
        <a
          href="#main"
          className="font-pixel sr-only rounded border-2 border-ink-px bg-amber px-4 py-3 text-[10px] tracking-wider text-ink-px focus-visible:not-sr-only focus-visible:absolute focus-visible:top-2 focus-visible:left-2 focus-visible:z-50"
        >
          SKIP TO CONTENT
        </a>
        {children}
      </body>
    </html>
  );
}
