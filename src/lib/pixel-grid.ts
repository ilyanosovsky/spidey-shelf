/**
 * Pixel sprites written as ASCII rows — the format every sprite after the spider uses.
 *
 * The spider (`spider-sprite.ts`) is spans and leg chains because it predates this file and
 * three other places read its exact rects. The sprites that arrived with Phase 14 are small
 * enough to be drawn as text, and text is the only format a reviewer can eyeball in a diff:
 * `"#o.o#"` is a face, `[[0, 0], [1, 0], …]` is homework.
 *
 * One character per cell. `.` is empty; the others name a TONE, not a colour — the component
 * that draws the sprite maps tones to design tokens, so this file stays free of CSS and the
 * same rows can be tinted by whichever category they are standing in for.
 */

/** What a cell is painted with. `accent` is the category's hue; the rest are fixed tokens. */
export type PixelTone = "accent" | "ink" | "cream" | "pink";

/** The character for each tone in a sprite's rows. */
export const PIXEL_TONE_CHARS: Readonly<Record<string, PixelTone>> = {
  "#": "accent",
  o: "ink",
  c: "cream",
  p: "pink",
};

export interface PixelRect {
  x: number;
  y: number;
  width: number;
  /** Always 1 — rows are merged horizontally only, which keeps the parser trivially right. */
  height: number;
  tone: PixelTone;
}

/**
 * Rows → rects, one rect per horizontal run of the same tone.
 *
 * Runs rather than single cells because every rect is an SVG element, and a 16×16 sprite as
 * cells is ~150 nodes per card on a 40-card grid. Throws on an unknown character so a typo in
 * a sprite fails a unit test instead of silently leaving a hole in a face.
 */
export function pixelGridRects(rows: readonly string[]): PixelRect[] {
  const rects: PixelRect[] = [];

  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const char = row[x];
      if (char === ".") {
        x += 1;
        continue;
      }

      const tone = PIXEL_TONE_CHARS[char];
      if (tone === undefined) throw new Error(`unknown sprite character "${char}" in row ${y}`);

      let end = x + 1;
      while (end < row.length && row[end] === char) end += 1;
      rects.push({ x, y, width: end - x, height: 1, tone });
      x = end;
    }
  });

  return rects;
}

/** True when every row reads the same backwards — the property that makes a sprite a face. */
export function isMirrorSymmetric(rows: readonly string[]): boolean {
  return rows.every((row) => row === [...row].reverse().join(""));
}
