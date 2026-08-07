import {
  BOX_ART_GROUND,
  BOX_ART_MIME,
  BOX_ART_QUALITY,
  BOX_ART_SIZE,
  boxArtFileName,
  containRect,
} from "./box-art";

/**
 * The one part of the box-art pipeline that needs a browser.
 *
 * Deliberately the only file here that touches `document`, `Image` or `createImageBitmap`,
 * and deliberately one exported function: the geometry it uses is pure and unit-tested in
 * `src/lib/box-art.ts`, and the panel that calls this mocks this module rather than a canvas.
 * Splitting it that way is what makes "does a portrait box get padded, not cropped?" a
 * question a test can answer in a millisecond.
 *
 * Why the client does the resizing at all (ADR-011): the alternative is uploading a 12 MP
 * phone photo and normalizing it on a server we do not have — Vercel Hobby functions have no
 * sharp budget for this, and UploadThing stores whatever it is given. Doing it before the
 * upload means the 2 GB free tier holds ~10,000 normalized figures instead of ~500 photos,
 * and the owner on a shop's wifi uploads 150 KB instead of 4 MB.
 */

export class BoxArtDecodeError extends Error {
  constructor(cause?: unknown) {
    super("Could not decode that image.");
    this.name = "BoxArtDecodeError";
    this.cause = cause;
  }
}

/**
 * Decode a picked file into something `drawImage` accepts.
 *
 * `createImageBitmap` first because it decodes off the main thread — on a phone, decoding a
 * 12 MP JPEG synchronously is a visible freeze. The `<img>` path is the fallback for the
 * browsers that do not have it (and for the ones whose implementation refuses HEIC); it goes
 * through an object URL, which is revoked in both outcomes because a leaked one pins the
 * whole decoded bitmap in memory until the tab closes.
 */
async function decodeImage(
  file: File,
): Promise<CanvasImageSource & { width: number; height: number }> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file);
    } catch {
      // Fall through to the <img> path rather than failing — some browsers refuse formats
      // here (HEIC on desktop Safari) that the plain decoder handles.
    }
  }

  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new BoxArtDecodeError());
      image.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export interface NormalizeBoxArtOptions {
  /** Overridable for tests and for a future retina variant. */
  size?: number;
  quality?: number;
  /** Names the output file; the slug keeps the UploadThing dashboard readable. */
  slug?: string;
}

/**
 * Any picked image → the one shape this site renders: an 800×800 WebP, the picture contained
 * (never cropped) and centred on the navy panel colour.
 *
 * The ground is painted before the image rather than left transparent on purpose. A
 * transparent WebP over a navy card looks right until the day a card sits on a different
 * background — and the uniform grid ADR-004 asked for is a promise about the *file*, not
 * about the page that happens to show it.
 */
export async function normalizeBoxArt(
  file: File,
  options: NormalizeBoxArtOptions = {},
): Promise<File> {
  const size = options.size ?? BOX_ART_SIZE;
  const quality = options.quality ?? BOX_ART_QUALITY;

  const source = await decodeImage(file);

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;

  const context = canvas.getContext("2d");
  if (!context) throw new BoxArtDecodeError();

  context.fillStyle = BOX_ART_GROUND;
  context.fillRect(0, 0, size, size);

  const rect = containRect(source.width, source.height, size);
  context.drawImage(source, rect.x, rect.y, rect.width, rect.height);

  // Free the decoded bitmap as soon as it is on the canvas — a 12 MP source is ~48 MB of RGBA.
  if (typeof ImageBitmap !== "undefined" && source instanceof ImageBitmap) source.close();

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, BOX_ART_MIME, quality);
  });
  if (!blob) throw new BoxArtDecodeError();

  return new File([blob], boxArtFileName(options.slug ?? "box-art"), { type: BOX_ART_MIME });
}
