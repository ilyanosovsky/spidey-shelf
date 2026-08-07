"use client";

import Image from "next/image";
import { useState, type ReactNode } from "react";

import { BOX_ART_SIZE } from "@/lib/box-art";

/**
 * The whole client-side footprint of Phase 9 on the public site: an `<img>` that knows how to
 * give up.
 *
 * A stored `image_path` can stop resolving — the owner deletes a file from the UploadThing
 * dashboard, a key is rotated, the CDN has a bad minute — and the honest response is the
 * placeholder the site already draws, not a broken-image glyph in the middle of the grid.
 * `onError` is a browser event, so this much has to be a client component; it is kept to
 * exactly this much on purpose.
 *
 * **`fallback` is a ReactNode, not a prop bundle.** The placeholder is rendered on the server
 * and handed over as children would be, so `PixelSpiderArt`, the sprite geometry and the
 * category tokens all stay out of the browser bundle. And it is only passed for figures that
 * actually have art, so a shelf with no uploads (which is every shelf today) sends no extra
 * markup at all.
 */
export function BoxArtImage({
  src,
  alt,
  sizes,
  fallback,
  priority = false,
  className = "",
}: {
  src: string;
  alt: string;
  /** The grid's real widths — without it `next/image` fetches a desktop-sized file to a phone. */
  sizes: string;
  fallback: ReactNode;
  priority?: boolean;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) return <>{fallback}</>;

  return (
    <div
      className={`relative aspect-square w-full overflow-hidden rounded border-2 border-ink-px bg-navy-panel ${className}`}
    >
      <Image
        src={src}
        alt={alt}
        width={BOX_ART_SIZE}
        height={BOX_ART_SIZE}
        sizes={sizes}
        priority={priority}
        onError={() => setFailed(true)}
        className="h-full w-full object-cover"
      />
    </div>
  );
}
