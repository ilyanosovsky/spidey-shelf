import { DEFAULT_FIGURE_CATEGORY, isFigureCategory, type FigureCategory } from "@/lib/categories";
import { formatPopNumber } from "@/lib/format";
import { SPIDER_GRID, speckCellsFor, spiderSpriteRects } from "@/lib/spider-sprite";

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
 *
 * The sprite's geometry lives in `src/lib/spider-sprite.ts` since Phase 8 — the PWA icons and
 * the favicon are the same animal, and two hand-drawn copies of one spider drift.
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

/** Re-exported so the sprite's one public entry point stays this component's module. */
export { speckCellsFor };

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
        viewBox={`0 0 ${SPIDER_GRID} ${SPIDER_GRID}`}
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

        {spiderSpriteRects().map((rect) => (
          <rect
            key={`${rect.part}-${rect.x}-${rect.y}`}
            x={rect.x}
            y={rect.y}
            width={rect.width}
            height={rect.height}
            fill={rect.part === "eye" ? undefined : "currentColor"}
            style={rect.part === "eye" ? { fill: "var(--color-cream)" } : undefined}
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
