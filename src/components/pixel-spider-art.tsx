import { DEFAULT_FIGURE_CATEGORY, isFigureCategory, type FigureCategory } from "@/lib/categories";
import { formatPopNumber } from "@/lib/format";

/**
 * The box art that does not exist yet.
 *
 * Real box art is blocked on image rights (Phase 2, `image_path` is NULL everywhere), and a
 * grid of grey "no image" rectangles would look broken. So every figure gets a drawn one: an
 * 8-bit spider on a navy panel, tinted by the figure's category, with the number from the
 * box as the "cover text".
 *
 * Deterministic by construction — the same slug and category always produce byte-identical
 * markup. There is no randomness at render time, only an FNV-1a hash of the slug choosing
 * three background specks, so a figure looks the same on the grid, on its own page and after
 * a redeploy. When the rights question is settled this component is what `next/image`
 * replaces, and nothing else changes.
 */

/** One hue per bucket, straight from the tokens — never a raw hex in a component. */
export const CATEGORY_ACCENT: Record<FigureCategory, string> = {
  peter: "var(--color-coral)",
  spider_verse: "var(--color-pop-green)",
  friends_foes: "var(--color-amber)",
  other: "var(--color-blue-frame)",
};

export function categoryAccent(category: unknown): string {
  return CATEGORY_ACCENT[isFigureCategory(category) ? category : DEFAULT_FIGURE_CATEGORY];
}

/** The sprite lives on a 16×16 grid, drawn as 1×1 rects with crisp edges. */
const GRID = 16;

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
const SPECK_CELLS: readonly (readonly [number, number])[] = [
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

const SPECK_COUNT = 3;

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

function mirror(column: number): number {
  return GRID - 1 - column;
}

export interface PixelSpiderArtProps {
  /** The figure's reference slug — the only source of the sprite's variation. */
  slug: string;
  category: FigureCategory | null;
  popNumber: number | null;
  /** `hero` is the figure page; `card` is the grid. */
  size?: "card" | "hero";
  className?: string;
}

export function PixelSpiderArt({
  slug,
  category,
  popNumber,
  size = "card",
  className = "",
}: PixelSpiderArtProps) {
  const accent = categoryAccent(category);
  const specks = speckCellsFor(slug);

  return (
    // Decorative: the card and the page both carry the figure's name and number as text.
    <div
      aria-hidden="true"
      className={`relative flex aspect-square w-full flex-col items-center justify-center gap-2 overflow-hidden rounded border-2 border-ink-px bg-navy-panel p-3 ${className}`}
    >
      <svg
        viewBox={`0 0 ${GRID} ${GRID}`}
        shapeRendering="crispEdges"
        focusable="false"
        className={size === "hero" ? "w-3/5 max-w-[220px]" : "w-4/5 max-w-[120px]"}
        style={{ color: accent }}
      >
        {specks.map(([row, column]) => (
          <rect
            key={`speck-${row}-${column}`}
            x={column}
            y={row}
            width={1}
            height={1}
            fill="currentColor"
            opacity={0.35}
          />
        ))}

        {BODY_SPANS.map(([row, from, to]) => (
          <rect
            key={`body-${row}`}
            x={from}
            y={row}
            width={to - from + 1}
            height={1}
            fill="currentColor"
          />
        ))}

        {LEFT_LEGS.flatMap((leg, legIndex) =>
          leg.flatMap(([row, column]) =>
            [column, mirror(column)].map((x) => (
              <rect
                key={`leg-${legIndex}-${row}-${x}`}
                x={x}
                y={row}
                width={1}
                height={1}
                fill="currentColor"
              />
            )),
          ),
        )}

        {[LEFT_EYE[1], mirror(LEFT_EYE[1] + LEFT_EYE[2] - 1)].map((x) => (
          <rect
            key={`eye-${x}`}
            x={x}
            y={LEFT_EYE[0]}
            width={LEFT_EYE[2]}
            height={LEFT_EYE[3]}
            style={{ fill: "var(--color-cream)" }}
          />
        ))}
      </svg>

      <p
        className={`font-pixel tracking-wider text-cream/90 tabular-nums ${
          size === "hero" ? "text-lg sm:text-xl" : "text-xs sm:text-sm"
        }`}
      >
        {formatPopNumber(popNumber)}
      </p>
    </div>
  );
}
