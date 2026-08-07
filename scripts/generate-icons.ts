/**
 * Draws the app icons — the home-screen spider and the favicon.
 *
 *   npm run icons:generate
 *
 * One-time, and committed: `public/icons/*.png`, `public/apple-touch-icon.png` and
 * `src/app/favicon.ico` are checked in, because a build step that needs a native module
 * (sharp) to produce a favicon is a build step that will fail on someone else's machine at
 * the worst moment. The script stays so the icons can be regenerated when the sprite changes.
 *
 * The sprite is not redrawn here. It comes from `src/lib/spider-sprite.ts`, the same 16×16
 * grid `PixelSpiderArt` puts on every card, so the icon on the home screen is literally the
 * animal on the shelf.
 *
 * Two families, and the difference matters on Android:
 *   · **any** — the icon as designed, edge to edge, with the gadget's blue frame;
 *   · **maskable** — the launcher may crop it to a circle, a squircle or a teardrop, and only
 *     the middle 80% is guaranteed to survive. The frame is dropped and the spider shrinks
 *     into that safe zone, so no crop can ever eat a leg.
 *
 * `favicon.ico` carries 16/32/48 px PNG payloads in one container (the Vista-era ICO form
 * every current browser reads), written by hand rather than with a fourth dependency.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import sharp from "sharp";

import { SPIDER_GRID, spiderSpriteRects } from "../src/lib/spider-sprite";

/** Tokens, spelled out: this file renders outside the browser, so there is no `:root`. */
const COLORS = {
  navyDeep: "#0d2440",
  blueFrame: "#3a8fc7",
  coral: "#f0614f",
  cream: "#fff6e8",
  inkPx: "#101418",
} as const;

// `process.cwd()`, like the seed scripts: these run through npm, which always starts in the
// package root, and `import.meta` is not available under tsx's CommonJS transform.
const ROOT = process.cwd();
const ICONS_DIR = path.join(ROOT, "public", "icons");

interface IconOptions {
  size: number;
  /** Share of the canvas the 16×16 sprite occupies. */
  sprite: number;
  /** The gadget frame — dropped on maskable icons, which may be cropped to a circle. */
  frame: boolean;
}

function iconSvg({ size, sprite, frame }: IconOptions): string {
  const drawn = size * sprite;
  const offset = (size - drawn) / 2;
  const scale = drawn / SPIDER_GRID;
  const border = Math.max(2, Math.round(size / 24));

  const rects = spiderSpriteRects()
    .map(
      (rect) =>
        `<rect x="${rect.x}" y="${rect.y}" width="${rect.width}" height="${rect.height}" fill="${
          rect.part === "eye" ? COLORS.cream : COLORS.coral
        }"/>`,
    )
    .join("");

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges">`,
    `<rect width="${size}" height="${size}" fill="${COLORS.navyDeep}"/>`,
    frame
      ? `<rect x="${border / 2}" y="${border / 2}" width="${size - border}" height="${size - border}" fill="none" stroke="${COLORS.blueFrame}" stroke-width="${border}"/>`
      : "",
    `<g transform="translate(${offset} ${offset}) scale(${scale})">${rects}</g>`,
    `</svg>`,
  ].join("");
}

function png(options: IconOptions): Promise<Buffer> {
  return sharp(Buffer.from(iconSvg(options)))
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/**
 * Pack PNG buffers into one `.ico`.
 *
 * ICONDIR (6 bytes) + one 16-byte ICONDIRENTRY per image + the PNG payloads. A width or
 * height of 0 in an entry means 256 — the format is from 1985 and stores the dimension in a
 * single byte.
 */
function ico(images: readonly { size: number; data: Buffer }[]): Buffer {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // 1 = icon
  header.writeUInt16LE(images.length, 4);

  let offset = 6 + images.length * 16;
  const entries = images.map(({ size, data }) => {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2); // palette size — 0 for true colour
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // colour planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += data.length;
    return entry;
  });

  return Buffer.concat([header, ...entries, ...images.map((image) => image.data)]);
}

async function main(): Promise<void> {
  mkdirSync(ICONS_DIR, { recursive: true });

  const written: string[] = [];
  const write = (file: string, data: Buffer) => {
    writeFileSync(file, data);
    written.push(`${path.relative(ROOT, file)} (${(data.length / 1024).toFixed(1)} KB)`);
  };

  for (const size of [192, 512]) {
    write(path.join(ICONS_DIR, `icon-${size}.png`), await png({ size, sprite: 0.66, frame: true }));
    // 0.5 keeps every leg inside the 80% safe zone with room to spare, whatever the launcher
    // crops it to. Android's guidance is the middle 80%; the middle 50% is simply safe.
    write(
      path.join(ICONS_DIR, `maskable-${size}.png`),
      await png({ size, sprite: 0.5, frame: false }),
    );
  }

  // iOS applies its own rounded-rect mask and never a circle, so the frame stays.
  write(
    path.join(ROOT, "public", "apple-touch-icon.png"),
    await png({ size: 180, sprite: 0.66, frame: true }),
  );

  const favicon = ico(
    await Promise.all(
      [16, 32, 48].map(async (size) => ({
        size,
        // No frame below 48px: a 2px border on a 16px canvas eats a quarter of the icon.
        data: await png({ size, sprite: size >= 48 ? 0.72 : 0.86, frame: false }),
      })),
    ),
  );
  write(path.join(ROOT, "src", "app", "favicon.ico"), favicon);

  console.log(`Wrote ${written.length} files (${written.join(", ")}). Commit them.`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
