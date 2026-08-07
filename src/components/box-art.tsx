import { boxArtAlt, isRemoteImagePath } from "@/lib/box-art";
import type { FigureCategory } from "@/lib/categories";

import { BoxArtImage } from "./box-art-image";
import { PixelSpiderArt } from "./pixel-spider-art";

/**
 * A figure's picture, wherever a figure is drawn.
 *
 * One component so the three-source story (Architecture.md) is decided in one place instead
 * of at eight call sites:
 *
 *   1. **an owner-uploaded 800×800 WebP** (ADR-011) when `image_path` holds one — today the
 *      only real art there is;
 *   2. **the drawn pixel spider** when it does not, which is still every figure until the
 *      owner starts uploading;
 *   3. and the same spider again if the stored URL fails to load (`BoxArtImage`).
 *
 * The placeholder is not a degraded state — it is a deliberate look, and swapping between the
 * two must not move the layout by a pixel, which is why both render into the same
 * `aspect-square` bordered panel.
 */
export interface BoxArtProps {
  slug: string;
  name: string;
  category: FigureCategory | null;
  popNumber: number | null;
  /** `reference_figures.image_path`: an absolute UploadThing URL, or NULL. */
  imagePath?: string | null;
  /** `hero` is a figure page; `card` is a grid cell. Sizes the placeholder's sprite. */
  size?: "card" | "hero";
  /**
   * The `sizes` attribute for the real image. Required when art exists, because a grid cell
   * that fetches a 800px file at 96px CSS wide is the whole reason `next/image` has the prop.
   */
  sizes?: string;
  /** LCP hint for the figure page's hero. */
  priority?: boolean;
  className?: string;
}

/** What a card sends when it has nothing better to say: 2 / 3 / 4 columns of a max-w-5xl grid. */
export const BOX_ART_CARD_SIZES = "(min-width: 1024px) 240px, (min-width: 640px) 33vw, 50vw";

export function BoxArt({
  slug,
  name,
  category,
  popNumber,
  imagePath,
  size = "card",
  sizes = BOX_ART_CARD_SIZES,
  priority = false,
  className = "",
}: BoxArtProps) {
  const placeholder = (
    <PixelSpiderArt
      slug={slug}
      category={category}
      popNumber={popNumber}
      size={size}
      className={className}
    />
  );

  if (!isRemoteImagePath(imagePath)) return placeholder;

  return (
    <BoxArtImage
      src={imagePath}
      alt={boxArtAlt(name)}
      sizes={sizes}
      priority={priority}
      className={className}
      fallback={placeholder}
    />
  );
}
