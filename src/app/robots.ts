import type { MetadataRoute } from "next";

import { absoluteUrl } from "@/lib/site";

/**
 * `/robots.txt` — the public site is open, the console is not.
 *
 * A typed route rather than a file in `public/`, for the same reason `manifest.ts` is one:
 * the sitemap URL is then built from the same `siteUrl()` every other absolute link uses and
 * cannot drift from it.
 *
 * The three disallowed prefixes are not a security measure and must not be mistaken for one —
 * `robots.txt` is a request, and the real gate is `requireAdmin()` inside every admin page,
 * server action and route handler (ADR-005, CVE-2025-29927). What they buy is that a crawler
 * does not spend its budget on a login form, and that `/admin/*` and `/api/*` never turn up in
 * a search result as "Sign in — Spidey Shelf". Every admin page also carries
 * `robots: { index: false }` in its own metadata, which is the half a crawler actually obeys.
 *
 * Nothing here is DB-backed, so this file is prerendered at build time with no environment at
 * all — which is the point: the no-env build stays green.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api", "/login"],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
