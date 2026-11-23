import { type FigureCategory } from "./categories";
import { pixelGridRects, type PixelRect } from "./pixel-grid";

/**
 * Which drawing stands in for a figure — the spider, or one of Veronika's two lines.
 *
 * Phase 14 put Veronika's figures on the shelf, and a placeholder card or a map pin with a
 * spider on it is wrong for a figure from her lines: the owner asked for her Stitches and
 * Grogus to be told apart from his spiders at a glance. So each line gets a pixel sprite of
 * its own, drawn for this site in the same hand as the spider — a blue head with two big ears
 * for `stitch`, a green one with wide ears over a cream robe for `grogu`. They are the house
 * style's shorthand for "a figure from this line", not a copy of anyone's artwork, and they
 * are tinted with the category's own token, so colour and silhouette both say which line a
 * figure is from.
 *
 * Every other category keeps the spider — `other` included, because a Deadpool is still the
 * owner's shelf, not hers.
 */
export const FIGURE_SPRITE_KINDS = ["spider", "stitch", "grogu"] as const;

export type FigureSpriteKind = (typeof FIGURE_SPRITE_KINDS)[number];

/** `stitch` → stitch, `grogu` → grogu, anything else (including NULL) → spider. */
export function figureSpriteKind(
  category: FigureCategory | string | null | undefined,
): FigureSpriteKind {
  if (category === "stitch") return "stitch";
  if (category === "grogu") return "grogu";
  return "spider";
}

/**
 * The 16×16 sprites for the placeholder box art (the spider's 16×16 lives in
 * `spider-sprite.ts` and is not touched — the favicon and the share card read it).
 *
 * Both keep rows 1 and 14 and the corner cells of rows 3 and 12 empty: those are
 * `SPECK_CELLS`, where the per-figure specks land, and a speck on top of a sprite would read
 * as a smudge rather than a fingerprint. The unit tests hold them to that.
 */

/** Two tall ears with pink insides, ink eyes set wide, and the big ink nose between them. */
export const STITCH_ROWS_16: readonly string[] = [
  "................",
  "................",
  ".##..........##.",
  ".###........###.",
  ".#p##.####.##p#.",
  ".#pp########pp#.",
  "..#p########p#..",
  "..##oo####oo##..",
  "...#oo#oo#oo#...",
  "...###oooo###...",
  "...##########...",
  "....##cccc##....",
  ".....######.....",
  "................",
  "................",
  "................",
];

/** A round head, ears out to both edges with pink insides, big ink eyes, a cream robe. */
export const GROGU_ROWS_16: readonly string[] = [
  "................",
  "................",
  "................",
  ".....######.....",
  "....########....",
  "################",
  ".#pp#oo##oo#pp#.",
  "..###oo##oo###..",
  "....########....",
  ".....##oo##.....",
  "......####......",
  "....cccccccc....",
  "...cccccccccc...",
  "...cccccccccc...",
  "................",
  "................",
];

const LINE_ROWS_16: Record<Exclude<FigureSpriteKind, "spider">, readonly string[]> = {
  stitch: STITCH_ROWS_16,
  grogu: GROGU_ROWS_16,
};

/** The 16×16 sprite for one of Veronika's lines, as rects in draw order. */
export function lineSpriteRects(kind: Exclude<FigureSpriteKind, "spider">): PixelRect[] {
  return pixelGridRects(LINE_ROWS_16[kind]);
}
