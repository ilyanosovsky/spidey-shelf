/**
 * The 8-bit spider itself — one grid, drawn in three places.
 *
 * It started inside `PixelSpiderArt` (the box-art stand-in). Phase 8 needed the same animal
 * as a home-screen icon and a favicon, and a second hand-drawn copy of a sprite is a
 * guarantee that the two will drift the first time someone straightens a leg. So the geometry
 * moved here — pure data and pure functions, no React — and the component, the map's 5×5
 * simplification and `scripts/generate-icons.ts` all read from it.
 *
 * Cells are `[column, row]` on a 16×16 grid, column 0 at the left, row 0 at the top.
 */

/** The sprite lives on a 16×16 grid, drawn as 1×1 rects with crisp edges. */
export const SPIDER_GRID = 16;

/** Body silhouette: `[row, firstColumn, lastColumn]`, a rounded 8-wide blob. */
const BODY_SPANS: readonly (readonly [number, number, number])[] = [
  [4, 6, 9],
  [5, 5, 10],
  [6, 4, 11],
  [7, 4, 11],
  [8, 4, 11],
  [9, 5, 10],
  [10, 6, 9],
];

/**
 * Four legs, left side only — each one a chain of cells that walks out of the body, bends at
 * a knee and puts a foot down. The right side is the mirror (`column → 15 - column`), which
 * is what makes the sprite read as a spider rather than a blob with spikes.
 */
const LEFT_LEGS: readonly (readonly (readonly [number, number])[])[] = [
  [
    [5, 4],
    [4, 3],
    [3, 2],
    [2, 2],
  ],
  [
    [6, 3],
    [5, 2],
    [4, 1],
    [4, 0],
  ],
  [
    [8, 3],
    [9, 2],
    [10, 1],
    [10, 0],
  ],
  [
    [9, 4],
    [10, 3],
    [11, 2],
    [12, 2],
  ],
];

/**
 * Big Spidey eyes: `[row, column, width, height]`, mirrored the same way. Two 2×2 blocks
 * with two empty columns between them — the gap is what stops them reading as one visor.
 */
const LEFT_EYE = [6, 5, 2, 2] as const;

/** Where a speck may sit: the border band only, so it never touches the sprite. */
export const SPECK_CELLS: readonly (readonly [number, number])[] = [
  [1, 1],
  [1, 5],
  [1, 10],
  [1, 14],
  [3, 0],
  [3, 15],
  [12, 0],
  [12, 15],
  [14, 1],
  [14, 6],
  [14, 10],
  [14, 14],
];

export const SPECK_COUNT = 3;

export function mirrorColumn(column: number): number {
  return SPIDER_GRID - 1 - column;
}

/** What a cell is for — the caller decides the colours, this file decides the shape. */
export type SpiderPart = "body" | "leg" | "eye";

export interface SpiderRect {
  x: number;
  y: number;
  width: number;
  height: number;
  part: SpiderPart;
}

/**
 * The whole animal as flat rectangles, in draw order: body, then legs, then eyes on top.
 *
 * Returned rather than kept as a constant so nothing can mutate the shared sprite; it is
 * eleven objects and a handful of loops, called once per render.
 */
export function spiderSpriteRects(): SpiderRect[] {
  const rects: SpiderRect[] = [];

  for (const [row, from, to] of BODY_SPANS) {
    rects.push({ x: from, y: row, width: to - from + 1, height: 1, part: "body" });
  }

  for (const leg of LEFT_LEGS) {
    for (const [row, column] of leg) {
      for (const x of [column, mirrorColumn(column)]) {
        rects.push({ x, y: row, width: 1, height: 1, part: "leg" });
      }
    }
  }

  const [eyeRow, eyeColumn, eyeWidth, eyeHeight] = LEFT_EYE;
  for (const x of [eyeColumn, mirrorColumn(eyeColumn + eyeWidth - 1)]) {
    rects.push({ x, y: eyeRow, width: eyeWidth, height: eyeHeight, part: "eye" });
  }

  return rects;
}

/** FNV-1a — small, dependency-free, and stable across Node versions and machines. */
function hashSlug(slug: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < slug.length; index += 1) {
    hash ^= slug.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Three distinct border cells picked by the hash — the figure's fingerprint.
 *
 * `Math.imul` + `>>> 0` throughout: a bare `^` in JavaScript yields a SIGNED 32-bit
 * integer, and a negative index quietly reads past the end of the table. The trailing
 * top-up guarantees three cells even in the (rare) case where the hash keeps landing on
 * candidates that are already taken.
 */
export function speckCellsFor(slug: string): (readonly [number, number])[] {
  const hash = hashSlug(slug);
  const picked: (readonly [number, number])[] = [];

  const take = (cell: readonly [number, number]) => {
    if (!picked.some(([row, column]) => row === cell[0] && column === cell[1])) picked.push(cell);
  };

  for (let step = 0; step < SPECK_CELLS.length && picked.length < SPECK_COUNT; step += 1) {
    const mixed = Math.imul(hash ^ (step + 1), 0x27d4eb2d) >>> 0;
    take(SPECK_CELLS[mixed % SPECK_CELLS.length]);
  }

  for (let index = 0; index < SPECK_CELLS.length && picked.length < SPECK_COUNT; index += 1) {
    take(SPECK_CELLS[index]);
  }

  return picked;
}
