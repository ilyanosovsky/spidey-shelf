/**
 * Where this deployment lives — the one answer `metadataBase`, `robots.txt`, the sitemap and
 * every Open Graph URL are built from.
 *
 * Absolute URLs are not optional for social previews: Messenger, WhatsApp, iMessage and
 * Twitter all fetch `og:image` from a bare crawler with no page context, so a relative path
 * is simply not fetched and the link renders as grey text. That was the bug this file exists
 * to fix — the shelf had a perfectly good icon and no preview anywhere.
 *
 * `NEXT_PUBLIC_SITE_URL` is the override and the Vercel production URL is the fallback,
 * deliberately in that order and deliberately never throwing: a missing variable must not be
 * able to fail `next build` (the no-env build is a gate on this project — see
 * docs/wiki/Architecture.md), and the worst case of a wrong fallback is a preview image that
 * points at production rather than a broken deploy.
 */

/** The production URL, used whenever the environment does not say otherwise. */
export const DEFAULT_SITE_URL = "https://spidey-shelf.vercel.app";

/**
 * `https://spidey-shelf.vercel.app` — no trailing slash, protocol guaranteed.
 *
 * Anything unparseable falls back rather than throwing, because the only thing a typo in an
 * environment variable should cost is a wrong link in a preview card.
 */
export function siteUrl(env: string | undefined = process.env.NEXT_PUBLIC_SITE_URL): string {
  const raw = (env ?? "").trim();
  if (raw.length === 0) return DEFAULT_SITE_URL;

  // A bare host (`spidey-shelf.vercel.app`) is what a person pastes; `new URL()` rejects it.
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;

  try {
    const url = new URL(withProtocol);
    if (url.protocol !== "http:" && url.protocol !== "https:") return DEFAULT_SITE_URL;
    return `${url.origin}${url.pathname.replace(/\/+$/, "")}`;
  } catch {
    return DEFAULT_SITE_URL;
  }
}

/** An absolute URL for a site-relative path — `"/wishlist"` → `https://…/wishlist`. */
export function absoluteUrl(path: string, base: string = siteUrl()): string {
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

/** The one-line description every surface reuses: the layout, the manifest and the OG card. */
export const SITE_DESCRIPTION =
  "Personal Funko Pop Spider-Man collection tracker. Check if Ilya already owns a figure before gifting one.";

/** The tagline painted on the social card — shorter than the description, and in the voice. */
export const SITE_TAGLINE = "DOES HE ALREADY HAVE THIS ONE?";

export const SITE_NAME = "SPIDEY SHELF";

/**
 * The social card, as metadata describes it — one object, because it has to be named twice.
 *
 * Next attaches `src/app/opengraph-image.tsx` to every route in the tree by itself, but only
 * while a page leaves `openGraph` alone: declaring the key in `generateMetadata` (which
 * `/figure/[slug]` must, or every shared figure link would carry the site's generic headline)
 * replaces the inherited object **including its images**. Losing the card that way is silent
 * — the page renders, the tags are simply absent — so the figure page names it explicitly,
 * and it is named here so the two spellings cannot drift.
 *
 * `alt` and `size` are re-exported by the image route itself, which is what makes this the
 * single source: the width in the meta tag is the width Satori actually draws.
 */
export const OG_IMAGE_ALT = "SPIDEY SHELF — does he already have this one?";
export const OG_IMAGE_SIZE = { width: 1200, height: 630 } as const;
export const OG_IMAGE_PATH = "/opengraph-image";

export const OG_IMAGE_CONTENT_TYPE = "image/png";

export const OG_IMAGE = {
  url: OG_IMAGE_PATH,
  ...OG_IMAGE_SIZE,
  alt: OG_IMAGE_ALT,
  type: OG_IMAGE_CONTENT_TYPE,
} as const;
