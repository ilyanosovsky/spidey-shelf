import type { Metadata, Viewport } from "next";
import { Geist, Press_Start_2P } from "next/font/google";

import { SITE_DESCRIPTION, SITE_NAME, siteUrl } from "@/lib/site";

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
  /**
   * Every relative URL in this object — and in every page's own metadata — is resolved
   * against this. Without it Next emits `og:image` as a PATH, and a crawler (Messenger,
   * WhatsApp, iMessage, Slack) has no page context to resolve it with, so the preview
   * renders as grey text. That was the actual symptom the owner reported: a perfectly good
   * card that nobody outside the app could see. See `src/lib/site.ts`.
   */
  metadataBase: new URL(siteUrl()),
  title: SITE_NAME,
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  /**
   * The social card. `/opengraph-image` is a static route (`src/app/opengraph-image.tsx`),
   * so this is one file on a CDN rather than a function a dozen crawlers wake at once.
   *
   * Declared HERE and not per page on purpose: `/figure/[slug]` already sets its own title
   * and description in `generateMetadata`, and metadata in the App Router MERGES down the
   * tree — so every figure page inherits this image with its own words over it, which is
   * exactly the card a shared figure link should show.
   */
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "en",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    url: "/",
  },
  /**
   * `summary_large_image` is the difference between a postage stamp beside the text and a
   * 1200×630 card above it — the whole point of drawing one.
   */
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
  },
  alternates: { canonical: "/" },
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
    title: SITE_NAME,
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
