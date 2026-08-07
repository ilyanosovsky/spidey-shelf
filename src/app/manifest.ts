import type { MetadataRoute } from "next";

/**
 * The web app manifest, served at `/manifest.webmanifest`.
 *
 * A typed route rather than a hand-written JSON file in `public/`: the colours and the icon
 * paths are then checked by the compiler, and Next.js injects the `<link rel="manifest">`
 * itself so there is nothing to forget in the layout.
 *
 * `display: "standalone"` is what removes Safari's chrome once the shelf is on the home
 * screen — which is the point of this whole exercise. The owner adds figures on a phone in a
 * shop, and the scanner (Phase 7) wants every pixel of viewfinder it can get.
 *
 * `background_color` is the navy the app itself is painted on, so the splash screen does not
 * flash blue before the first paint; `theme_color` is the bright blue passe-partout, matching
 * the `viewport.themeColor` in the layout.
 *
 * Two icon families, because Android crops and iOS does not — see `scripts/generate-icons.ts`.
 * Neither is a placeholder: both are the same 16×16 spider `PixelSpiderArt` draws on a card.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SPIDEY SHELF",
    short_name: "SPIDEY",
    description:
      "Personal Funko Pop Spider-Man collection tracker. Check if Ilya already owns a figure before gifting one.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0d2440",
    theme_color: "#1b41c8",
    lang: "en",
    categories: ["lifestyle", "entertainment"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
