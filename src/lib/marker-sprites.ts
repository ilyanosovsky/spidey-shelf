import { type FigureSpriteKind } from "./figure-sprites";
import { pixelGridRects, type PixelRect } from "./pixel-grid";

/**
 * The 5×5 sprites the SIGHTINGS MAP pins with — and the legend's key draws with.
 *
 * Five cells is the floor where a shape still reads as a shape at 12–24px, and the ceiling
 * where nine cities on one crop do not touch. The spider is `PixelSpiderArt`'s 16×16 animal
 * boiled down (it lived inside the map component until Phase 14, when the map needed two more
 * kinds and the legend needed the same pixels as a key); the other two are Veronika's lines,
 * the 16×16 sprites of `figure-sprites.ts` boiled down the same way.
 *
 * The three silhouettes are chosen to differ even in a single colour: the spider is six leg
 * cells around a block, the Stitch is two ears standing up from the top corners over a face
 * that narrows to the chin, the Grogu is a round head with one row of ears reaching both
 * edges and a full-width robe underneath.
 */
export const MARKER_GRID = 5;

/**
 * The spider, kept as the exact rects it was drawn with before Phase 14 — six leg cells, a
 * 3×3 body, two cream eyes — so a spider-only city renders byte-for-byte as it always has.
 */
const SPIDER_MARKER: readonly PixelRect[] = [
  ...(
    [
      [0, 0],
      [4, 0],
      [0, 2],
      [4, 2],
      [0, 4],
      [4, 4],
    ] as const
  ).map(([x, y]): PixelRect => ({ x, y, width: 1, height: 1, tone: "accent" })),
  { x: 1, y: 1, width: 3, height: 3, tone: "accent" },
  { x: 1, y: 1, width: 1, height: 1, tone: "cream" },
  { x: 3, y: 1, width: 1, height: 1, tone: "cream" },
];

/** Ears up from the corners, ink eyes, and the ink nose under them. */
export const STITCH_ROWS_5: readonly string[] = ["#...#", "#####", "#o#o#", ".#o#.", ".###."];

/** A round head, one row of ears edge to edge, ink eyes, and the cream robe. */
export const GROGU_ROWS_5: readonly string[] = [".###.", "#####", ".o#o.", ".###.", "ccccc"];

/** The 5×5 sprite for one kind of pin, as rects in draw order (accent first, details on top). */
export function markerSpriteRects(kind: FigureSpriteKind): PixelRect[] {
  if (kind === "stitch") return pixelGridRects(STITCH_ROWS_5);
  if (kind === "grogu") return pixelGridRects(GROGU_ROWS_5);
  return SPIDER_MARKER.map((rect) => ({ ...rect }));
}
