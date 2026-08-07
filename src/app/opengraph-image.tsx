import { readFile } from "node:fs/promises";
import path from "node:path";

import { ImageResponse } from "next/og";

import {
  OG_IMAGE_ALT,
  OG_IMAGE_CONTENT_TYPE,
  OG_IMAGE_SIZE,
  SITE_NAME,
  SITE_TAGLINE,
} from "@/lib/site";
import { SPIDER_GRID, spiderSpriteRects } from "@/lib/spider-sprite";

/**
 * The social card — `/opengraph-image`, 1200×630, drawn rather than photographed.
 *
 * **The bug this fixes was invisible from inside the app.** Every link the owner shared in
 * Messenger rendered as grey text with no picture, because the site had never declared an
 * `og:image` at all. A crawler is not a browser: it fetches one URL with no cookies and no
 * JavaScript, so the preview has to be a real image at a real absolute address, which is
 * what this route and `metadataBase` in the layout are between them.
 *
 * It is the same 16×16 spider `PixelSpiderArt` draws on every card and
 * `scripts/generate-icons.ts` bakes into the favicon — `src/lib/spider-sprite.ts` is the one
 * grid, so the animal in a WhatsApp preview cannot drift from the animal on the shelf. The
 * navy ground and its dotted pattern are `globals.css`' body background, restated here in
 * hex because Satori has no `:root` and no custom properties.
 *
 * **Static on purpose.** No database, no session, no `searchParams`: Next can then render
 * this once at build time and serve it as a file, which matters because a link pasted into a
 * group chat is fetched by half a dozen crawlers at once and none of them should be able to
 * wake up Railway. It is also what keeps the no-env build green — this module reads a font
 * off disk and nothing else.
 *
 * Font: **Press Start 2P**, bundled at `src/assets/fonts/` rather than fetched. Satori needs
 * the actual TTF bytes (it has no browser to ask), and a build step that reaches out to
 * fonts.gstatic.com is a build step that fails the first time a network hiccups.
 * Press Start 2P is © 2012 the Press Start 2P Project Authors and licensed under the **SIL
 * Open Font License 1.1** — a permissive licence that allows bundling and redistribution
 * inside a larger work; the full text travels with it in `src/assets/fonts/OFL.txt`, which
 * is the one condition that matters here.
 */

// Re-exported rather than restated: `/figure/[slug]` has to name this image in its own
// metadata (see `OG_IMAGE`), and a card whose declared size disagrees with its pixels is a
// preview that renders letterboxed in half the clients that fetch it.
export const alt = OG_IMAGE_ALT;
export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_CONTENT_TYPE;

/** Tokens, spelled out: Satori resolves no CSS variables. Same values as `globals.css`. */
const COLORS = {
  navyDeep: "#0d2440",
  blueBright: "#1b41c8",
  blueFrame: "#3a8fc7",
  coral: "#f0614f",
  amber: "#f5b840",
  cream: "#fff6e8",
  inkPx: "#101418",
} as const;

/**
 * Layout, measured rather than guessed.
 *
 * Press Start 2P is monospace with a ~0.93em advance, so a line's width is arithmetic:
 * `SPIDEY SHELF` is 12 characters and the tagline is 30. The inner width of the panel is
 * 1200 − 96 (outer padding) − 16 (border) − 112 (panel padding) = 976px, which puts the
 * title's ceiling at about 87px and the tagline's at about 35px. The first attempt at this
 * card put the spider beside the words, left 568px for them, and ran `SPIDEY SHE` off the
 * right-hand edge — the kind of mistake that is invisible until somebody pastes the link
 * into a group chat. Stacked and centred, both lines fit with room to spare.
 */
const CELL = 15;
const TITLE_SIZE = 72;
const TAGLINE_SIZE = 22;

/**
 * The dot grid, as a tiling image rather than a gradient.
 *
 * `globals.css` paints the body with `radial-gradient(#2a52d8 1px, transparent 1px)` at a
 * 24px pitch. **Satori does not rasterise radial gradients into a repeating background** —
 * it renders flat colour and says nothing — so the pattern is one 48×48 SVG tile, inlined as
 * a data URI and repeated. Same two colours, twice the pitch, because a 24px grid at poster
 * scale reads as noise in a chat thumbnail.
 */
const DOT_TILE =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><circle cx="4" cy="4" r="2.5" fill="#2a52d8"/></svg>`,
  );

/**
 * `process.cwd()` like the seed and icon scripts — this runs under the Next build/server,
 * which always starts in the package root. `readFile` rather than an `import` of the binary,
 * because a TTF is not a module and bundlers disagree about what to do with one.
 */
async function pressStart2P(): Promise<ArrayBuffer> {
  const file = await readFile(
    path.join(process.cwd(), "src", "assets", "fonts", "PressStart2P-Regular.ttf"),
  );
  return Uint8Array.from(file).buffer;
}

export default async function OpenGraphImage() {
  const font = await pressStart2P();

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: COLORS.blueBright,
        backgroundImage: `url("${DOT_TILE}")`,
        backgroundRepeat: "repeat",
        padding: 48,
      }}
    >
      {/* The panel — the same blue frame and hard pixel shadow every screen wears. */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 26,
          width: "100%",
          height: "100%",
          padding: "48px 56px",
          backgroundColor: COLORS.navyDeep,
          border: `8px solid ${COLORS.blueFrame}`,
          borderRadius: 24,
          boxShadow: `16px 16px 0 ${COLORS.inkPx}`,
        }}
      >
        <div
          style={{
            display: "flex",
            position: "relative",
            width: SPIDER_GRID * CELL,
            height: SPIDER_GRID * CELL,
            flexShrink: 0,
          }}
        >
          {/*
           * Absolutely-positioned divs rather than an <svg>: Satori supports a useful subset
           * of SVG, and a stack of rectangles is the part of it that is boring enough to be
           * certain about. Crisp edges come free — every cell is an integer box, which is
           * what the 8-bit look is.
           */}
          {spiderSpriteRects().map((rect, index) => (
            <div
              key={`${rect.part}-${index}`}
              style={{
                position: "absolute",
                left: rect.x * CELL,
                top: rect.y * CELL,
                width: rect.width * CELL,
                height: rect.height * CELL,
                backgroundColor: rect.part === "eye" ? COLORS.cream : COLORS.coral,
              }}
            />
          ))}
        </div>

        <div
          style={{
            display: "flex",
            fontFamily: "Press Start 2P",
            fontSize: TITLE_SIZE,
            lineHeight: 1.2,
            color: COLORS.cream,
          }}
        >
          {SITE_NAME}
        </div>
        <div
          style={{
            display: "flex",
            fontFamily: "Press Start 2P",
            fontSize: TAGLINE_SIZE,
            lineHeight: 1.4,
            color: COLORS.amber,
          }}
        >
          {SITE_TAGLINE}
        </div>
      </div>
    </div>,
    {
      ...size,
      fonts: [{ name: "Press Start 2P", data: font, style: "normal", weight: 400 }],
    },
  );
}
